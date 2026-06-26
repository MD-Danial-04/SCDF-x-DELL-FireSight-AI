import { useCallback, useEffect, useRef, useState } from "react";

// Preferred recording formats, most-compatible first. Chrome/Firefox produce
// WebM/Opus; Safari does not support WebM and produces MP4/AAC instead.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Whether the running browser supports pausing/resuming a MediaRecorder. */
export const MEDIA_RECORDER_PAUSE_SUPPORTED =
  typeof MediaRecorder !== "undefined" &&
  typeof MediaRecorder.prototype.pause === "function" &&
  typeof MediaRecorder.prototype.resume === "function";

export function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Exposed so callers can visualise the live input (e.g. an audio waveform).
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const start = useCallback(async () => {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    setStream(stream);

    // Pass an explicit mimeType only when supported; otherwise let the browser
    // pick its default (Safari throws on an unsupported mimeType like webm).
    const mimeType = pickSupportedMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.start(250);
    setIsRecording(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        stopStream();
        setIsRecording(false);
        setIsPaused(false);
        reject(new Error("No active recording"));
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        stopStream();
        setIsRecording(false);
        setIsPaused(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, [stopStream]);

  return {
    isRecording,
    isPaused,
    stream,
    pauseSupported: MEDIA_RECORDER_PAUSE_SUPPORTED,
    start,
    pause,
    resume,
    stop,
  };
}
