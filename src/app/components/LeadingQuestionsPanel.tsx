import { Loader2 } from "lucide-react";
import {
  groupLeadingQuestionsBySection,
  type LeadingQuestion,
} from "../constants/leadingQuestions";
import type { InterviewLanguage } from "../types/interviewee";
import type {
  QuestionCoverage,
  QuestionCoverageStatus,
  TranslatedInterviewQuestion,
} from "../types/interviewAnalysis";
import { cn } from "./ui/utils";

interface LeadingQuestionsPanelProps {
  title: string;
  questions: LeadingQuestion[];
  interviewLanguage: InterviewLanguage;
  translatedQuestions?: Map<string, TranslatedInterviewQuestion>;
  isTranslating?: boolean;
  coverage?: Map<string, QuestionCoverage>;
}

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

export function LeadingQuestionsPanel({
  title,
  questions,
  interviewLanguage,
  translatedQuestions,
  isTranslating = false,
  coverage,
}: LeadingQuestionsPanelProps) {
  const sections = groupLeadingQuestionsBySection(questions);
  const showBilingual = interviewLanguage !== "en" && Boolean(translatedQuestions?.size);
  let questionNumber = 0;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-1">
          Use these prompts during the interview. Record responses in Facts revealed below.
          {coverage ? " Coverage status is shown after analysis." : ""}
          {isTranslating ? " Translating checklist..." : ""}
        </p>
        {isTranslating ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Preparing questions in the interview language
          </div>
        ) : null}
      </div>

      {sections.map(({ section, questions: sectionQuestions }) => {
        const sectionConduct =
          showBilingual &&
          sectionQuestions
            .map((q) => translatedQuestions?.get(q.id)?.section_conduct)
            .find(Boolean);

        return (
          <div key={section}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {sectionConduct || section}
            </p>
            {showBilingual && sectionConduct && sectionConduct !== section ? (
              <p className="text-[11px] text-gray-400 mb-2">{section}</p>
            ) : null}
            <ol className="space-y-2">
              {sectionQuestions.map((question) => {
                questionNumber += 1;
                const itemCoverage = coverage?.get(question.id);
                const translation = translatedQuestions?.get(question.id);
                const conductPrompt = translation?.prompt_conduct ?? question.prompt;
                const conductHint = translation?.hint_conduct ?? question.hint;

                return (
                  <li
                    key={question.id}
                    className="flex gap-2 text-sm text-gray-800"
                  >
                    <span className="font-mono text-xs text-gray-400 tabular-nums shrink-0 pt-0.5">
                      {questionNumber}.
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="flex-1 min-w-0">
                          <span className={showBilingual ? "font-medium" : undefined}>
                            {conductPrompt}
                          </span>
                          {conductHint ? (
                            <span className="block text-xs text-gray-500 mt-0.5">
                              {conductHint}
                            </span>
                          ) : null}
                          {showBilingual ? (
                            <>
                              <span className="block text-xs text-gray-400 mt-1">
                                {question.prompt}
                              </span>
                              {question.hint ? (
                                <span className="block text-[11px] text-gray-400">
                                  {question.hint}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </span>
                        {itemCoverage ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              STATUS_STYLES[itemCoverage.status]
                            )}
                            title={
                              itemCoverage.evidence
                                ? `Evidence: ${itemCoverage.evidence} (${Math.round(itemCoverage.confidence * 100)}% confidence)`
                                : `${STATUS_LABELS[itemCoverage.status]} (${Math.round(itemCoverage.confidence * 100)}% confidence)`
                            }
                          >
                            {STATUS_LABELS[itemCoverage.status]}
                          </span>
                        ) : null}
                      </div>
                      {itemCoverage?.evidence ? (
                        <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
                          {itemCoverage.evidence}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
