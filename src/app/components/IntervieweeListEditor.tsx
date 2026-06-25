import { ClipboardCopy, Eye, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { InterviewRecordingCard } from "./InterviewRecordingCard";
import { LeadingQuestionsPanel } from "./LeadingQuestionsPanel";
import { SignaturePad } from "./SignaturePad";
import { StatementFormPreviewDialog } from "./StatementFormPreviewDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import {
  LEADING_QUESTION_SETS,
  toEnglishQuestionInput,
  type LeadingQuestion,
} from "../constants/leadingQuestions";
import { useInterviewAnalysis } from "../hooks/useInterviewAnalysis";
import { useExtractionJob } from "../hooks/useExtractionJob";
import { extractInterviewFields } from "../lib/extractInterviewFields";
import { mergeIntervieweeFields } from "../lib/mergeIntervieweeFields";
import { isCoordinatorConfigured } from "../types/inference";
import type {
  AnalyzeInterviewResponse,
  FollowUpSuggestion,
} from "../types/interviewAnalysis";
import {
  createEmptyInterviewee,
  INTERVIEW_LANGUAGE_SPOKEN_LABELS,
  type Interviewee,
  type IntervieweeFieldKey,
  type InterviewLanguage,
  type LeadingQuestionSet,
} from "../types/interviewee";

interface IntervieweeFieldConfig {
  key: IntervieweeFieldKey;
  label: string;
  multiline?: boolean;
}

const PERSONAL_FIELDS: IntervieweeFieldConfig[] = [
  { key: "name", label: "Name of Interviewee" },
  { key: "nameChinese", label: "Name in Chinese characters (if applicable)" },
  { key: "designation", label: "Designation / Occupation" },
  { key: "nric", label: "NRIC / FIN No." },
  { key: "passportNo", label: "Passport No." },
  { key: "nationality", label: "Nationality" },
  { key: "sex", label: "Sex (Male/Female)" },
  { key: "age", label: "Age" },
  { key: "dateAndPlaceOfBirth", label: "Date and Place of Birth" },
  { key: "maritalStatus", label: "Marital Status" },
  { key: "numberOfChildren", label: "No. of Children" },
  { key: "citizenshipCertNo", label: "Singapore Citizenship Certificate No." },
  { key: "vehicleNo", label: "Vehicle No." },
  { key: "address", label: "Address", multiline: true },
  { key: "placeOfEmployment", label: "Place of Employment" },
];

const CONTACT_FIELDS: IntervieweeFieldConfig[] = [
  { key: "contactHome", label: "Contact No. (Home / Residence)" },
  { key: "contactMobile", label: "Contact No. (Mobile)" },
  { key: "contactOffice", label: "Contact No. (Office)" },
];

const RECORDING_FIELDS: IntervieweeFieldConfig[] = [
  { key: "recordedStartTime", label: "Statement recorded - Start time" },
  { key: "recordedEndTime", label: "Statement recorded - End time" },
  { key: "recordedDate", label: "Statement recorded - Date" },
  { key: "interviewTakenPlace", label: "Interview taken at (place)" },
  { key: "languageSpoken", label: "Language Spoken" },
  { key: "interpretedBy", label: "Interpreted By (if applicable)" },
  { key: "recordedBy", label: "Recorded By (Rank, Name & Signature)" },
];

const MAX_ANALYSIS_TRANSCRIPT_LENGTH = 8000;

interface IntervieweeListEditorProps {
  interviewees: Interviewee[];
  onChange: (interviewees: Interviewee[]) => void;
  investigatorNameRank?: string;
  onGenerateStatement?: (intervieweeId: string) => void;
  onGenerateAllStatements?: () => void;
  onPreviewStatement?: (intervieweeId: string) => Promise<Blob>;
  generatingStatementId?: string | null;
  isGeneratingAll?: boolean;
}

type IntervieweeSectionStatus = "not-edited" | "partial" | "complete";

function getIntervieweeSectionStatus(
  interviewee: Interviewee,
  fields: IntervieweeFieldConfig[]
): IntervieweeSectionStatus {
  const filledCount = fields.filter((field) => {
    const value = interviewee[field.key];
    return typeof value === "string" && value.trim().length > 0;
  }).length;

  if (filledCount === 0) {
    return "not-edited";
  }

  if (filledCount === fields.length) {
    return "complete";
  }

  return "partial";
}

function getIntervieweeSectionStatusMeta(status: IntervieweeSectionStatus) {
  switch (status) {
    case "complete":
      return {
        label: "Completed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "partial":
      return {
        label: "Partially completed",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    default:
      return {
        label: "Not edited",
        className: "border-slate-200 bg-slate-100 text-slate-600",
      };
  }
}

function IntervieweeFieldGrid({
  fields,
  interviewee,
  onFieldChange,
  extractedKeys,
}: {
  fields: IntervieweeFieldConfig[];
  interviewee: Interviewee;
  onFieldChange: (
    intervieweeId: string,
    key: IntervieweeFieldKey,
    value: string | LeadingQuestionSet | InterviewLanguage
  ) => void;
  extractedKeys?: Set<IntervieweeFieldKey>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <div
          key={field.key}
          className={field.multiline ? "md:col-span-2" : undefined}
        >
          <Label
            htmlFor={`${interviewee.id}-${field.key}`}
            className="flex items-center gap-2"
          >
            {field.label}
            {extractedKeys?.has(field.key) ? (
              <span className="text-xs font-normal text-green-600">(auto-filled)</span>
            ) : null}
          </Label>
          {field.multiline ? (
            <Textarea
              id={`${interviewee.id}-${field.key}`}
              value={interviewee[field.key]}
              onChange={(e) =>
                onFieldChange(interviewee.id, field.key, e.target.value)
              }
              rows={3}
              className="mt-1 border-slate-400 bg-white font-mono text-sm text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
            />
          ) : (
            <Input
              id={`${interviewee.id}-${field.key}`}
              value={interviewee[field.key]}
              onChange={(e) =>
                onFieldChange(interviewee.id, field.key, e.target.value)
              }
              className="mt-1 border-slate-400 bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function IntervieweeSectionAccordion({
  value,
  title,
  status,
  children,
}: {
  value: string;
  title: string;
  status: IntervieweeSectionStatus;
  children: ReactNode;
}) {
  const statusMeta = getIntervieweeSectionStatusMeta(status);

  return (
    <Accordion type="single" collapsible className="rounded-lg border bg-white">
      <AccordionItem value={value} className="border-b-0">
        <AccordionTrigger className="px-4 py-3 text-left text-sm font-medium hover:no-underline">
          <div className="flex w-full items-center justify-between gap-3 pr-2">
            <span>{title}</span>
            <Badge variant="outline" className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-1">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function FollowUpSuggestionsPanel({
  intervieweeId,
  followUps,
  interviewLanguage,
  onAddToNotes,
}: {
  intervieweeId: string;
  followUps: FollowUpSuggestion[];
  interviewLanguage: InterviewLanguage;
  onAddToNotes: (text: string) => void;
}) {
  if (followUps.length === 0) return null;

  const showBilingual = interviewLanguage !== "en";

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">
          Suggested follow-up questions
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Ask in the interview language; English is shown for your report notes.
        </p>
      </div>
      <ol className="space-y-3">
        {followUps.map((followUp, index) => (
          <li
            key={`${intervieweeId}-follow-up-${index}`}
            className="text-sm text-gray-800"
          >
            <p className="font-medium">{followUp.prompt_conduct}</p>
            {showBilingual && followUp.prompt_conduct !== followUp.prompt ? (
              <p className="mt-0.5 text-xs text-gray-400">{followUp.prompt}</p>
            ) : null}
            {followUp.reason ? (
              <p className="mt-0.5 text-xs text-gray-500">{followUp.reason}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(followUp.prompt_conduct);
                    toast.success("Follow-up copied to clipboard");
                  } catch {
                    toast.error("Failed to copy to clipboard");
                  }
                }}
              >
                <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAddToNotes(followUp.prompt)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add English to notes
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function IntervieweeLeadingQuestionsSection({
  interviewee,
  activeLeadingQuestions,
  isAnalyzingThis,
  analysisResult,
  onAnalyzeCoverage,
  onAddToNotes,
}: {
  interviewee: Interviewee;
  activeLeadingQuestions: (typeof LEADING_QUESTION_SETS)[number];
  isAnalyzingThis: boolean;
  analysisResult?: AnalyzeInterviewResponse;
  onAnalyzeCoverage: (
    intervieweeId: string,
    transcript: string,
    questions: LeadingQuestion[],
    interviewLanguage: InterviewLanguage
  ) => void;
  onAddToNotes: (text: string) => void;
}) {
  const coverageMap = analysisResult
    ? new Map(analysisResult.coverage.map((item) => [item.id, item]))
    : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Compare transcript against the checklist to find gaps.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={
            !interviewee.facts.trim() ||
            isAnalyzingThis ||
            !isCoordinatorConfigured()
          }
          onClick={() =>
            void onAnalyzeCoverage(
              interviewee.id,
              interviewee.facts,
              activeLeadingQuestions.questions,
              interviewee.interviewLanguage
            )
          }
        >
          {isAnalyzingThis ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Analyze coverage
        </Button>
      </div>

      <LeadingQuestionsPanel
        title={activeLeadingQuestions.title}
        questions={activeLeadingQuestions.questions}
        interviewLanguage={interviewee.interviewLanguage}
        coverage={coverageMap}
      />

      {analysisResult ? (
        <FollowUpSuggestionsPanel
          intervieweeId={interviewee.id}
          followUps={analysisResult.follow_ups}
          interviewLanguage={interviewee.interviewLanguage}
          onAddToNotes={onAddToNotes}
        />
      ) : null}
    </>
  );
}

export function IntervieweeListEditor({
  interviewees,
  onChange,
  investigatorNameRank = "",
  onGenerateStatement,
  onGenerateAllStatements,
  onPreviewStatement,
  generatingStatementId,
  isGeneratingAll = false,
}: IntervieweeListEditorProps) {
  const { runAnalysis } = useInterviewAnalysis();
  const { runExtraction } = useExtractionJob();
  const [analysisResults, setAnalysisResults] = useState<
    Record<string, AnalyzeInterviewResponse>
  >({});
  const [extractedFieldKeys, setExtractedFieldKeys] = useState<
    Record<string, Set<IntervieweeFieldKey>>
  >({});
  const [analyzingIntervieweeId, setAnalyzingIntervieweeId] = useState<
    string | null
  >(null);
  const [previewIntervieweeId, setPreviewIntervieweeId] = useState<
    string | null
  >(null);

  const updateInterviewee = (
    intervieweeId: string,
    key: IntervieweeFieldKey,
    value: string | LeadingQuestionSet | InterviewLanguage
  ) => {
    onChange(
      interviewees.map((item) =>
        item.id === intervieweeId ? { ...item, [key]: value } : item
      )
    );
  };

  const addInterviewee = () => {
    onChange([...interviewees, createEmptyInterviewee(investigatorNameRank)]);
  };

  const removeInterviewee = (intervieweeId: string) => {
    if (interviewees.length <= 1) return;
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
    onChange(interviewees.filter((item) => item.id !== intervieweeId));
  };

  const handleAnalyzeCoverage = async (
    intervieweeId: string,
    transcript: string,
    questions: LeadingQuestion[],
    interviewLanguage: InterviewLanguage
  ) => {
    if (!isCoordinatorConfigured()) {
      toast.error(
        "Coordinator is not configured (VITE_COORDINATOR_URL / VITE_WEB_API_KEY)"
      );
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
    const interviewee = interviewees.find((item) => item.id === intervieweeId);
    if (!interviewee) return;
    const prefix = interviewee.facts.trim() ? "\n\n" : "";
    updateInterviewee(
      intervieweeId,
      "facts",
      `${interviewee.facts.trim()}${prefix}${text}`
    );
    toast.success("Added to Facts revealed");
  };

  const applyTranscripts = async (
    intervieweeId: string,
    original: string,
    english: string,
    jobId: string
  ) => {
    const interviewee = interviewees.find((item) => item.id === intervieweeId);
    if (!interviewee) return;
    const transcriptPatched: Interviewee = {
      ...interviewee,
      factsOriginal: original,
      facts: english,
      languageSpoken: INTERVIEW_LANGUAGE_SPOKEN_LABELS[interviewee.interviewLanguage],
    };
    onChange(
      interviewees.map((item) =>
        item.id === intervieweeId ? transcriptPatched : item
      )
    );

    if (!isCoordinatorConfigured()) {
      const fallback = extractInterviewFields(english);
      const merged = mergeIntervieweeFields(transcriptPatched, fallback);
      if (merged.extractedKeys.size > 0) {
        onChange(
          interviewees.map((item) =>
            item.id === intervieweeId ? merged.interviewee : item
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
        interviewees.map((item) =>
          item.id === intervieweeId ? merged.interviewee : item
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
          interviewees.map((item) =>
            item.id === intervieweeId ? merged.interviewee : item
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
      interviewees.map((item) =>
        item.id === intervieweeId
          ? {
              ...item,
              interviewLanguage: language,
              languageSpoken: INTERVIEW_LANGUAGE_SPOKEN_LABELS[language],
            }
          : item
      )
    );
  };

  return (
    <div className="mt-5 border-t pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <h5 className="hidden">E Interview - Interviewees</h5>
        <Button type="button" variant="outline" size="sm" onClick={addInterviewee}>
          <Plus className="mr-2 h-4 w-4" />
          Add interviewee
        </Button>
      </div>

      <div className="space-y-4">
        {interviewees.map((interviewee, index) => {
          const isGenerating = generatingStatementId === interviewee.id;
          const activeLeadingQuestions = LEADING_QUESTION_SETS.find(
            (option) => option.id === interviewee.leadingQuestionSet
          );
          const isAnalyzingThis = analyzingIntervieweeId === interviewee.id;
          const analysisResult = analysisResults[interviewee.id];
          const personalStatus = getIntervieweeSectionStatus(
            interviewee,
            PERSONAL_FIELDS
          );
          const contactStatus = getIntervieweeSectionStatus(
            interviewee,
            CONTACT_FIELDS
          );
          const recordingStatus = getIntervieweeSectionStatus(
            interviewee,
            RECORDING_FIELDS
          );

          return (
            <Accordion
              key={interviewee.id}
              type="single"
              collapsible
              className="rounded-xl border border-gray-200 bg-gray-50/50"
            >
              <AccordionItem value={interviewee.id} className="border-b-0">
                <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
                  <span className="text-sm font-semibold text-gray-800">
                    Interviewee {index + 1}
                    {interviewee.name ? ` - ${interviewee.name}` : ""}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="space-y-4 px-4 pb-4 pt-1">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInterviewee(interviewee.id)}
                      disabled={interviewees.length <= 1}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>

                  <IntervieweeSectionAccordion
                    value={`${interviewee.id}-personal`}
                    title="Personal details"
                    status={personalStatus}
                  >
                    <IntervieweeFieldGrid
                      fields={PERSONAL_FIELDS}
                      interviewee={interviewee}
                      onFieldChange={updateInterviewee}
                      extractedKeys={extractedFieldKeys[interviewee.id]}
                    />
                  </IntervieweeSectionAccordion>

                  <IntervieweeSectionAccordion
                    value={`${interviewee.id}-contact`}
                    title="Contact numbers"
                    status={contactStatus}
                  >
                    <IntervieweeFieldGrid
                      fields={CONTACT_FIELDS}
                      interviewee={interviewee}
                      onFieldChange={updateInterviewee}
                      extractedKeys={extractedFieldKeys[interviewee.id]}
                    />
                  </IntervieweeSectionAccordion>

                  <IntervieweeSectionAccordion
                    value={`${interviewee.id}-recording`}
                    title="Statement recording"
                    status={recordingStatus}
                  >
                    <IntervieweeFieldGrid
                      fields={RECORDING_FIELDS}
                      interviewee={interviewee}
                      onFieldChange={updateInterviewee}
                      extractedKeys={extractedFieldKeys[interviewee.id]}
                    />
                  </IntervieweeSectionAccordion>

                  <div className="space-y-2">
                    {LEADING_QUESTION_SETS.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`${interviewee.id}-leading-questions-${option.id}`}
                          checked={interviewee.leadingQuestionSet === option.id}
                          onCheckedChange={(checked) => {
                            setAnalysisResults((prev) => {
                              const next = { ...prev };
                              delete next[interviewee.id];
                              return next;
                            });
                            updateInterviewee(
                              interviewee.id,
                              "leadingQuestionSet",
                              checked === true ? option.id : "none"
                            );
                          }}
                        />
                        <Label
                          htmlFor={`${interviewee.id}-leading-questions-${option.id}`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>

                  {activeLeadingQuestions && (
                    <IntervieweeLeadingQuestionsSection
                      interviewee={interviewee}
                      activeLeadingQuestions={activeLeadingQuestions}
                      isAnalyzingThis={isAnalyzingThis}
                      analysisResult={analysisResult}
                      onAnalyzeCoverage={handleAnalyzeCoverage}
                      onAddToNotes={(text) => appendToFacts(interviewee.id, text)}
                    />
                  )}

                  <InterviewRecordingCard
                    title="Record interview"
                    description="Select the interview language, record, then review the original and English transcripts below"
                    interviewLanguage={interviewee.interviewLanguage}
                    onInterviewLanguageChange={(language) =>
                      handleInterviewLanguageChange(interviewee.id, language)
                    }
                    onTranscriptsComplete={(original, english, jobId) =>
                      applyTranscripts(interviewee.id, original, english, jobId)
                    }
                    onRecordingStart={(startTime) =>
                      updateInterviewee(
                        interviewee.id,
                        "recordedStartTime",
                        startTime
                      )
                    }
                    onRecordingStop={(endTime) =>
                      updateInterviewee(interviewee.id, "recordedEndTime", endTime)
                    }
                  />

                  <div>
                    <Label>Facts revealed</Label>
                    <Tabs defaultValue="english" className="mt-2">
                      <TabsList>
                        <TabsTrigger value="original">Original</TabsTrigger>
                        <TabsTrigger value="english">English</TabsTrigger>
                      </TabsList>
                      <TabsContent value="original">
                        <Textarea
                          id={`${interviewee.id}-facts-original`}
                          value={interviewee.factsOriginal}
                          onChange={(e) => {
                            updateInterviewee(
                              interviewee.id,
                              "factsOriginal",
                              e.target.value
                            );
                          }}
                          rows={6}
                          placeholder="Transcript in the language the interview was conducted..."
                          className="font-mono text-sm"
                        />
                      </TabsContent>
                      <TabsContent value="english">
                        <Textarea
                          id={`${interviewee.id}-facts`}
                          value={interviewee.facts}
                          onChange={(e) => {
                            setAnalysisResults((prev) => {
                              const next = { ...prev };
                              delete next[interviewee.id];
                              return next;
                            });
                            updateInterviewee(
                              interviewee.id,
                              "facts",
                              e.target.value
                            );
                          }}
                          rows={6}
                          placeholder="English translation used for coverage analysis and statement export..."
                          className="font-mono text-sm"
                        />
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div>
                    <Label>Signature of person making statement</Label>
                    <SignaturePad
                      className="mt-1"
                      value={interviewee.signatureDataUrl}
                      onChange={(dataUrl) =>
                        updateInterviewee(
                          interviewee.id,
                          "signatureDataUrl",
                          dataUrl
                        )
                      }
                    />
                  </div>

                  {(onGenerateStatement || onPreviewStatement) && (
                    <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                      {onPreviewStatement && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPreviewIntervieweeId(interviewee.id)}
                          disabled={isGenerating || isGeneratingAll}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Preview Statement
                        </Button>
                      )}
                      {onGenerateStatement && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onGenerateStatement(interviewee.id)}
                          disabled={isGenerating || isGeneratingAll}
                        >
                          {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          Generate Statement
                        </Button>
                      )}
                    </div>
                  )}

                  {onPreviewStatement && (
                    <StatementFormPreviewDialog
                      open={previewIntervieweeId === interviewee.id}
                      onOpenChange={(open) =>
                        setPreviewIntervieweeId(open ? interviewee.id : null)
                      }
                      interviewee={interviewee}
                      getBlob={() => onPreviewStatement(interviewee.id)}
                      onDownload={() => onGenerateStatement?.(interviewee.id)}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })}
      </div>

      {onGenerateAllStatements && interviewees.length > 1 && (
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
      )}
    </div>
  );
}
