import { useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
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
}: InterviewRecordingCardProps) {
  const { isRecording, recordingTime, start, stop, formatTime } = useRecordingTimer();
  const {
    isRecording: isMediaRecording,
    start: startMediaRecording,
    stop: stopMediaRecording,
  } = useMediaRecorder();
  const { job, isProcessing, error: inferenceError, submitTranscription } = useTranscriptionJob();
  const appliedJobIdRef = useRef<string | null>(null);

  const useLiveInference = isInferenceConfigured();
  const isActivelyRecording = useLiveInference ? isMediaRecording : isRecording;

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

  const handleRecord = async () => {
    if (useLiveInference) {
      if (!isMediaRecording) {
        try {
          await startMediaRecording();
          start();
          onRecordingStart?.(formatClockTime(new Date()));
        } catch {
          toast.error("Microphone access denied");
        }
        return;
      }

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

    if (!isRecording) {
      start();
      onRecordingStart?.(formatClockTime(new Date()));
      toast.info("Enter the transcript in Facts revealed below, then stop the timer");
    } else {
      stop();
      onRecordingStop?.(formatClockTime(new Date()));
      toast.success("Recording stopped — continue in Facts revealed below");
    }
  };

  return (
    <Card className={cn("rounded-xl shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {isProcessing
            ? "Transcribing and translating — please wait..."
            : isActivelyRecording
              ? useLiveInference
                ? "Recording in progress — stop when finished to transcribe"
                : "Recording in progress — enter transcript in Facts revealed below, then stop"
              : description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showLanguageSelect && (
          <div className="space-y-2">
            <Label htmlFor="interview-language">Interview language</Label>
            <Select
              value={interviewLanguage}
              onValueChange={(value) => onInterviewLanguageChange(value as InterviewLanguage)}
              disabled={isActivelyRecording || isProcessing}
            >
              <SelectTrigger id="interview-language" className="w-full max-w-sm">
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
        )}

        <div className="flex items-center justify-center gap-3 border-b pb-4">
          {(isActivelyRecording || isProcessing) && (
            <span className="text-sm font-mono text-primary tabular-nums">
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                formatTime(recordingTime)
              )}
            </span>
          )}
          <Button
            onClick={handleRecord}
            size="lg"
            variant={isActivelyRecording ? "secondary" : "default"}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Transcribing...
              </>
            ) : isActivelyRecording ? (
              <>
                <MicOff className="mr-2 h-5 w-5" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="mr-2 h-5 w-5" />
                Start Recording
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
