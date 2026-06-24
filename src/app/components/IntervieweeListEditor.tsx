import { FileText, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { IntervieweePanel } from "./IntervieweePanel";
import {
  LEADING_QUESTION_SETS,
  type LeadingQuestion,
  toEnglishQuestionInput,
} from "../constants/leadingQuestions";
import { useInterviewAnalysis } from "../hooks/useInterviewAnalysis";
import { useExtractionJob } from "../hooks/useExtractionJob";
import { extractInterviewFields } from "../lib/extractInterviewFields";
import { getWitnessTabLabel } from "../lib/getWitnessTabLabel";
import { mergeIntervieweeFields } from "../lib/mergeIntervieweeFields";
import type { AnalyzeInterviewResponse } from "../types/interviewAnalysis";
import { isCoordinatorConfigured } from "../types/inference";
import {
  createEmptyInterviewee,
  INTERVIEW_LANGUAGE_SPOKEN_LABELS,
  type Interviewee,
  type IntervieweeFieldKey,
  type InterviewLanguage,
  type LeadingQuestionSet,
} from "../types/interviewee";

const MAX_ANALYSIS_TRANSCRIPT_LENGTH = 8000;

interface IntervieweeListEditorProps {
  interviewees: Interviewee[];
  onChange: (interviewees: Interviewee[]) => void;
  investigatorNameRank?: string;
  onGenerateStatement?: (intervieweeId: string) => void;
  onGenerateAllStatements?: () => void;
  generatingStatementId?: string | null;
  isGeneratingAll?: boolean;
}

export function IntervieweeListEditor({
  interviewees,
  onChange,
  investigatorNameRank = "",
  onGenerateStatement,
  onGenerateAllStatements,
  generatingStatementId,
  isGeneratingAll = false,
}: IntervieweeListEditorProps) {
  const { runAnalysis } = useInterviewAnalysis();
  const { runExtraction } = useExtractionJob();
  const [activeIntervieweeId, setActiveIntervieweeId] = useState(
    interviewees[0]?.id ?? ""
  );
  const [analysisResults, setAnalysisResults] = useState<
    Record<string, AnalyzeInterviewResponse>
  >({});
  const [extractedFieldKeys, setExtractedFieldKeys] = useState<
    Record<string, Set<IntervieweeFieldKey>>
  >({});
  const [analyzingIntervieweeId, setAnalyzingIntervieweeId] = useState<string | null>(null);

  useEffect(() => {
    if (interviewees.length === 0) {
      setActiveIntervieweeId("");
      return;
    }
    if (!interviewees.some((i) => i.id === activeIntervieweeId)) {
      setActiveIntervieweeId(interviewees[0].id);
    }
  }, [interviewees, activeIntervieweeId]);

  const updateInterviewee = (
    intervieweeId: string,
    key: IntervieweeFieldKey,
    value: string | LeadingQuestionSet | InterviewLanguage
  ) => {
    onChange(
      interviewees.map((i) => (i.id === intervieweeId ? { ...i, [key]: value } : i))
    );
  };

  const addInterviewee = () => {
    const newInterviewee = createEmptyInterviewee(investigatorNameRank);
    onChange([...interviewees, newInterviewee]);
    setActiveIntervieweeId(newInterviewee.id);
  };

  const removeInterviewee = (intervieweeId: string) => {
    if (interviewees.length <= 1) return;

    const index = interviewees.findIndex((i) => i.id === intervieweeId);
    const remaining = interviewees.filter((i) => i.id !== intervieweeId);

    if (activeIntervieweeId === intervieweeId) {
      const fallback = remaining[Math.max(0, index - 1)] ?? remaining[0];
      setActiveIntervieweeId(fallback.id);
    }

    setAnalysisResults((prev) => {
      const next = { ...prev };
      delete next[intervieweeId];
      return next;
    });
    setExtractedFieldKeys((prev) => {
      const next = { ...prev };
      delete next[intervieweeId];
      return next;
    });
    onChange(remaining);
  };

  const handleLeadingQuestionSetChange = (
    intervieweeId: string,
    set: LeadingQuestionSet
  ) => {
    setAnalysisResults((prev) => {
      const next = { ...prev };
      delete next[intervieweeId];
      return next;
    });
    updateInterviewee(intervieweeId, "leadingQuestionSet", set);
  };

  const handleFactsChange = (intervieweeId: string, facts: string) => {
    setAnalysisResults((prev) => {
      const next = { ...prev };
      delete next[intervieweeId];
      return next;
    });
    updateInterviewee(intervieweeId, "facts", facts);
  };

  const handleAnalyzeCoverage = async (
    intervieweeId: string,
    transcript: string,
    questions: LeadingQuestion[],
    interviewLanguage: InterviewLanguage
  ) => {
    if (!isCoordinatorConfigured()) {
      toast.error("Coordinator is not configured (VITE_COORDINATOR_URL / VITE_WEB_API_KEY)");
      return;
    }

    const trimmed = transcript.trim();
    if (!trimmed) {
      toast.error("Add a transcript in Facts revealed before analyzing");
      return;
    }

    if (trimmed.length > MAX_ANALYSIS_TRANSCRIPT_LENGTH) {
      toast.error(
        `Transcript is too long for analysis (max ${MAX_ANALYSIS_TRANSCRIPT_LENGTH} characters)`
      );
      return;
    }

    setAnalyzingIntervieweeId(intervieweeId);
    try {
      const response = await runAnalysis(
        trimmed,
        questions.map(toEnglishQuestionInput),
        interviewLanguage
      );
      setAnalysisResults((prev) => ({ ...prev, [intervieweeId]: response }));
      toast.success("Coverage analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Coverage analysis failed");
    } finally {
      setAnalyzingIntervieweeId(null);
    }
  };

  const appendToFacts = (intervieweeId: string, text: string) => {
    const interviewee = interviewees.find((i) => i.id === intervieweeId);
    if (!interviewee) return;
    const prefix = interviewee.facts.trim() ? "\n\n" : "";
    updateInterviewee(intervieweeId, "facts", `${interviewee.facts.trim()}${prefix}${text}`);
    toast.success("Added to Facts revealed");
  };

  const applyTranscripts = async (
    intervieweeId: string,
    original: string,
    english: string,
    jobId: string
  ) => {
    const interviewee = interviewees.find((i) => i.id === intervieweeId);
    if (!interviewee) return;
    const transcriptPatched: Interviewee = {
      ...interviewee,
      factsOriginal: original,
      facts: english,
      languageSpoken: INTERVIEW_LANGUAGE_SPOKEN_LABELS[interviewee.interviewLanguage],
    };
    onChange(
      interviewees.map((i) => (i.id === intervieweeId ? transcriptPatched : i))
    );

    if (!isCoordinatorConfigured()) {
      const fallback = extractInterviewFields(english);
      const merged = mergeIntervieweeFields(transcriptPatched, fallback);
      if (merged.extractedKeys.size > 0) {
        onChange(
          interviewees.map((i) =>
            i.id === intervieweeId ? merged.interviewee : i
          )
        );
        setExtractedFieldKeys((prev) => ({
          ...prev,
          [intervieweeId]: merged.extractedKeys,
        }));
        toast.warning("Using local fallback extraction for interview details");
      }
      return;
    }

    try {
      const extractionJob = await runExtraction({
        jobId,
        text: english,
        messageType: "interview",
      });

      const extracted =
        extractionJob.interview_details_result ?? extractInterviewFields(english);
      const merged = mergeIntervieweeFields(transcriptPatched, extracted);
      if (merged.extractedKeys.size === 0) return;

      onChange(
        interviewees.map((i) =>
          i.id === intervieweeId ? merged.interviewee : i
        )
      );
      setExtractedFieldKeys((prev) => ({
        ...prev,
        [intervieweeId]: merged.extractedKeys,
      }));
      toast.success(`Personal details extracted (${merged.extractedKeys.size} fields)`);
    } catch (err) {
      const fallback = extractInterviewFields(english);
      const merged = mergeIntervieweeFields(transcriptPatched, fallback);
      if (merged.extractedKeys.size > 0) {
        onChange(
          interviewees.map((i) =>
            i.id === intervieweeId ? merged.interviewee : i
          )
        );
        setExtractedFieldKeys((prev) => ({
          ...prev,
          [intervieweeId]: merged.extractedKeys,
        }));
        toast.warning("Using local fallback extraction for interview details");
      } else {
        toast.error(err instanceof Error ? err.message : "Interview detail extraction failed");
      }
    }
  };

  const handleInterviewLanguageChange = (
    intervieweeId: string,
    language: InterviewLanguage
  ) => {
    setAnalysisResults((prev) => {
      const next = { ...prev };
      delete next[intervieweeId];
      return next;
    });
    onChange(
      interviewees.map((i) =>
        i.id === intervieweeId
          ? {
              ...i,
              interviewLanguage: language,
              languageSpoken: INTERVIEW_LANGUAGE_SPOKEN_LABELS[language],
            }
          : i
      )
    );
  };

  if (interviewees.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 border-t pt-5">
      <div className="mb-4">
        <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide border-l-2 border-red-400 pl-2">
          e Interview – Interviewees
        </h5>
      </div>

      <Tabs
        value={activeIntervieweeId}
        onValueChange={setActiveIntervieweeId}
        className="w-full"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-auto flex-wrap justify-start max-w-full overflow-x-auto">
            {interviewees.map((interviewee, index) => (
              <TabsTrigger
                key={interviewee.id}
                value={interviewee.id}
                className="max-w-[14rem] truncate"
              >
                {getWitnessTabLabel(interviewee, index)}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button type="button" variant="outline" size="sm" onClick={addInterviewee}>
            <Plus className="mr-2 h-4 w-4" />
            Add interviewee
          </Button>
        </div>

        {interviewees.map((interviewee) => (
          <TabsContent key={interviewee.id} value={interviewee.id} className="mt-0">
            <IntervieweePanel
              interviewee={interviewee}
              canRemove={interviewees.length > 1}
              extractedKeys={extractedFieldKeys[interviewee.id]}
              isAnalyzing={analyzingIntervieweeId === interviewee.id}
              analysisResult={analysisResults[interviewee.id]}
              isGenerating={generatingStatementId === interviewee.id}
              isGeneratingAll={isGeneratingAll}
              onFieldChange={updateInterviewee}
              onLeadingQuestionSetChange={handleLeadingQuestionSetChange}
              onAnalyzeCoverage={handleAnalyzeCoverage}
              onAddToNotes={appendToFacts}
              onInterviewLanguageChange={handleInterviewLanguageChange}
              onTranscriptsComplete={applyTranscripts}
              onRecordingStart={(id, startTime) =>
                updateInterviewee(id, "recordedStartTime", startTime)
              }
              onRecordingStop={(id, endTime) =>
                updateInterviewee(id, "recordedEndTime", endTime)
              }
              onFactsChange={handleFactsChange}
              onRemove={removeInterviewee}
              onGenerateStatement={onGenerateStatement}
            />
          </TabsContent>
        ))}
      </Tabs>

      {onGenerateAllStatements && interviewees.length > 1 ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onGenerateAllStatements}
            disabled={isGeneratingAll || Boolean(generatingStatementId)}
          >
            {isGeneratingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Generate all statements
          </Button>
        </div>
      ) : null}
    </div>
  );
}
