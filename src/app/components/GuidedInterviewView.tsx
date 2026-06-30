import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AudioWaveform } from "./AudioWaveform";
import { GuidedInterviewSummary } from "./GuidedInterviewSummary";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import {
  useGuidedInterview,
  type GuidedInterviewDemoMode,
  type GuidedInterviewResult,
  type GuidedQuestion,
} from "../hooks/useGuidedInterview";
import type { LeadingQuestion } from "../constants/leadingQuestions";
import type { QuestionCoverageStatus } from "../types/interviewAnalysis";
import {
  INTERVIEW_LANGUAGE_SPOKEN_LABELS,
  type InterviewLanguage,
  type QuestionResponse,
} from "../types/interviewee";
import { cn } from "./ui/utils";

const STATUS_LABELS: Record<QuestionCoverageStatus, string> = {
  answered: "Answered",
  partial: "Partial",
  unanswered: "Unanswered",
  unclear: "Unclear",
};

const STATUS_STYLES: Record<QuestionCoverageStatus, string> = {
  answered: "bg-green-100 text-green-800 border-green-200",
  partial: "bg-amber-100 text-amber-800 border-amber-200",
  unanswered: "bg-gray-100 text-gray-600 border-gray-200",
  unclear: "bg-orange-100 text-orange-800 border-orange-200",
};

interface GuidedInterviewViewProps {
  intervieweeName?: string;
  questionSetTitle: string;
  questions: LeadingQuestion[];
  interviewLanguage: InterviewLanguage;
  initialResponses?: QuestionResponse[];
  demoMode?: GuidedInterviewDemoMode;
  onComplete: (result: GuidedInterviewResult) => void;
  onClose: () => void;
}

function hasAnswer(response: QuestionResponse | undefined): boolean {
  return Boolean(
    response &&
      (response.transcriptEnglish.trim() || response.transcriptOriginal.trim())
  );
}

export function GuidedInterviewView({
  intervieweeName,
  questionSetTitle,
  questions,
  interviewLanguage,
  initialResponses,
  demoMode,
  onComplete,
  onClose,
}: GuidedInterviewViewProps) {
  const guided = useGuidedInterview({
    questions,
    interviewLanguage,
    initialResponses,
    demoMode,
  });
  const [showSummary, setShowSummary] = useState(false);

  const showBilingual = interviewLanguage !== "en";
  const total = guided.queue.length;
  const current = guided.current;
  const currentResponse = current ? guided.responses[current.itemId] : undefined;
  const currentCoverage = current ? guided.coverage.get(current.questionId) : undefined;

  // Lock background scroll while the overlay is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const guardRecording = (): boolean => {
    if (guided.isRecording) {
      toast.warning("Stop the current answer first — tap Stop to save and transcribe it.");
      return false;
    }
    return true;
  };

  const handleClose = () => {
    if (!guardRecording()) return;
    onClose();
  };

  const handleNavigate = (action: () => void) => {
    if (!guardRecording()) return;
    action();
  };

  // If a continuous recording is live, flush its final segment and release the
  // mic before opening the review summary; otherwise just open it.
  const handleFinish = async () => {
    if (guided.isRecording) {
      await guided.finishRecording();
    }
    setShowSummary(true);
  };

  const handleConfirm = () => {
    onComplete(guided.buildResult());
  };

  const overlay = (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            Guided interview{intervieweeName ? ` — ${intervieweeName}` : ""}
          </p>
          <p className="truncate text-xs text-gray-500">
            {questionSetTitle} ·{" "}
            {INTERVIEW_LANGUAGE_SPOKEN_LABELS[interviewLanguage]} ·{" "}
            {guided.answeredCount}/{total} answered
          </p>
        </div>
        <div className="flex items-center gap-2">
          {guided.isAnalyzing ? (
            <span className="hidden items-center gap-1.5 text-xs text-blue-600 sm:flex">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Analysing follow-ups…
            </span>
          ) : null}
          <Button type="button" variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {showSummary ? (
        <GuidedInterviewSummary
          queue={guided.queue}
          responses={guided.responses}
          coverage={guided.coverage}
          followUps={guided.followUps}
          interviewLanguage={interviewLanguage}
          isAnalyzing={guided.isAnalyzing}
          canAnalyze={guided.canAnalyze}
          onReanalyze={guided.reanalyze}
          onBack={() => setShowSummary(false)}
          onConfirm={handleConfirm}
          onJumpToQuestion={(index) => {
            setShowSummary(false);
            guided.goTo(index);
          }}
        />
      ) : (
        <>
          {/* Progress rail */}
          <div className="border-b border-gray-200 bg-white px-4 py-2 sm:px-6">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {guided.queue.map((item, index) => {
                const answered = hasAnswer(guided.responses[item.itemId]);
                const transcribing = guided.transcribingItems.has(item.itemId);
                // Asked = a segment was captured for this question, even if the
                // transcript has not returned yet (or came back empty).
                const askedPending =
                  guided.askedItems.has(item.itemId) && !answered;
                const active = index === guided.currentIndex;
                return (
                  <button
                    key={item.itemId}
                    type="button"
                    onClick={() => handleNavigate(() => guided.goTo(index))}
                    aria-current={active}
                    disabled={guided.isRecording && !active}
                    className={cn(
                      "flex h-7 min-w-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium tabular-nums transition-colors",
                      guided.isRecording && !active && "cursor-not-allowed opacity-60",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : answered
                          ? "border-green-300 bg-green-50 text-green-700"
                          : askedPending
                            ? "border-amber-300 bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : item.isFollowUp
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                    )}
                  >
                    {transcribing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    {item.isFollowUp ? <Sparkles className="h-3 w-3" /> : null}
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-5xl items-stretch gap-2 px-2 py-6 sm:gap-4 sm:px-6">
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous question"
                  className="h-12 w-12 rounded-full shadow-sm"
                  disabled={guided.currentIndex <= 0 || guided.isRecording}
                  onClick={() => handleNavigate(guided.prev)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              </div>

              <div className="min-w-0 flex-1 space-y-5">
              {current ? (
                <>
                  <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Question {guided.currentIndex + 1} of {total}
                      </span>
                      {current.section ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {current.section}
                        </span>
                      ) : null}
                      {current.isFollowUp ? (
                        <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          <Sparkles className="h-3 w-3" />
                          AI follow-up
                        </span>
                      ) : null}
                      {currentCoverage ? (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            STATUS_STYLES[currentCoverage.status]
                          )}
                        >
                          {STATUS_LABELS[currentCoverage.status]}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xl font-semibold leading-snug text-gray-900 sm:text-2xl">
                      {current.promptConduct}
                    </p>
                    {showBilingual && current.promptEnglish !== current.promptConduct ? (
                      <p className="text-sm text-gray-500">{current.promptEnglish}</p>
                    ) : null}
                    {current.hintConduct ? (
                      <p className="text-sm text-gray-500">
                        {current.hintConduct}
                        {showBilingual &&
                        current.hintEnglish &&
                        current.hintEnglish !== current.hintConduct
                          ? ` (${current.hintEnglish})`
                          : ""}
                      </p>
                    ) : null}
                    {current.isFollowUp && current.reason ? (
                      <p className="rounded-lg bg-blue-50/70 px-3 py-2 text-xs text-blue-700">
                        {current.reason}
                      </p>
                    ) : null}
                  </div>

                  <RecorderPanel
                    guided={guided}
                    item={current}
                    isLast={guided.currentIndex >= total - 1}
                    onFinish={() => void handleFinish()}
                  />

                  <AnswerPanel
                    guided={guided}
                    item={current}
                    response={currentResponse}
                    showBilingual={showBilingual}
                  />
                </>
              ) : null}
              </div>

              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next question"
                  className="h-12 w-12 rounded-full shadow-sm"
                  disabled={guided.currentIndex >= total - 1 || guided.isRecording}
                  onClick={() => handleNavigate(guided.next)}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <Button type="button" onClick={handleFinish}>
              Finish & review
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

function RecorderPanel({
  guided,
  item,
  isLast,
  onFinish,
}: {
  guided: ReturnType<typeof useGuidedInterview>;
  item: GuidedQuestion;
  isLast: boolean;
  onFinish: () => void;
}) {
  const transcribing = guided.transcribingItems.has(item.itemId);
  const hasResponse = hasAnswer(guided.responses[item.itemId]);

  if (!guided.useRecordingUi) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 bg-white p-3 text-xs text-gray-500">
        Live transcription is not configured. Type the interviewee's answer in the
        box below.
      </p>
    );
  }

  if (transcribing) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Transcribing answer…
      </div>
    );
  }

  if (guided.isRecording) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {!guided.isPaused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full",
                guided.isPaused ? "bg-amber-500" : "bg-red-600"
              )}
            />
          </span>
          <AudioWaveform
            active={guided.isRecording}
            paused={guided.isPaused}
            stream={guided.stream}
            className="h-9 w-full max-w-xs"
            barClassName={guided.isPaused ? "bg-amber-500/70" : "bg-red-500/80"}
          />
          <span className="font-mono text-sm tabular-nums text-gray-800">
            {guided.formatTime(guided.recordingTime)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {guided.pauseSupported && (
            <Button type="button" variant="outline" onClick={guided.pauseRecording}>
              {guided.isPaused ? (
                <>
                  <Play className="mr-2 h-4 w-4 fill-current" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4 fill-current" />
                  Pause
                </>
              )}
            </Button>
          )}
          {isLast ? (
            <Button type="button" onClick={onFinish}>
              <Check className="mr-2 h-4 w-4" />
              Stop &amp; finish
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void guided.skipRecording()}
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Skip
              </Button>
              <Button
                type="button"
                onClick={() => void guided.advanceRecording()}
              >
                Next question
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void guided.stopRecording()}
          >
            <Square className="mr-2 h-4 w-4 fill-current" />
            Stop recording
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Button
        type="button"
        size="lg"
        onClick={() => void guided.startRecording()}
      >
        {hasResponse ? (
          <>
            <RotateCcw className="mr-2 h-5 w-5" />
            Re-record answer
          </>
        ) : (
          <>
            <Mic className="mr-2 h-5 w-5" />
            Record answer
          </>
        )}
      </Button>
    </div>
  );
}

function AnswerPanel({
  guided,
  item,
  response,
  showBilingual,
}: {
  guided: ReturnType<typeof useGuidedInterview>;
  item: GuidedQuestion;
  response: QuestionResponse | undefined;
  showBilingual: boolean;
}) {
  if (!guided.useRecordingUi) {
    return (
      <div>
        <Textarea
          value={response?.transcriptEnglish ?? ""}
          onChange={(e) => guided.setManualAnswer(item.itemId, e.target.value)}
          rows={5}
          placeholder="Type the interviewee's answer…"
          className="font-mono text-sm"
        />
      </div>
    );
  }

  if (!response || !hasAnswer(response)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Answer transcript
      </p>
      {showBilingual ? (
        <Tabs defaultValue="english">
          <TabsList>
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="english">English</TabsTrigger>
          </TabsList>
          <TabsContent value="original">
            <Textarea
              value={response.transcriptOriginal}
              onChange={(e) =>
                guided.editAnswer(item.itemId, { original: e.target.value })
              }
              rows={5}
              className="font-mono text-sm"
            />
          </TabsContent>
          <TabsContent value="english">
            <Textarea
              value={response.transcriptEnglish}
              onChange={(e) =>
                guided.editAnswer(item.itemId, { english: e.target.value })
              }
              rows={5}
              className="font-mono text-sm"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Textarea
          value={response.transcriptEnglish}
          onChange={(e) =>
            guided.editAnswer(item.itemId, {
              original: e.target.value,
              english: e.target.value,
            })
          }
          rows={5}
          className="font-mono text-sm"
        />
      )}
    </div>
  );
}
