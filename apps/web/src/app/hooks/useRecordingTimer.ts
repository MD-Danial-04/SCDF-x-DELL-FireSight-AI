import { useCallback, useEffect, useRef, useState } from "react";

export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function useRecordingTimer() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const tick = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const start = useCallback(() => {
    clearTimer();
    setIsRecording(true);
    setIsPaused(false);
    setRecordingTime(0);
    tick();
  }, [clearTimer, tick]);

  const stop = useCallback(() => {
    clearTimer();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
  }, [clearTimer]);

  // Pause/resume keep the elapsed time; only the ticking interval is toggled.
  const pause = useCallback(() => {
    clearTimer();
    setIsPaused(true);
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsPaused(false);
    tick();
  }, [tick]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    start,
    stop,
    pause,
    resume,
    toggle,
    formatTime: formatRecordingTime,
  };
}
