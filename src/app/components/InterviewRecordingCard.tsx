import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { useRecordingTimer } from "../hooks/useRecordingTimer";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useTranscriptionJob } from "../hooks/useTranscriptionJob";
import { isInferenceConfigured } from "../types/inference";
import { cn } from "./ui/utils";

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface InterviewRecordingCardProps {
  title?: string;
  description?: string;
  initialTranscript?: string;
  onStop: (transcript: string) => void;
  onRecordingStart?: (startTime: string) => void;
  onRecordingStop?: (endTime: string) => void;
  className?: string;
}

export function InterviewRecordingCard({
  title = "Record interview",
  description = "Record the interview or type/paste a transcript, then stop to apply it to Facts revealed",
  initialTranscript = "",
  onStop,
  onRecordingStart,
  onRecordingStop,
  className,
}: InterviewRecordingCardProps) {
  const [transcript, setTranscript] = useState(initialTranscript);
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
    setTranscript(initialTranscript);
  }, [initialTranscript]);

  useEffect(() => {
    if (job?.status === "transcribed" && job.transcript && job.id !== appliedJobIdRef.current) {
      appliedJobIdRef.current = job.id;
      const text = job.transcript.trim();
      setTranscript(text);
      onStop(text);
      toast.success("Transcript applied to Facts revealed");
    }
  }, [job, onStop]);

  useEffect(() => {
    if (inferenceError) {
      toast.error(inferenceError);
    }
  }, [inferenceError]);

  const applyManualStop = useCallback(() => {
    const endTime = formatClockTime(new Date());
    onRecordingStop?.(endTime);
    onStop(transcript.trim());
    toast.success("Recording stopped — transcript applied to Facts revealed");
  }, [onRecordingStop, onStop, transcript]);

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
        await submitTranscription(blob, "field_notes");
      } catch {
        toast.error("Failed to submit recording");
      }
      return;
    }

    if (!isRecording) {
      start();
      onRecordingStart?.(formatClockTime(new Date()));
    } else {
      stop();
      applyManualStop();
    }
  };

  return (
    <Card className={cn("rounded-xl shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {isProcessing
            ? "Transcribing recording — please wait..."
            : isActivelyRecording
              ? useLiveInference
                ? "Recording in progress — stop when finished to transcribe and apply to Facts revealed"
                : "Recording in progress — enter the transcript below, then stop to apply to Facts revealed"
              : description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Type or paste the interview transcript here, or use Start Recording for live transcription..."
          rows={8}
          className="font-mono text-sm"
          disabled={isProcessing}
        />
      </CardContent>
    </Card>
  );
}
