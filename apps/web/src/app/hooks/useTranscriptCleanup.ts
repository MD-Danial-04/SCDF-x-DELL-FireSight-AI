import { useCallback, useState } from "react";
import { createCleanTranscriptJob, getInferenceJob } from "../lib/coordinatorApi";
import type { CleanTranscriptResult, InterviewLanguage } from "../types/inference";

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UseTranscriptCleanupState {
  isCleaning: boolean;
  error: string | null;
  runCleanup: (
    original: string,
    english: string,
    interviewLanguage?: InterviewLanguage
  ) => Promise<CleanTranscriptResult>;
}

export function useTranscriptCleanup(): UseTranscriptCleanupState {
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCleanup = useCallback(
    async (
      original: string,
      english: string,
      interviewLanguage: InterviewLanguage = "en"
    ): Promise<CleanTranscriptResult> => {
      setIsCleaning(true);
      setError(null);
      try {
        let job = await createCleanTranscriptJob(original, english, interviewLanguage);

        for (let i = 0; i < MAX_POLLS; i += 1) {
          if (job.status === "completed" || job.status === "failed") {
            break;
          }
          await sleep(POLL_INTERVAL_MS);
          job = await getInferenceJob(job.id);
        }

        if (job.status === "failed") {
          throw new Error(job.error ?? "Transcript cleanup failed");
        }
        if (job.status !== "completed") {
          throw new Error("Transcript cleanup timed out");
        }

        return {
          original: (job.transcript_original ?? original) || "",
          english: (job.transcript_english ?? english) || "",
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transcript cleanup failed";
        setError(message);
        throw err;
      } finally {
        setIsCleaning(false);
      }
    },
    []
  );

  return { isCleaning, error, runCleanup };
}
