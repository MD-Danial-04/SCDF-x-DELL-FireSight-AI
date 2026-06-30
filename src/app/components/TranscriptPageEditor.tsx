import { useState } from "react";
import {
  ChevronDown,
  ClipboardCopy,
  Loader2,
  Plus,
  Scissors,
  Sparkles,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { InterviewRecordingCard } from "./InterviewRecordingCard";
import { GuidedInterviewView } from "./GuidedInterviewView";
import type { GuidedInterviewResult } from "../hooks/useGuidedInterview";
import { InterviewProgress } from "./InterviewProgress";
import { SingpassRetrieveButton } from "./SingpassRetrieveButton";
import { LeadingQuestionsPanel } from "./LeadingQuestionsPanel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import {
  LEADING_QUESTION_SETS,
  type LeadingQuestion,
} from "../constants/leadingQuestions";
import {
  buildDemoGuidedInterviewMode,
  getDemoScenarioById,
} from "../constants/demoScenarios";
import { useOptionalReportSession } from "../context/ReportSessionContext";
import {
  INTERVIEW_SECTIONS,
  getInterviewSection,
  type InterviewSection,
} from "../constants/interviewSections";
import { isCoordinatorConfigured } from "../types/inference";
import {
  INTERVIEWEE_MYINFO_SCOPES,
  type MyInfoPerson,
} from "../types/myinfo";
import type {
  AnalyzeInterviewResponse,
  FollowUpSuggestion,
} from "../types/interviewAnalysis";
import { INTERVIEW_LANGUAGE_OPTIONS } from "../types/interviewee";
import type {
  Interviewee,
  IntervieweeFieldKey,
  InterviewLanguage,
  InterviewSectionId,
  LeadingQuestionSet,
  TranscriptPage,
} from "../types/interviewee";

const LEADING_QUESTION_OPTIONS: { value: LeadingQuestionSet; label: string }[] = [
  { value: "none", label: "No leading questions" },
  ...LEADING_QUESTION_SETS.map((set) => ({ value: set.id, label: set.label })),
];

function FieldGrid({
  section,
  interviewee,
  extractedKeys,
  onFieldChange,
}: {
  section: InterviewSection;
  interviewee: Interviewee;
  extractedKeys?: Set<IntervieweeFieldKey>;
  onFieldChange: (key: IntervieweeFieldKey, value: string) => void;
}) {
  if (!section.fields) return null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {section.fields.map((field) => (
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
              value={`${interviewee[field.key] ?? ""}`}
              onChange={(e) => onFieldChange(field.key, e.target.value)}
              rows={3}
              className="mt-1 border-slate-400 bg-white font-mono text-sm text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
            />
          ) : (
            <Input
              id={`${interviewee.id}-${field.key}`}
              value={`${interviewee[field.key] ?? ""}`}
              onChange={(e) => onFieldChange(field.key, e.target.value)}
              className="mt-1 border-slate-400 bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FollowUpsPanel({
  followUps,
  interviewLanguage,
  onAddToFacts,
}: {
  followUps: FollowUpSuggestion[];
  interviewLanguage: InterviewLanguage;
  onAddToFacts: (text: string) => void;
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
          <li key={`follow-up-${index}`} className="text-sm text-gray-800">
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
                onClick={() => onAddToFacts(followUp.prompt)}
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

interface TranscriptPageEditorProps {
  page: TranscriptPage;
  interviewee: Interviewee;
  extractedKeys?: Set<IntervieweeFieldKey>;
  analysisResult?: AnalyzeInterviewResponse;
  isAnalyzing: boolean;
  isExtracting: boolean;
  isCleaning: boolean;
  canRevertClean: boolean;
  onSectionChange: (sectionId: InterviewSectionId) => void;
  onLeadingSetChange: (set: LeadingQuestionSet) => void;
  onLanguageChange: (language: InterviewLanguage) => void;
  onTranscriptOriginalChange: (value: string) => void;
  onTranscriptEnglishChange: (value: string) => void;
  onRecordingStart: (startTime: string) => void;
  onRecordingStop: (endTime: string) => void;
  onTranscriptsComplete: (original: string, english: string, jobId: string) => void;
  onAnalyze: () => void;
  onFieldChange: (key: IntervieweeFieldKey, value: string) => void;
  onAddFollowUpToFacts: (text: string) => void;
  onSingpassRetrieved: (person: MyInfoPerson) => void;
  onGuidedComplete: (result: GuidedInterviewResult) => void;
  onRemoveInterviewerQuestions: () => void;
  onRevertClean: () => void;
}

export function TranscriptPageEditor({
  page,
  interviewee,
  extractedKeys,
  analysisResult,
  isAnalyzing,
  isExtracting,
  isCleaning,
  canRevertClean,
  onSectionChange,
  onLeadingSetChange,
  onLanguageChange,
  onTranscriptOriginalChange,
  onTranscriptEnglishChange,
  onRecordingStart,
  onRecordingStop,
  onTranscriptsComplete,
  onAnalyze,
  onFieldChange,
  onAddFollowUpToFacts,
  onSingpassRetrieved,
  onGuidedComplete,
  onRemoveInterviewerQuestions,
  onRevertClean,
}: TranscriptPageEditorProps) {
  const session = useOptionalReportSession();
  const demoScenario = session?.demoScenarioId
    ? getDemoScenarioById(session.demoScenarioId)
    : undefined;
  const demoGuidedConfig = demoScenario
    ? buildDemoGuidedInterviewMode(demoScenario)
    : undefined;
  const hasDemoGuidedInterview = Boolean(
    demoGuidedConfig && Object.keys(demoGuidedConfig.demoMode.fixedAnswers).length > 0
  );

  const section = getInterviewSection(page.sectionId);
  const isLeadingQuestions = section.kind === "leading-questions";
  const isProfile = section.kind === "profile";
  const transcriptLabel = isLeadingQuestions ? "Facts revealed" : "Transcript";
  const singpassScopes = INTERVIEWEE_MYINFO_SCOPES;

  const activeLeadingQuestions = LEADING_QUESTION_SETS.find(
    (option) => option.id === page.leadingQuestionSet
  );
  const guidedQuestionSetTitle =
    hasDemoGuidedInterview && demoGuidedConfig
      ? demoGuidedConfig.title
      : (activeLeadingQuestions?.title ?? "");
  const leadingQuestions: LeadingQuestion[] =
    hasDemoGuidedInterview && demoGuidedConfig
      ? demoGuidedConfig.questions
      : (activeLeadingQuestions?.questions ?? []);
  const coverageMap = analysisResult
    ? new Map(analysisResult.coverage.map((item) => [item.id, item]))
    : undefined;

  const hasTranscript = page.transcriptEnglish.trim().length > 0;

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLeadingQuestions, setShowLeadingQuestions] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [captureMode, setCaptureMode] = useState<"singpass" | "interview">(
    "singpass"
  );
  const [showGuided, setShowGuided] = useState(false);

  const canRunGuided = page.leadingQuestionSet !== "none" || hasDemoGuidedInterview;
  const hasGuidedResponses = (page.questionResponses?.length ?? 0) > 0;

  const handleGuidedComplete = (result: GuidedInterviewResult) => {
    onGuidedComplete(result);
    setShowGuided(false);
  };

  const hasAnyTranscript =
    page.transcriptEnglish.trim().length > 0 ||
    page.transcriptOriginal.trim().length > 0;

  const transcriptBlock = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{transcriptLabel}</Label>
        {hasAnyTranscript ? (
          <div className="flex items-center gap-2">
            {canRevertClean ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRevertClean}
                disabled={isCleaning}
                className="text-gray-500 hover:text-gray-700"
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Undo
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemoveInterviewerQuestions}
              disabled={isCleaning}
            >
              {isCleaning ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scissors className="mr-1 h-3.5 w-3.5" />
              )}
              Remove interviewer questions
            </Button>
          </div>
        ) : null}
      </div>
      <Tabs defaultValue="english" className="mt-2">
        <TabsList>
          <TabsTrigger value="original">Original</TabsTrigger>
          <TabsTrigger value="english">English</TabsTrigger>
        </TabsList>
        <TabsContent value="original">
          <Textarea
            id={`${page.id}-transcript-original`}
            value={page.transcriptOriginal}
            onChange={(e) => onTranscriptOriginalChange(e.target.value)}
            rows={6}
            placeholder="Transcript in the language the interview was conducted..."
            className="font-mono text-sm"
          />
        </TabsContent>
        <TabsContent value="english">
          <Textarea
            id={`${page.id}-transcript-english`}
            value={page.transcriptEnglish}
            onChange={(e) => onTranscriptEnglishChange(e.target.value)}
            rows={6}
            placeholder="English transcript used for extraction and analysis..."
            className="font-mono text-sm"
          />
        </TabsContent>
      </Tabs>
    </div>
  );

  if (isProfile) {
    return (
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label
            htmlFor={`${page.id}-section`}
            className="text-xs font-medium text-gray-500"
          >
            Section
          </Label>
          <Select
            value={page.sectionId}
            onValueChange={(value) => onSectionChange(value as InterviewSectionId)}
            disabled={page.fixed}
          >
            <SelectTrigger
              id={`${page.id}-section`}
              className="h-9 w-auto min-w-[180px]"
            >
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              {INTERVIEW_SECTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <InterviewProgress stage={isTranscribing ? "transcribing" : null} />

        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
          <ToggleGroup
            type="single"
            variant="outline"
            value={captureMode}
            onValueChange={(value) => {
              if (!value) return;
              if (isRecordingActive && value !== "interview") {
                toast.warning(
                  "End the recording first — tap End to save and transcribe it."
                );
                return;
              }
              setCaptureMode(value as "singpass" | "interview");
            }}
            className="w-full bg-white"
          >
            <ToggleGroupItem value="singpass">Singpass</ToggleGroupItem>
            <ToggleGroupItem value="interview">Interview</ToggleGroupItem>
          </ToggleGroup>

          {captureMode === "singpass" ? (
            <div className="flex justify-center py-2">
              <SingpassRetrieveButton
                purpose="Your Myinfo data will be used to fill this interviewee's particulars in the statement."
                scopes={singpassScopes}
                onRetrieved={onSingpassRetrieved}
                size="lg"
              />
            </div>
          ) : (
            <InterviewRecordingCard
              chromeless
              interviewLanguage={page.interviewLanguage}
              onInterviewLanguageChange={onLanguageChange}
              onTranscriptsComplete={onTranscriptsComplete}
              onRecordingStart={onRecordingStart}
              onRecordingStop={onRecordingStop}
              appliedToastMessage="Transcript captured for this section"
              sticky
              floatingIndicator
              inlineProgress
              onProcessingChange={setIsTranscribing}
              onActiveChange={setIsRecordingActive}
            />
          )}
        </div>

        {isExtracting && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Extracting {section.label.toLowerCase()}...
          </p>
        )}

        <FieldGrid
          section={section}
          interviewee={interviewee}
          extractedKeys={extractedKeys}
          onFieldChange={onFieldChange}
        />

        {extractedKeys && extractedKeys.size > 0 ? (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            {extractedKeys.size} field(s) auto-filled
          </Badge>
        ) : null}

        <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
            >
              <ChevronDown
                className={`mr-1 h-4 w-4 transition-transform ${
                  showTranscript ? "rotate-180" : ""
                }`}
              />
              {showTranscript ? "Hide transcript" : "Show transcript"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">{transcriptBlock}</CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      {showGuided && (activeLeadingQuestions || hasDemoGuidedInterview) ? (
        <GuidedInterviewView
          intervieweeName={interviewee.name}
          questionSetTitle={guidedQuestionSetTitle}
          questions={leadingQuestions}
          interviewLanguage={page.interviewLanguage}
          initialResponses={page.questionResponses}
          demoMode={hasDemoGuidedInterview ? demoGuidedConfig?.demoMode : undefined}
          onComplete={handleGuidedComplete}
          onClose={() => setShowGuided(false)}
        />
      ) : null}

      {hasDemoGuidedInterview ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Demo interview — answers are pre-seeded. Recording animations run without
          calling transcription or analysis.
        </p>
      ) : null}

      <InterviewProgress stage={isAnalyzing ? "analyzing" : null} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${page.id}-leading-set`}>Leading question set</Label>
          <Select
            value={page.leadingQuestionSet}
            onValueChange={(value) =>
              onLeadingSetChange(value as LeadingQuestionSet)
            }
          >
            <SelectTrigger id={`${page.id}-leading-set`} className="w-full">
              <SelectValue placeholder="Select a set" />
            </SelectTrigger>
            <SelectContent>
              {LEADING_QUESTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${page.id}-setup-language`}>Interview language</Label>
          <Select
            value={page.interviewLanguage}
            onValueChange={(value) =>
              onLanguageChange(value as InterviewLanguage)
            }
          >
            <SelectTrigger id={`${page.id}-setup-language`} className="w-full">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {INTERVIEW_LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Wand2 className="h-4 w-4 text-primary" />
            Guided interview
          </p>
          <p className="text-xs text-gray-500">
            {canRunGuided
              ? hasDemoGuidedInterview
                ? "Step through 3 demo witness questions. Record each answer to see the animation; fixed transcripts are injected automatically."
                : "Step through each leading question, record answers one at a time, and get AI follow-ups as you go."
              : "Select a leading question set above to run the guided interview."}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            if (!canRunGuided) {
              toast.warning("Select a leading question set first.");
              return;
            }
            setShowGuided(true);
          }}
          disabled={!canRunGuided}
        >
          <Wand2 className="mr-2 h-5 w-5" />
          {hasGuidedResponses ? "Continue guided interview" : "Start guided interview"}
        </Button>
      </div>

      {hasTranscript ? (
        <div className="space-y-4">
          {transcriptBlock}

          {activeLeadingQuestions || hasDemoGuidedInterview ? (
            <>
              <Collapsible
                open={showLeadingQuestions}
                onOpenChange={setShowLeadingQuestions}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <ChevronDown
                        className={`mr-1 h-4 w-4 transition-transform ${
                          showLeadingQuestions ? "rotate-180" : ""
                        }`}
                      />
                      {showLeadingQuestions
                        ? "Hide leading questions"
                        : "Show leading questions"}
                    </Button>
                  </CollapsibleTrigger>
                  {!hasDemoGuidedInterview ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={
                        !page.transcriptEnglish.trim() ||
                        isAnalyzing ||
                        !isCoordinatorConfigured()
                      }
                      onClick={onAnalyze}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Re-analyze
                    </Button>
                  ) : null}
                </div>
                <CollapsibleContent className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Answers captured during the guided interview, with coverage
                    status and follow-up prompts.
                  </p>
                  <LeadingQuestionsPanel
                    title={guidedQuestionSetTitle}
                    questions={leadingQuestions}
                    interviewLanguage={page.interviewLanguage}
                    coverage={coverageMap}
                  />
                </CollapsibleContent>
              </Collapsible>

              {analysisResult && !hasDemoGuidedInterview ? (
                <Collapsible
                  open={showFollowUps}
                  onOpenChange={setShowFollowUps}
                  className="space-y-3"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <ChevronDown
                        className={`mr-1 h-4 w-4 transition-transform ${
                          showFollowUps ? "rotate-180" : ""
                        }`}
                      />
                      {showFollowUps
                        ? "Hide follow-up questions"
                        : "Show follow-up questions"}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <FollowUpsPanel
                      followUps={analysisResult.follow_ups}
                      interviewLanguage={page.interviewLanguage}
                      onAddToFacts={onAddFollowUpToFacts}
                    />
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
          Start the guided interview to record answers. The transcript, coverage
          status and AI follow-ups will appear here once you finish.
        </p>
      )}
    </div>
  );
}
