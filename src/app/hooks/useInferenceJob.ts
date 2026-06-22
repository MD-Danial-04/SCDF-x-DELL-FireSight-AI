import { useCallback, useEffect, useRef, useState } from "react";
import { createInferenceJob, getInferenceJob } from "../lib/coordinatorApi";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { InferenceJob, InferenceResult, JobStatus, MessageType } from "../types/inference";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES: JobStatus[] = ["completed", "failed"];

interface UseInferenceJobState {
  job: InferenceJob | null;
  isProcessing: boolean;
  error: string | null;
  submitJob: (
    file: Blob,
    messageType: MessageType,
    incidentTypeName?: string
  ) => Promise<void>;
  reset: () => void;
}

function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function useInferenceJob(): UseInferenceJobState {
  const [job, setJob] = useState<InferenceJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null>(
    null
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      void getSupabaseClient().removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const applyJobUpdate = useCallback(
    (updated: InferenceJob) => {
      setJob(updated);
      if (isTerminal(updated.status)) {
        setIsProcessing(false);
        stopPolling();
        cleanupChannel();
        activeJobIdRef.current = null;
        if (updated.status === "failed") {
          setError(updated.error ?? "Inference job failed");
        }
      }
    },
    [cleanupChannel, stopPolling]
  );

  const pollJobOnce = useCallback(
    async (jobId: string) => {
      try {
        const current = await getInferenceJob(jobId);
        applyJobUpdate(current);
      } catch (err) {
        console.warn("Job poll failed:", err);
      }
    },
    [applyJobUpdate]
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      activeJobIdRef.current = jobId;
      void pollJobOnce(jobId);
      pollRef.current = setInterval(() => {
        void pollJobOnce(jobId);
      }, POLL_INTERVAL_MS);
    },
    [pollJobOnce, stopPolling]
  );

  useEffect(
    () => () => {
      stopPolling();
      cleanupChannel();
    },
    [cleanupChannel, stopPolling]
  );

  const subscribeToJob = useCallback(
    (jobId: string) => {
      cleanupChannel();
      try {
        const supabase = getSupabaseClient();
        const channel = supabase
          .channel(`job:${jobId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "inference_jobs",
              filter: `id=eq.${jobId}`,
            },
            (payload) => {
              applyJobUpdate(payload.new as InferenceJob);
            }
          )
          .subscribe();
        channelRef.current = channel;
      } catch (err) {
        console.warn("Supabase Realtime unavailable, using polling only:", err);
      }
    },
    [applyJobUpdate, cleanupChannel]
  );

  const submitJob = useCallback(
    async (file: Blob, messageType: MessageType, incidentTypeName?: string) => {
      setError(null);
      setIsProcessing(true);
      try {
        const created = await createInferenceJob(file, messageType, incidentTypeName);
        applyJobUpdate(created);
        if (!isTerminal(created.status)) {
          subscribeToJob(created.id);
          startPolling(created.id);
        }
      } catch (err) {
        setIsProcessing(false);
        setError(err instanceof Error ? err.message : "Failed to submit inference job");
        throw err;
      }
    },
    [applyJobUpdate, startPolling, subscribeToJob]
  );

  const reset = useCallback(() => {
    stopPolling();
    cleanupChannel();
    activeJobIdRef.current = null;
    setJob(null);
    setIsProcessing(false);
    setError(null);
  }, [cleanupChannel, stopPolling]);

  return { job, isProcessing, error, submitJob, reset };
}

export type { InferenceResult };
