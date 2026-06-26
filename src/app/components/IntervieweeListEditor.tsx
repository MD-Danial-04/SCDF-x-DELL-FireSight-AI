import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SignaturePad } from "./SignaturePad";
import { StatementFormPreviewDialog } from "./StatementFormPreviewDialog";
import { TranscriptPageEditor } from "./TranscriptPageEditor";
import type { InterviewPhase } from "./InterviewStepper";
import { AiProcessingDialog } from "./AiProcessingDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  LEADING_QUESTION_SETS,
  toEnglishQuestionInput,
} from "../constants/leadingQuestions";
import {
  RECORDING_METADATA_FIELDS,
  SYSTEM_RECORDING_FIELD_KEYS,
  getInterviewSection,
  getSectionFieldKeys,
} from "../constants/interviewSections";
import { useInterviewAnalysis } from "../hooks/useInterviewAnalysis";
import { useExtractionJob } from "../hooks/useExtractionJob";
import { extractInterviewFields } from "../lib/extractInterviewFields";
import { mergeIntervieweeFields } from "../lib/mergeIntervieweeFields";
import { personToInterviewDetails } from "../lib/singpass/mapMyInfoPerson";
import { isCoordinatorConfigured } from "../types/inference";
import type { MyInfoPerson } from "../types/myinfo";
import type { AnalyzeInterviewResponse } from "../types/interviewAnalysis";
import {
  createEmptyInterviewee,
  ensureTranscriptPages,
  hasAllFixedTranscriptPages,
  INTERVIEW_LANGUAGE_SPOKEN_LABELS,
  type Interviewee,
  type IntervieweeFieldKey,
  type InterviewLanguage,
  type InterviewSectionId,
  type LeadingQuestionSet,
  type TranscriptPage,
} from "../types/interviewee";

const MAX_ANALYSIS_TRANSCRIPT_LENGTH = 8000;
const SYSTEM_RECORDING_FIELD_SET = new Set<IntervieweeFieldKey>(
  SYSTEM_RECORDING_FIELD_KEYS
);

function todayDateString(): string {
  return new Date().toLocaleDateString();
}

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

/** Sync the canonical statement text + system recording metadata from the
 * interviewee's statement (leading-questions) page. */
function syncStatement(interviewee: Interviewee): Interviewee {
  const statementPage = interviewee.transcriptPages.find(
    (page) => getInterviewSection(page.sectionId).kind === "leading-questions"
  );
  if (!statementPage) {
    return interviewee;
  }
  return {
    ...interviewee,
    facts: statementPage.transcriptEnglish,
    factsOriginal: statementPage.transcriptOriginal,
    interviewLanguage: statementPage.interviewLanguage,
    leadingQuestionSet: statementPage.leadingQuestionSet,
    languageSpoken: INTERVIEW_LANGUAGE_SPOKEN_LABELS[statementPage.interviewLanguage],
    recordedStartTime: statementPage.recordedStartTime || interviewee.recordedStartTime,
    recordedEndTime: statementPage.recordedEndTime || interviewee.recordedEndTime,
  };
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
  const [analyzingPageId, setAnalyzingPageId] = useState<string | null>(null);
  const [extractingPageId, setExtractingPageId] = useState<string | null>(null);
  const [previewIntervieweeId, setPreviewIntervieweeId] = useState<string | null>(
    null
  );
  const [activePageIndex, setActivePageIndex] = useState<Record<string, number>>(
    {}
  );
  const [statementPhase, setStatementPhase] = useState<
    Record<string, InterviewPhase>
  >({});

  const setActivePage = (intervieweeId: string, pageIndex: number) => {
    setActivePageIndex((prev) => ({ ...prev, [intervieweeId]: pageIndex }));
  };

  // Keep a ref of the latest interviewees so async continuations and
  // sequential synchronous mutations compose correctly (onChange is not a
  // functional setter).
  const intervieweesRef = useRef(interviewees);
  intervieweesRef.current = interviewees;

  const mutate = (updater: (list: Interviewee[]) => Interviewee[]) => {
    const next = updater(intervieweesRef.current);
    intervieweesRef.current = next;
    onChange(next);
  };

  const patchInterviewee = (
    intervieweeId: string,
    fn: (interviewee: Interviewee) => Interviewee
  ) => {
    mutate((list) => list.map((item) => (item.id === intervieweeId ? fn(item) : item)));
  };

  const patchPage = (
    intervieweeId: string,
    pageId: string,
    fn: (page: TranscriptPage) => TranscriptPage
  ) => {
    patchInterviewee(intervieweeId, (interviewee) =>
      syncStatement({
        ...interviewee,
        transcriptPages: interviewee.transcriptPages.map((page) =>
          page.id === pageId ? fn(page) : page
        ),
      })
    );
  };

  // Migrate older interviewees that predate transcript pages, and backfill the
  // fixed pages (personal, contact, statement) for any resumed draft missing them.
  useEffect(() => {
    const needsMigration = interviewees.some(
      (item) =>
        !item.transcriptPages ||
        item.transcriptPages.length === 0 ||
        !hasAllFixedTranscriptPages(item)
    );
    if (needsMigration) {
      onChange(interviewees.map(ensureTranscriptPages));
    }
  }, [interviewees, onChange]);

  const clearPageState = (pageId: string) => {
    setAnalysisResults((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setExtractedFieldKeys((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
  };

  const addInterviewee = () => {
    onChange([
      ...interviewees,
      ensureTranscriptPages(createEmptyInterviewee(investigatorNameRank)),
    ]);
  };

  const removeInterviewee = (intervieweeId: string) => {
    if (interviewees.length <= 1) return;
    const removed = interviewees.find((item) => item.id === intervieweeId);
    removed?.transcriptPages.forEach((page) => clearPageState(page.id));
    onChange(interviewees.filter((item) => item.id !== intervieweeId));
  };

  const analyzePage = async (
    intervieweeId: string,
    pageId: string,
    transcript: string,
    leadingSet: LeadingQuestionSet,
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
      toast.error("Add a transcript before analyzing");
      return;
    }
    if (trimmed.length > MAX_ANALYSIS_TRANSCRIPT_LENGTH) {
      toast.error(
        `Transcript is too long for analysis (max ${MAX_ANALYSIS_TRANSCRIPT_LENGTH} characters)`
      );
      return;
    }
    const setDefinition = LEADING_QUESTION_SETS.find(
      (option) => option.id === leadingSet
    );
    if (!setDefinition) {
      toast.error("Select a leading question set to analyze");
      return;
    }

    setAnalyzingPageId(pageId);
    try {
      const response = await runAnalysis(
        trimmed,
        setDefinition.questions.map(toEnglishQuestionInput),
        interviewLanguage
      );
      setAnalysisResults((prev) => ({ ...prev, [pageId]: response }));
      toast.success("Analysis complete — answers filled from transcript");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzingPageId(null);
    }
  };

  const extractPage = async (
    intervieweeId: string,
    pageId: string,
    english: string,
    sectionId: InterviewSectionId,
    jobId: string
  ) => {
    const allowedKeys = getSectionFieldKeys(sectionId);
    if (allowedKeys.length === 0) return;

    setExtractingPageId(pageId);
    try {
      let extracted = extractInterviewFields(english);
      if (isCoordinatorConfigured()) {
        try {
          const extractionJob = await runExtraction({
            jobId,
            text: english,
            messageType: "interview",
          });
          extracted =
            extractionJob.interview_details_result ?? extractInterviewFields(english);
        } catch {
          toast.warning("Using local fallback extraction for this section");
        }
      }

      const current = intervieweesRef.current.find(
        (item) => item.id === intervieweeId
      );
      if (!current) return;
      const merged = mergeIntervieweeFields(current, extracted, allowedKeys);
      if (merged.extractedKeys.size === 0) {
        toast.info("No new fields found in transcript for this section");
        return;
      }
      patchInterviewee(intervieweeId, () => merged.interviewee);
      setExtractedFieldKeys((prev) => ({ ...prev, [pageId]: merged.extractedKeys }));
      toast.success(
        `Filled ${merged.extractedKeys.size} field(s) for ${getInterviewSection(sectionId).label}`
      );
    } finally {
      setExtractingPageId(null);
    }
  };

  const handleTranscriptsComplete = async (
    intervieweeId: string,
    pageId: string,
    original: string,
    english: string,
    jobId: string
  ) => {
    const interviewee = intervieweesRef.current.find(
      (item) => item.id === intervieweeId
    );
    const page = interviewee?.transcriptPages.find((item) => item.id === pageId);
    if (!interviewee || !page) return;
    const section = getInterviewSection(page.sectionId);

    patchPage(intervieweeId, pageId, (current) => ({
      ...current,
      transcriptOriginal: original,
      transcriptEnglish: english,
    }));

    if (section.kind === "leading-questions") {
      patchInterviewee(intervieweeId, (current) => ({
        ...current,
        recordedDate: current.recordedDate || todayDateString(),
      }));
      clearPageState(pageId);
      if (page.leadingQuestionSet !== "none") {
        await analyzePage(
          intervieweeId,
          pageId,
          english,
          page.leadingQuestionSet,
          page.interviewLanguage
        );
      }
      return;
    }

    await extractPage(intervieweeId, pageId, english, page.sectionId, jobId);
  };

  const handleAnalyze = (intervieweeId: string, pageId: string) => {
    const interviewee = intervieweesRef.current.find(
      (item) => item.id === intervieweeId
    );
    const page = interviewee?.transcriptPages.find((item) => item.id === pageId);
    if (!page) return;
    void analyzePage(
      intervieweeId,
      pageId,
      page.transcriptEnglish,
      page.leadingQuestionSet,
      page.interviewLanguage
    );
  };

  const handleFieldChange = (
    intervieweeId: string,
    key: IntervieweeFieldKey,
    value: string
  ) => {
    patchInterviewee(intervieweeId, (interviewee) => ({
      ...interviewee,
      [key]: value,
    }));
  };

  const handlePageSingpassRetrieved = (
    intervieweeId: string,
    pageId: string,
    person: MyInfoPerson
  ) => {
    const current = intervieweesRef.current.find(
      (item) => item.id === intervieweeId
    );
    if (!current) return;
    // Singpass is authoritative one-shot data, so fill every interviewee
    // particular (personal + contact) at once, not just the current section.
    const merged = mergeIntervieweeFields(
      current,
      personToInterviewDetails(person)
    );
    if (merged.extractedKeys.size === 0) {
      toast.info("No new details to fill from Singpass");
      return;
    }
    patchInterviewee(intervieweeId, () => merged.interviewee);
    setExtractedFieldKeys((prev) => ({ ...prev, [pageId]: merged.extractedKeys }));
    toast.success(
      `Retrieved ${merged.extractedKeys.size} field${
        merged.extractedKeys.size === 1 ? "" : "s"
      } from Singpass`
    );
  };

  const toggleAsked = (
    intervieweeId: string,
    pageId: string,
    questionId: string
  ) => {
    patchPage(intervieweeId, pageId, (page) => {
      const current = page.askedQuestionIds ?? [];
      const next = current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId];
      return { ...page, askedQuestionIds: next };
    });
  };

  const addFollowUpToFacts = (
    intervieweeId: string,
    pageId: string,
    text: string
  ) => {
    patchPage(intervieweeId, pageId, (page) => {
      const prefix = page.transcriptEnglish.trim() ? "\n\n" : "";
      return {
        ...page,
        transcriptEnglish: `${page.transcriptEnglish.trim()}${prefix}${text}`,
      };
    });
    toast.success("Added to Facts revealed");
  };

  return (
    <div className="mt-5 border-t pt-5">
      <AiProcessingDialog open={Boolean(extractingPageId)} kind="extraction" />
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <h5 className="hidden">E Interview - Interviewees</h5>
        <Button type="button" variant="outline" size="sm" onClick={addInterviewee}>
          <Plus className="mr-2 h-4 w-4" />
          Add interviewee
        </Button>
      </div>

      <div className="space-y-4">
        {interviewees.map((rawInterviewee, index) => {
          const interviewee = ensureTranscriptPages(rawInterviewee);
          const isGenerating = generatingStatementId === interviewee.id;
          const pages = interviewee.transcriptPages;
          const activeIdx = Math.min(
            Math.max(activePageIndex[interviewee.id] ?? 0, 0),
            pages.length - 1
          );
          const activePage = pages[activeIdx];
          const isStatementActive =
            !!activePage &&
            getInterviewSection(activePage.sectionId).kind ===
              "leading-questions";

          return (
            <Accordion
              key={interviewee.id}
              type="single"
              collapsible
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <AccordionItem value={interviewee.id} className="border-b-0">
                <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
                  <span className="text-sm font-semibold text-gray-900">
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
                      Remove interviewee
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Sections
                        </p>
                        <p className="text-xs text-gray-500">
                          Pick which interview section to fill.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {pages.map((page, pageIndex) => (
                          <Button
                            key={page.id}
                            type="button"
                            size="sm"
                            variant={pageIndex === activeIdx ? "default" : "outline"}
                            className="shrink-0"
                            onClick={() => setActivePage(interviewee.id, pageIndex)}
                          >
                            {pageIndex + 1}. {getInterviewSection(page.sectionId).label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {activePage && (
                      <TranscriptPageEditor
                        key={activePage.id}
                        page={activePage}
                        interviewee={interviewee}
                        extractedKeys={extractedFieldKeys[activePage.id]}
                        analysisResult={analysisResults[activePage.id]}
                        isAnalyzing={analyzingPageId === activePage.id}
                        isExtracting={extractingPageId === activePage.id}
                        onSectionChange={(sectionId) => {
                          clearPageState(activePage.id);
                          patchPage(interviewee.id, activePage.id, (current) => ({
                            ...current,
                            sectionId,
                          }));
                        }}
                        onLeadingSetChange={(set) => {
                          clearPageState(activePage.id);
                          patchPage(interviewee.id, activePage.id, (current) => ({
                            ...current,
                            leadingQuestionSet: set,
                          }));
                        }}
                        onLanguageChange={(language) => {
                          clearPageState(activePage.id);
                          patchPage(interviewee.id, activePage.id, (current) => ({
                            ...current,
                            interviewLanguage: language,
                          }));
                        }}
                        onTranscriptOriginalChange={(value) =>
                          patchPage(interviewee.id, activePage.id, (current) => ({
                            ...current,
                            transcriptOriginal: value,
                          }))
                        }
                        onTranscriptEnglishChange={(value) => {
                          clearPageState(activePage.id);
                          patchPage(interviewee.id, activePage.id, (current) => ({
                            ...current,
                            transcriptEnglish: value,
                          }));
                        }}
                        onRecordingStart={(startTime) =>
                          patchPage(interviewee.id, activePage.id, (current) => ({
                            ...current,
                            recordedStartTime: startTime,
                          }))
                        }
                        onRecordingStop={(endTime) =>
                          patchPage(interviewee.id, activePage.id, (current) => ({
                            ...current,
                            recordedEndTime: endTime,
                          }))
                        }
                        onTranscriptsComplete={(original, english, jobId) =>
                          void handleTranscriptsComplete(
                            interviewee.id,
                            activePage.id,
                            original,
                            english,
                            jobId
                          )
                        }
                        onAnalyze={() => handleAnalyze(interviewee.id, activePage.id)}
                        onFieldChange={(key, value) =>
                          handleFieldChange(interviewee.id, key, value)
                        }
                        onAddFollowUpToFacts={(text) =>
                          addFollowUpToFacts(interviewee.id, activePage.id, text)
                        }
                        onSingpassRetrieved={(person) =>
                          handlePageSingpassRetrieved(
                            interviewee.id,
                            activePage.id,
                            person
                          )
                        }
                        onToggleAsked={(questionId) =>
                          toggleAsked(interviewee.id, activePage.id, questionId)
                        }
                        onPhaseChange={(phase) =>
                          setStatementPhase((prev) =>
                            prev[activePage.id] === phase
                              ? prev
                              : { ...prev, [activePage.id]: phase }
                          )
                        }
                      />
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeIdx <= 0}
                        onClick={() =>
                          setActivePage(interviewee.id, activeIdx - 1)
                        }
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-xs text-gray-500">
                        Page {activeIdx + 1} of {pages.length}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeIdx >= pages.length - 1}
                        onClick={() =>
                          setActivePage(interviewee.id, activeIdx + 1)
                        }
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isStatementActive &&
                    statementPhase[activePage.id] === "review" && (
                    <>
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Statement recording details
                      </p>
                      <p className="text-xs text-gray-500">
                        Start/end time, date and language are filled automatically
                        from the statement recording.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {RECORDING_METADATA_FIELDS.map((field) => {
                        const isSystem = SYSTEM_RECORDING_FIELD_SET.has(field.key);
                        return (
                          <div key={field.key}>
                            <Label
                              htmlFor={`${interviewee.id}-${field.key}`}
                              className="flex items-center gap-2"
                            >
                              {field.label}
                              {isSystem ? (
                                <span className="text-xs font-normal text-gray-400">
                                  (system)
                                </span>
                              ) : null}
                            </Label>
                            <Input
                              id={`${interviewee.id}-${field.key}`}
                              value={`${interviewee[field.key] ?? ""}`}
                              readOnly={isSystem}
                              onChange={(e) =>
                                isSystem
                                  ? undefined
                                  : handleFieldChange(
                                      interviewee.id,
                                      field.key,
                                      e.target.value
                                    )
                              }
                              className={
                                isSystem
                                  ? "mt-1 border-slate-200 bg-slate-50 text-slate-600"
                                  : "mt-1 border-slate-400 bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>Signature of person making statement</Label>
                    <SignaturePad
                      className="mt-1"
                      value={interviewee.signatureDataUrl}
                      onChange={(dataUrl) =>
                        handleFieldChange(
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
                    </>
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
