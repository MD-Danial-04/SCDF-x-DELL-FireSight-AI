import { useCallback, useState } from "react";
import {
  createAnalyzePhotoJob,
  getInferenceJob,
  type CreateAnalyzePhotoJobContext,
} from "../lib/coordinatorApi";
import type { PhotoAnalysisResult } from "../types/photoAnalysis";

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 120;

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
  analyzingPhotoIds: ReadonlySet<string>;
  error: string | null;
  progress: PhotoAnalysisProgress | null;
  runAnalysis: (
    file: Blob,
    fileName: string,
    context?: CreateAnalyzePhotoJobContext,
  ) => Promise<PhotoAnalysisResult>;
  runBatchAnalysis: (
    items: PhotoAnalysisBatchItem[],
    buildContext: (
      priorResults: Record<string, PhotoAnalysisResult>,
      currentItem: PhotoAnalysisBatchItem,
    ) => CreateAnalyzePhotoJobContext,
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
  const [analyzingPhotoIds, setAnalyzingPhotoIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PhotoAnalysisProgress | null>(null);

  const runAnalysis = useCallback(
    async (
      file: Blob,
      fileName: string,
      context?: CreateAnalyzePhotoJobContext,
    ): Promise<PhotoAnalysisResult> => {
      setIsAnalyzing(true);
      setError(null);
      try {
        const job = await createAnalyzePhotoJob(file, fileName, context);
        return await pollPhotoAnalysisJob(job.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Photo analysis failed";
        setError(message);
        throw err;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [],
  );

  const runBatchAnalysis = useCallback(
    async (
      items: PhotoAnalysisBatchItem[],
      buildContext: (
        priorResults: Record<string, PhotoAnalysisResult>,
        currentItem: PhotoAnalysisBatchItem,
      ) => CreateAnalyzePhotoJobContext,
    ): Promise<Record<string, PhotoAnalysisResult>> => {
      if (items.length === 0) {
        return {};
      }

      setIsAnalyzing(true);
      setError(null);
      setProgress({ done: 0, total: items.length });
      setAnalyzingPhotoIds(new Set(items.map((item) => item.id)));

      const results: Record<string, PhotoAnalysisResult> = {};

      try {
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          setAnalyzingPhotoIds(new Set([item.id]));

          const context = buildContext(results, item);
          const job = await createAnalyzePhotoJob(item.blob, item.fileName, context);
          results[item.id] = await pollPhotoAnalysisJob(job.id);

          setProgress({ done: index + 1, total: items.length });
        }

        return results;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Photo analysis failed";
        setError(message);
        throw err;
      } finally {
        setIsAnalyzing(false);
        setAnalyzingPhotoIds(new Set());
        setProgress(null);
      }
    },
    [],
  );

  return {
    isAnalyzing,
    analyzingPhotoIds,
    error,
    progress,
    runAnalysis,
    runBatchAnalysis,
  };
}
