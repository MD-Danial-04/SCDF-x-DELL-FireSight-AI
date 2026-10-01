import { useCallback, useState } from "react";
import {
  createAnalyzePhotoJob,
  getInferenceJob,
  type CreateAnalyzePhotoJobContext,
} from "../lib/coordinatorApi";
import type { PhotoAnalysisResult } from "../types/photoAnalysis";

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 120;
const MAX_CONCURRENT_ANALYSES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PhotoAnalysisBatchItem {
  id: string;
  blob: Blob;
  fileName: string;
}

interface PhotoAnalysisProgress {
  done: number;
  total: number;
}

interface UsePhotoAnalysisState {
  isAnalyzing: boolean;
  error: string | null;
  progress: PhotoAnalysisProgress | null;
  runBatchAnalysis: (
    items: PhotoAnalysisBatchItem[],
    context?: CreateAnalyzePhotoJobContext,
  ) => Promise<Record<string, PhotoAnalysisResult>>;
}

async function pollPhotoAnalysisJob(jobId: string): Promise<PhotoAnalysisResult> {
  let job = await getInferenceJob(jobId);

  for (let i = 0; i < MAX_POLLS; i += 1) {
    if (job.status === "completed" || job.status === "failed") {
      break;
    }
    await sleep(POLL_INTERVAL_MS);
    job = await getInferenceJob(jobId);
  }

  if (job.status === "failed") {
    throw new Error(job.error ?? "Photo analysis failed");
  }
  if (job.status !== "completed" || !job.photo_analysis_result) {
    throw new Error("Photo analysis timed out");
  }

  return job.photo_analysis_result;
}

export function usePhotoAnalysis(): UsePhotoAnalysisState {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PhotoAnalysisProgress | null>(null);

  const runBatchAnalysis = useCallback(
    async (
      items: PhotoAnalysisBatchItem[],
      context?: CreateAnalyzePhotoJobContext,
    ): Promise<Record<string, PhotoAnalysisResult>> => {
      if (items.length === 0) {
        return {};
      }

      setIsAnalyzing(true);
      setError(null);
      setProgress({ done: 0, total: items.length });

      const results: Record<string, PhotoAnalysisResult> = {};
      let nextIndex = 0;
      let completed = 0;

      const worker = async (): Promise<void> => {
        while (nextIndex < items.length) {
          const item = items[nextIndex];
          nextIndex += 1;

          const job = await createAnalyzePhotoJob(item.blob, item.fileName, context);
          results[item.id] = await pollPhotoAnalysisJob(job.id);

          completed += 1;
          setProgress({ done: completed, total: items.length });
        }
      };

      try {
        const workerCount = Math.min(MAX_CONCURRENT_ANALYSES, items.length);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
        return results;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Photo analysis failed";
        setError(message);
        throw err;
      } finally {
        setIsAnalyzing(false);
        setProgress(null);
      }
    },
    [],
  );

  return {
    isAnalyzing,
    error,
    progress,
    runBatchAnalysis,
  };
}
