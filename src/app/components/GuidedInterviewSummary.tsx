import { Check, ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import type { GuidedQuestion } from "../hooks/useGuidedInterview";
import type {
  FollowUpSuggestion,
  QuestionCoverage,
  QuestionCoverageStatus,
} from "../types/interviewAnalysis";
import type { InterviewLanguage, QuestionResponse } from "../types/interviewee";
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

interface GuidedInterviewSummaryProps {
  queue: GuidedQuestion[];
  responses: Record<string, QuestionResponse>;
  coverage: Map<string, QuestionCoverage>;
  followUps: FollowUpSuggestion[];
  interviewLanguage: InterviewLanguage;
  isAnalyzing: boolean;
  canAnalyze: boolean;
  onReanalyze: () => void;
  onBack: () => void;
  onConfirm: () => void;
  onJumpToQuestion: (index: number) => void;
}

function hasAnswer(response: QuestionResponse | undefined): boolean {
  return Boolean(
    response &&
      (response.transcriptEnglish.trim() || response.transcriptOriginal.trim())
  );
}

export function GuidedInterviewSummary({
  queue,
  responses,
  coverage,
  followUps,
  interviewLanguage,
  isAnalyzing,
  canAnalyze,
  onReanalyze,
  onBack,
  onConfirm,
  onJumpToQuestion,
}: GuidedInterviewSummaryProps) {
  const showBilingual = interviewLanguage !== "en";
  const answeredCount = queue.filter((item) =>
    hasAnswer(responses[item.itemId])
  ).length;
  // Follow-ups already pulled into the queue are shown inline; surface only the
  // ones that have not been asked yet as outstanding suggestions.
  const queuedPrompts = new Set(
    queue.map((item) => item.promptConduct.trim().toLowerCase())
  );
  const outstandingFollowUps = followUps.filter((followUp) => {
    const item = queue.find(
      (q) =>
        q.promptConduct.trim().toLowerCase() ===
        followUp.prompt_conduct.trim().toLowerCase()
    );
    if (!item) return true;
    return !hasAnswer(responses[item.itemId]);
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-gray-900">Interview summary</p>
          <p className="text-xs text-gray-500">
            {answeredCount}/{queue.length} questions answered
            {outstandingFollowUps.length > 0
              ? ` · ${outstandingFollowUps.length} suggested follow-up${
                  outstandingFollowUps.length === 1 ? "" : "s"
                }`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAnalyze || isAnalyzing}
          onClick={onReanalyze}
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Re-analyse
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
          <ol className="space-y-3">
            {queue.map((item, index) => {
              const response = responses[item.itemId];
              const answered = hasAnswer(response);
              const itemCoverage = coverage.get(item.questionId);
              return (
                <li
                  key={item.itemId}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums",
                          answered
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {answered ? <Check className="h-4 w-4" /> : index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {item.promptConduct}
                        </p>
                        {showBilingual &&
                        item.promptEnglish !== item.promptConduct ? (
                          <p className="text-xs text-gray-400">
                            {item.promptEnglish}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.isFollowUp ? (
                        <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                          <Sparkles className="h-3 w-3" />
                          Follow-up
                        </span>
                      ) : null}
                      {itemCoverage ? (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            STATUS_STYLES[itemCoverage.status]
                          )}
                        >
                          {STATUS_LABELS[itemCoverage.status]}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {answered ? (
                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-green-300 pl-3 text-sm text-gray-800">
                      {response?.transcriptEnglish.trim() ||
                        response?.transcriptOriginal.trim()}
                    </p>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400">Not answered yet.</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onJumpToQuestion(index)}
                      >
                        Answer now
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {outstandingFollowUps.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <p className="text-sm font-semibold text-gray-800">
                Suggested follow-up questions
              </p>
              <p className="text-xs text-gray-500">
                Generated from the answers so far. Ask in the interview language;
                English is shown for your notes.
              </p>
              <ol className="mt-1 space-y-2">
                {outstandingFollowUps.map((followUp, index) => (
                  <li key={`follow-up-${index}`} className="text-sm text-gray-800">
                    <p className="font-medium">{followUp.prompt_conduct}</p>
                    {showBilingual &&
                    followUp.prompt_conduct !== followUp.prompt ? (
                      <p className="text-xs text-gray-400">{followUp.prompt}</p>
                    ) : null}
                    {followUp.reason ? (
                      <p className="text-xs text-gray-500">{followUp.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to questions
        </Button>
        <Button type="button" onClick={onConfirm}>
          <Check className="mr-2 h-4 w-4" />
          Save to report
        </Button>
      </div>
    </div>
  );
}
