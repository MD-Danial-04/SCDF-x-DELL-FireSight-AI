import { ClipboardCopy, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { InterviewRecordingCard } from "./InterviewRecordingCard";
import { SignaturePad } from "./SignaturePad";
import { LeadingQuestionsPanel } from "./LeadingQuestionsPanel";
import {
  AMD_LEADING_QUESTIONS,
  AMD_LEADING_QUESTIONS_TITLE,
} from "../constants/amdLeadingQuestions";
import {
  LPG_FIRE_LEADING_QUESTIONS,
  LPG_FIRE_LEADING_QUESTIONS_TITLE,
} from "../constants/lpgFireLeadingQuestions";
import type { LeadingQuestion } from "../constants/leadingQuestions";
import {
  VEHICLE_FIRE_LEADING_QUESTIONS,
  VEHICLE_FIRE_LEADING_QUESTIONS_TITLE,
} from "../constants/vehicleFireLeadingQuestions";
import { useInterviewAnalysis } from "../hooks/useInterviewAnalysis";
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

const LEADING_QUESTION_SET_OPTIONS: {
  id: Exclude<LeadingQuestionSet, "none">;
  label: string;
  title: string;
  questions: LeadingQuestion[];
}[] = [
  {
    id: "amd",
    label: "Show AMD / PMD leading questions",
    title: AMD_LEADING_QUESTIONS_TITLE,
    questions: AMD_LEADING_QUESTIONS,
  },
  {
    id: "vehicle-fire",
    label: "Show vehicle fire leading questions",
    title: VEHICLE_FIRE_LEADING_QUESTIONS_TITLE,
    questions: VEHICLE_FIRE_LEADING_QUESTIONS,
  },
  {
    id: "lpg-town-gas",
    label: "Show LPG / Town Gas leading questions",
    title: LPG_FIRE_LEADING_QUESTIONS_TITLE,
    questions: LPG_FIRE_LEADING_QUESTIONS,
  },
];

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
  { key: "recordedStartTime", label: "Statement recorded – Start time" },
  { key: "recordedEndTime", label: "Statement recorded – End time" },
  { key: "recordedDate", label: "Statement recorded – Date" },
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
  generatingStatementId?: string | null;
  isGeneratingAll?: boolean;
}

function IntervieweeFieldGrid({
  fields,
  interviewee,
  onFieldChange,
}: {
  fields: IntervieweeFieldConfig[];
  interviewee: Interviewee;
  onFieldChange: (intervieweeId: string, key: IntervieweeFieldKey, value: string | LeadingQuestionSet | InterviewLanguage) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {fields.map((field) => (
        <div
          key={field.key}
          className={field.multiline ? "md:col-span-2" : undefined}
        >
          <Label htmlFor={`${interviewee.id}-${field.key}`}>{field.label}</Label>
          {field.multiline ? (
            <Textarea
              id={`${interviewee.id}-${field.key}`}
              value={interviewee[field.key]}
              onChange={(e) => onFieldChange(interviewee.id, field.key, e.target.value)}
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          ) : (
            <Input
              id={`${interviewee.id}-${field.key}`}
              value={interviewee[field.key]}
              onChange={(e) => onFieldChange(interviewee.id, field.key, e.target.value)}
              className="mt-1"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FollowUpSuggestionsPanel({
  intervieweeId,
  followUps,
  onAddToNotes,
}: {
  intervieweeId: string;
  followUps: { related_question_id: string | null; prompt: string; reason: string }[];
  onAddToNotes: (text: string) => void;
}) {
  if (followUps.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">Suggested follow-up questions</p>
        <p className="text-xs text-gray-500 mt-1">
          Generated from gaps or unclear answers in the transcript.
        </p>
      </div>
      <ol className="space-y-3">
        {followUps.map((followUp, index) => (
          <li key={`${intervieweeId}-follow-up-${index}`} className="text-sm text-gray-800">
            <p className="font-medium">{followUp.prompt}</p>
            {followUp.reason ? (
              <p className="text-xs text-gray-500 mt-0.5">{followUp.reason}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(followUp.prompt);
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
                Add to notes
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
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
  const [analysisResults, setAnalysisResults] = useState<
    Record<string, AnalyzeInterviewResponse>
  >({});
  const [analyzingIntervieweeId, setAnalyzingIntervieweeId] = useState<string | null>(null);

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
    onChange([...interviewees, createEmptyInterviewee(investigatorNameRank)]);
  };

  const removeInterviewee = (intervieweeId: string) => {
    if (interviewees.length <= 1) return;
    onChange(interviewees.filter((i) => i.id !== intervieweeId));
  };

  const handleAnalyzeCoverage = async (
    intervieweeId: string,
    transcript: string,
    questions: LeadingQuestion[]
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
        questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          hint: q.hint,
        }))
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

  const applyTranscripts = (
    intervieweeId: string,
    original: string,
    english: string
  ) => {
    const interviewee = interviewees.find((i) => i.id === intervieweeId);
    if (!interviewee) return;
    onChange(
      interviewees.map((i) =>
        i.id === intervieweeId
          ? {
              ...i,
              factsOriginal: original,
              facts: english,
              languageSpoken: INTERVIEW_LANGUAGE_SPOKEN_LABELS[i.interviewLanguage],
            }
          : i
      )
    );
  };

  const handleInterviewLanguageChange = (
    intervieweeId: string,
    language: InterviewLanguage
  ) => {
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

  return (
    <div className="mt-5 border-t pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide border-l-2 border-red-400 pl-2">
          e Interview – Interviewees
        </h5>
        <Button type="button" variant="outline" size="sm" onClick={addInterviewee}>
          <Plus className="mr-2 h-4 w-4" />
          Add interviewee
        </Button>
      </div>

      <div className="space-y-6">
        {interviewees.map((interviewee, index) => {
          const isGenerating = generatingStatementId === interviewee.id;
          const activeLeadingQuestions = LEADING_QUESTION_SET_OPTIONS.find(
            (option) => option.id === interviewee.leadingQuestionSet
          );
          const isAnalyzingThis = analyzingIntervieweeId === interviewee.id;
          const analysisResult = analysisResults[interviewee.id];
          const coverageMap = analysisResult
            ? new Map(analysisResult.coverage.map((item) => [item.id, item]))
            : undefined;

          return (
            <div
              key={interviewee.id}
              className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h6 className="text-sm font-semibold text-gray-800">
                  Interviewee {index + 1}
                  {interviewee.name ? ` — ${interviewee.name}` : ""}
                </h6>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeInterviewee(interviewee.id)}
                  disabled={interviewees.length <= 1}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove
                </Button>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Personal details
                </p>
                <IntervieweeFieldGrid
                  fields={PERSONAL_FIELDS}
                  interviewee={interviewee}
                  onFieldChange={updateInterviewee}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Contact numbers
                </p>
                <IntervieweeFieldGrid
                  fields={CONTACT_FIELDS}
                  interviewee={interviewee}
                  onFieldChange={updateInterviewee}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Statement recording
                </p>
                <IntervieweeFieldGrid
                  fields={RECORDING_FIELDS}
                  interviewee={interviewee}
                  onFieldChange={updateInterviewee}
                />
              </div>

              <div className="space-y-2">
                {LEADING_QUESTION_SET_OPTIONS.map((option) => (
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
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>

              {activeLeadingQuestions && (
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
                        void handleAnalyzeCoverage(
                          interviewee.id,
                          interviewee.facts,
                          activeLeadingQuestions.questions
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
                    coverage={coverageMap}
                  />

                  {analysisResult ? (
                    <FollowUpSuggestionsPanel
                      intervieweeId={interviewee.id}
                      followUps={analysisResult.follow_ups}
                      onAddToNotes={(text) => appendToFacts(interviewee.id, text)}
                    />
                  ) : null}
                </>
              )}

              <InterviewRecordingCard
                title="Record interview"
                description="Select the interview language, record, then review the original and English transcripts below"
                interviewLanguage={interviewee.interviewLanguage}
                onInterviewLanguageChange={(language) =>
                  handleInterviewLanguageChange(interviewee.id, language)
                }
                onTranscriptsComplete={(original, english) =>
                  applyTranscripts(interviewee.id, original, english)
                }
                onRecordingStart={(startTime) =>
                  updateInterviewee(interviewee.id, "recordedStartTime", startTime)
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
                        updateInterviewee(interviewee.id, "factsOriginal", e.target.value);
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
                        updateInterviewee(interviewee.id, "facts", e.target.value);
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
                    updateInterviewee(interviewee.id, "signatureDataUrl", dataUrl)
                  }
                />
              </div>

              {onGenerateStatement && (
                <div className="flex justify-end border-t pt-4">
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
                </div>
              )}
            </div>
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
