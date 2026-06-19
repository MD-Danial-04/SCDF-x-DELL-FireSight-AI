import {
  groupLeadingQuestionsBySection,
  type LeadingQuestion,
} from "../constants/leadingQuestions";

interface LeadingQuestionsPanelProps {
  title: string;
  questions: LeadingQuestion[];
}

export function LeadingQuestionsPanel({
  title,
  questions,
}: LeadingQuestionsPanelProps) {
  const sections = groupLeadingQuestionsBySection(questions);
  let questionNumber = 0;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-1">
          Use these prompts during the interview. Record responses in Facts revealed below.
        </p>
      </div>

      {sections.map(({ section, questions: sectionQuestions }) => (
        <div key={section}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            {section}
          </p>
          <ol className="space-y-2">
            {sectionQuestions.map((question) => {
              questionNumber += 1;
              return (
                <li
                  key={question.id}
                  className="flex gap-2 text-sm text-gray-800"
                >
                  <span className="font-mono text-xs text-gray-400 tabular-nums shrink-0 pt-0.5">
                    {questionNumber}.
                  </span>
                  <span>
                    {question.prompt}
                    {question.hint ? (
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {question.hint}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
