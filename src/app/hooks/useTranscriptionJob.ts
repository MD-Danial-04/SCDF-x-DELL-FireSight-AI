import { useCallback, useEffect, useRef, useState } from "react";
import { createInferenceJob, getInferenceJob } from "../lib/coordinatorApi";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { InferenceJob, JobStatus, MessageType } from "../types/inference";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES: JobStatus[] = ["transcribed", "failed"];

interface UseTranscriptionJobState {
  job: InferenceJob | null;
  isProcessing: boolean;
  error: string | null;
  submitTranscription: (file: Blob, messageType?: MessageType) => Promise<void>;
  reset: () => void;
}

function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function useTranscriptionJob(): UseTranscriptionJobState {
  const [job, setJob] = useState<InferenceJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null>(
    null
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        if (updated.status === "failed") {
          setError(updated.error ?? "Transcription failed");
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
        console.warn("Transcription poll failed:", err);
      }
    },
    [applyJobUpdate]
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
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

  const submitTranscription = useCallback(
    async (file: Blob, messageType: MessageType = "stop_message") => {
      setError(null);
      setIsProcessing(true);
      try {
        const created = await createInferenceJob(file, messageType);
        applyJobUpdate(created);
        if (!isTerminal(created.status)) {
          subscribeToJob(created.id);
          startPolling(created.id);
        }
      } catch (err) {
        setIsProcessing(false);
        setError(err instanceof Error ? err.message : "Failed to submit recording");
        throw err;
      }
    },
    [applyJobUpdate, startPolling, subscribeToJob]
  );

  const reset = useCallback(() => {
    stopPolling();
    cleanupChannel();
    setJob(null);
    setIsProcessing(false);
    setError(null);
  }, [cleanupChannel, stopPolling]);

  return { job, isProcessing, error, submitTranscription, reset };
}
