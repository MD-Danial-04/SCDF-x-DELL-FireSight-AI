import { useCallback, useState } from "react";
import { createTranslateQuestionsJob, getInferenceJob } from "../lib/coordinatorApi";
import type { InterviewLanguage } from "../types/inference";
import type {
  InterviewQuestionInput,
  QuestionTranslationResult,
  TranslatedInterviewQuestion,
} from "../types/interviewAnalysis";

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuestionTranslationResult(
  result: unknown
): result is QuestionTranslationResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "questions" in result &&
    Array.isArray((result as QuestionTranslationResult).questions)
  );
}

interface UseQuestionTranslationState {
  isTranslating: boolean;
  error: string | null;
  translateQuestions: (
    questions: InterviewQuestionInput[],
    interviewLanguage: InterviewLanguage
  ) => Promise<Map<string, TranslatedInterviewQuestion>>;
}

export function useQuestionTranslation(): UseQuestionTranslationState {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translateQuestions = useCallback(
    async (
      questions: InterviewQuestionInput[],
      interviewLanguage: InterviewLanguage
    ): Promise<Map<string, TranslatedInterviewQuestion>> => {
      if (interviewLanguage === "en") {
        return new Map(
          questions.map((q) => [
            q.id,
            {
              id: q.id,
              prompt_conduct: q.prompt,
              hint_conduct: q.hint ?? null,
              section_conduct: q.section ?? null,
            },
          ])
        );
      }

      setIsTranslating(true);
      setError(null);
      try {
        let job = await createTranslateQuestionsJob(questions, interviewLanguage);

        for (let i = 0; i < MAX_POLLS; i += 1) {
          if (job.status === "completed" || job.status === "failed") {
            break;
          }
          await sleep(POLL_INTERVAL_MS);
          job = await getInferenceJob(job.id);
        }

        if (job.status === "failed") {
          throw new Error(job.error ?? "Question translation failed");
        }
        if (job.status !== "completed" || !isQuestionTranslationResult(job.analysis_result)) {
          throw new Error("Question translation timed out");
        }

        return new Map(job.analysis_result.questions.map((q) => [q.id, q]));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Translation failed";
        setError(message);
        throw err;
      } finally {
        setIsTranslating(false);
      }
    },
    []
  );

  return { isTranslating, error, translateQuestions };
}
