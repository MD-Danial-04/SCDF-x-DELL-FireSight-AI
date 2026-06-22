import { useCallback, useState } from "react";
import { getInferenceJob, requestJobExtraction } from "../lib/coordinatorApi";
import type { InferenceJob, InferenceResult, MessageType } from "../types/inference";

interface UseExtractionJobState {
  isExtracting: boolean;
  error: string | null;
  runExtraction: (params: {
    jobId: string;
    text: string;
    messageType: MessageType;
    incidentTypeName?: string;
  }) => Promise<InferenceJob>;
}

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useExtractionJob(): UseExtractionJobState {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runExtraction = useCallback(
    async ({
      jobId,
      text,
      messageType,
      incidentTypeName,
    }: {
      jobId: string;
      text: string;
      messageType: MessageType;
      incidentTypeName?: string;
    }): Promise<InferenceJob> => {
      setIsExtracting(true);
      setError(null);
      try {
        let job = await requestJobExtraction(jobId, {
          text,
          messageType,
          incidentTypeName,
        });

        for (let i = 0; i < MAX_POLLS; i += 1) {
          if (job.status === "completed" || job.status === "failed") {
            break;
          }
          await sleep(POLL_INTERVAL_MS);
          job = await getInferenceJob(jobId);
        }

        if (job.status === "failed") {
          throw new Error(job.error ?? "Extraction failed");
        }
        if (job.status !== "completed") {
          throw new Error("Extraction timed out");
        }
        return job;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Extraction failed";
        setError(message);
        throw err;
      } finally {
        setIsExtracting(false);
      }
    },
    []
  );

  return { isExtracting, error, runExtraction };
}

export type { InferenceResult };
