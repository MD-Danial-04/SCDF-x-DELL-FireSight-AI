import { useCallback, useState } from "react";
import { createAnalyzeInterviewJob, getInferenceJob } from "../lib/coordinatorApi";
import type { AnalyzeInterviewResponse, InterviewQuestionInput } from "../types/interviewAnalysis";

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UseInterviewAnalysisState {
  isAnalyzing: boolean;
  error: string | null;
  runAnalysis: (
    transcript: string,
    questions: InterviewQuestionInput[]
  ) => Promise<AnalyzeInterviewResponse>;
}

export function useInterviewAnalysis(): UseInterviewAnalysisState {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(
    async (
      transcript: string,
      questions: InterviewQuestionInput[]
    ): Promise<AnalyzeInterviewResponse> => {
      setIsAnalyzing(true);
      setError(null);
      try {
        let job = await createAnalyzeInterviewJob(transcript, questions);

        for (let i = 0; i < MAX_POLLS; i += 1) {
          if (job.status === "completed" || job.status === "failed") {
            break;
          }
          await sleep(POLL_INTERVAL_MS);
          job = await getInferenceJob(job.id);
        }

        if (job.status === "failed") {
          throw new Error(job.error ?? "Interview analysis failed");
        }
        if (job.status !== "completed" || !job.analysis_result) {
          throw new Error("Interview analysis timed out");
        }

        return job.analysis_result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        setError(message);
        throw err;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  return { isAnalyzing, error, runAnalysis };
}
