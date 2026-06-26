import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Mic, Pause, Play, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AiProcessingDialog } from "./AiProcessingDialog";
import { AudioWaveform } from "./AudioWaveform";
import { useRecordingTimer } from "../hooks/useRecordingTimer";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useTranscriptionJob } from "../hooks/useTranscriptionJob";
import { isInferenceConfigured } from "../types/inference";
import {
  INTERVIEW_LANGUAGE_OPTIONS,
  type InterviewLanguage,
} from "../types/interviewee";
import { cn } from "./ui/utils";

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface InterviewRecordingCardProps {
  title?: string;
  description?: string;
  interviewLanguage: InterviewLanguage;
  onInterviewLanguageChange: (language: InterviewLanguage) => void;
  onTranscriptsComplete: (original: string, english: string, jobId: string) => void;
  onRecordingStart?: (startTime: string) => void;
  onRecordingStop?: (endTime: string) => void;
  showLanguageSelect?: boolean;
  appliedToastMessage?: string;
  className?: string;
  compact?: boolean;
  /** Pin the card to the top of the viewport while a recording is active. */
  sticky?: boolean;
  /**
   * Render a fixed floating "REC" pill (dot + timer + Stop) over the page while
   * a recording is active, so the recording stays visible/controllable as the
   * user scrolls away from the card.
   */
  floatingIndicator?: boolean;
  /**
   * Suppress the blocking processing dialog and report transcription progress
   * via onProcessingChange so the parent can render inline staged progress.
   */
  inlineProgress?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
  /**
   * Report whether a recording is currently active (recording or paused) so a
   * parent can prevent navigating away and silently discarding the capture.
   */
  onActiveChange?: (isActive: boolean) => void;
  /**
   * Render without the Card chrome (no header/title/description) as a single
   * inline action row — used when the recorder shares a row with other actions.
   */
  chromeless?: boolean;
  /** Node rendered at the start of the action row (e.g. a Singpass button). */
  leadingAction?: ReactNode;
}

export function InterviewRecordingCard({
  title = "Record interview",
  description = "Select the interview language, record, then review the original and English transcripts below",
  interviewLanguage,
  onInterviewLanguageChange,
  onTranscriptsComplete,
  onRecordingStart,
  onRecordingStop,
  showLanguageSelect = true,
  appliedToastMessage = "Transcripts applied to Facts revealed",
  className,
  compact = false,
  sticky = false,
  floatingIndicator = false,
  inlineProgress = false,
  onProcessingChange,
  onActiveChange,
  chromeless = false,
  leadingAction,
}: InterviewRecordingCardProps) {
  const {
    isRecording,
    isPaused: isTimerPaused,
    recordingTime,
    start,
    stop,
    pause: pauseTimer,
    resume: resumeTimer,
    formatTime,
  } = useRecordingTimer();
  const {
    isRecording: isMediaRecording,
    isPaused: isMediaPaused,
    pauseSupported: isMediaPauseSupported,
    stream: mediaStream,
    start: startMediaRecording,
    pause: pauseMediaRecording,
    resume: resumeMediaRecording,
    stop: stopMediaRecording,
  } = useMediaRecorder();
  const { job, isProcessing, error: inferenceError, submitTranscription } = useTranscriptionJob();
  const appliedJobIdRef = useRef<string | null>(null);

  const useLiveInference = isInferenceConfigured();
  const isActivelyRecording = useLiveInference ? isMediaRecording : isRecording;
  const isPaused = useLiveInference ? isMediaPaused : isTimerPaused;
  // The manual (timer-only) path can always pause; live recording depends on
  // MediaRecorder.pause support (absent on some older Safari versions).
  const canPause = useLiveInference ? isMediaPauseSupported : true;

  useEffect(() => {
    if (job?.status !== "transcribed" || job.id === appliedJobIdRef.current) {
      return;
    }
    const english = (job.transcript_english ?? job.transcript ?? "").trim();
    const original = (job.transcript_original ?? english).trim();
    if (!english && !original) {
      return;
    }
    appliedJobIdRef.current = job.id;
    onTranscriptsComplete(original, english, job.id);
    toast.success(appliedToastMessage);
  }, [job, onTranscriptsComplete, appliedToastMessage]);

  useEffect(() => {
    if (inferenceError) {
      toast.error(inferenceError);
    }
  }, [inferenceError]);

  useEffect(() => {
    onProcessingChange?.(isProcessing);
  }, [isProcessing, onProcessingChange]);

  useEffect(() => {
    onActiveChange?.(isActivelyRecording);
  }, [isActivelyRecording, onActiveChange]);

  useEffect(() => () => onActiveChange?.(false), [onActiveChange]);

  const handleStart = async () => {
    if (useLiveInference) {
      try {
        await startMediaRecording();
        start();
        onRecordingStart?.(formatClockTime(new Date()));
      } catch {
        toast.error("Microphone access denied");
      }
      return;
    }

    start();
    onRecordingStart?.(formatClockTime(new Date()));
    toast.info("Enter the transcript in Facts revealed below, then end the recording");
  };

  const handlePauseResume = () => {
    if (isPaused) {
      if (useLiveInference) resumeMediaRecording();
      resumeTimer();
      return;
    }
    if (useLiveInference) pauseMediaRecording();
    pauseTimer();
  };

  const handleEnd = async () => {
    if (useLiveInference) {
      stop();
      try {
        const blob = await stopMediaRecording();
        onRecordingStop?.(formatClockTime(new Date()));
        toast.info("Processing recording...");
        await submitTranscription(blob, "interview", interviewLanguage);
      } catch {
        toast.error("Failed to submit recording");
      }
      return;
    }

    stop();
    onRecordingStop?.(formatClockTime(new Date()));
    toast.success("Recording stopped — continue in Facts revealed below");
  };

  const stickyActive = sticky && isActivelyRecording;
  const showFloatingIndicator =
    floatingIndicator && isActivelyRecording && typeof document !== "undefined";

  const languageSelect = showLanguageSelect ? (
    <div className={chromeless ? "w-full sm:w-auto" : "space-y-2"}>
      {!chromeless && (
        <Label htmlFor="interview-language">Interview language</Label>
      )}
      <Select
        value={interviewLanguage}
        onValueChange={(value) => onInterviewLanguageChange(value as InterviewLanguage)}
        disabled={isActivelyRecording || isProcessing}
      >
        <SelectTrigger
          id="interview-language"
          aria-label="Interview language"
          className={chromeless ? "h-10 w-full sm:w-48" : "w-full max-w-sm sm:w-56"}
        >
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {INTERVIEW_LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;

  const recordButtons = (
    <div className="flex items-center gap-3">
      {(isActivelyRecording || isProcessing) && (
        <span className="text-sm font-mono text-primary tabular-nums">
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            formatTime(recordingTime)
          )}
        </span>
      )}
      {isActivelyRecording && !isProcessing ? (
        <>
          {canPause && (
            <Button
              type="button"
              onClick={handlePauseResume}
              size="lg"
              variant="outline"
            >
              {isPaused ? (
                <>
                  <Play className="mr-2 h-5 w-5 fill-current" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-5 w-5 fill-current" />
                  Pause
                </>
              )}
            </Button>
          )}
          <Button type="button" onClick={handleEnd} size="lg" variant="secondary">
            <Square className="mr-2 h-5 w-5 fill-current" />
            End
          </Button>
        </>
      ) : (
        <Button
          onClick={handleStart}
          size="lg"
          variant="default"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Transcribing...
            </>
          ) : (
            <>
              <Mic className="mr-2 h-5 w-5" />
              Start Recording
            </>
          )}
        </Button>
      )}
    </div>
  );

  const actionRow = chromeless ? (
    <div className="flex w-full flex-wrap items-center gap-3">
      {leadingAction}
      {languageSelect}
      {recordButtons}
    </div>
  ) : (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      {languageSelect}
      {recordButtons}
    </div>
  );

  const activeWaveform =
    isActivelyRecording && !isProcessing ? (
      <div className="flex items-center justify-center gap-3 pt-1">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {!isPaused && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              isPaused ? "bg-amber-500" : "bg-red-600"
            )}
          />
        </span>
        <AudioWaveform
          active={isActivelyRecording}
          paused={isPaused}
          stream={useLiveInference ? mediaStream : null}
          className="h-9 w-full max-w-xs"
          barClassName={isPaused ? "bg-amber-500/70" : "bg-red-500/80"}
        />
      </div>
    ) : null;

  return (
    <>
      {!inlineProgress && <AiProcessingDialog open={isProcessing} kind="transcription" />}
      {showFloatingIndicator &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-red-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span className="relative flex h-2.5 w-2.5">
              {!isPaused && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  isPaused ? "bg-amber-500" : "bg-red-600"
                )}
              />
            </span>
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                isPaused ? "text-amber-600" : "text-red-600"
              )}
            >
              {isPaused ? "Paused" : "Rec"}
            </span>
            <AudioWaveform
              active={isActivelyRecording}
              paused={isPaused}
              stream={useLiveInference ? mediaStream : null}
              barCount={14}
              className="h-5 w-20"
              barClassName="w-[2px] bg-red-500/80"
            />
            <span className="font-mono text-sm text-gray-800 tabular-nums">
              {formatTime(recordingTime)}
            </span>
            {canPause && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handlePauseResume}
                className="h-8"
              >
                {isPaused ? (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    Pause
                  </>
                )}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleEnd}
              className="h-8"
            >
              <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
              End
            </Button>
          </div>,
          document.body
        )}
      {chromeless ? (
        <div
          className={cn(
            "space-y-4",
            stickyActive &&
              "sticky top-0 z-20 rounded-xl border border-primary/40 bg-white/95 p-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-white/80",
            className
          )}
        >
          {actionRow}
          {activeWaveform}
        </div>
      ) : (
        <Card
          className={cn(
            "rounded-xl",
            compact ? "gap-4 border-gray-200" : "shadow-sm",
            stickyActive &&
              "sticky top-0 z-20 border-primary/40 bg-white/95 shadow-md backdrop-blur supports-[backdrop-filter]:bg-white/80",
            className
          )}
        >
          <CardHeader className={compact ? "px-4 pt-4" : undefined}>
            <CardTitle
              className={
                compact ? "text-sm font-semibold text-gray-800" : "text-base"
              }
            >
              {title}
            </CardTitle>
            <CardDescription className={compact ? "text-xs text-gray-500" : undefined}>
              {isProcessing
                ? "Transcribing and translating — please wait..."
                : isPaused
                  ? "Recording paused — resume to continue, or end to finish"
                  : isActivelyRecording
                    ? useLiveInference
                      ? "Recording in progress — pause to take a break, or end when finished to transcribe"
                      : "Recording in progress — enter transcript in Facts revealed below, then end"
                    : description}
            </CardDescription>
          </CardHeader>
          <CardContent className={cn("space-y-4", compact && "px-4 pb-4")}>
            {actionRow}
            {activeWaveform}
          </CardContent>
        </Card>
      )}
    </>
  );
}
