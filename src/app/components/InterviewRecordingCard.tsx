import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { useRecordingTimer } from "../hooks/useRecordingTimer";
import { cn } from "./ui/utils";

interface InterviewRecordingCardProps {
  title?: string;
  description?: string;
  initialTranscript?: string;
  onStop: (transcript: string) => void;
  className?: string;
}

export function InterviewRecordingCard({
  title = "Record interview",
  description = "Type or paste the interview transcript, then stop recording to apply it to Facts revealed",
  initialTranscript = "",
  onStop,
  className,
}: InterviewRecordingCardProps) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const { isRecording, recordingTime, toggle, formatTime } = useRecordingTimer();

  const handleRecord = () => {
    if (isRecording) {
      toggle();
      onStop(transcript.trim());
      toast.success("Recording stopped");
    } else {
      toggle();
    }
  };

  return (
    <Card className={cn("rounded-xl shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {isRecording
            ? "Recording in progress — enter the transcript below, then stop to apply to Facts revealed"
            : description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-3 border-b pb-4">
          {isRecording && (
            <span className="text-sm font-mono text-primary tabular-nums">
              {formatTime(recordingTime)}
            </span>
          )}
          <Button
            onClick={handleRecord}
            size="lg"
            variant={isRecording ? "secondary" : "default"}
          >
            {isRecording ? (
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
          placeholder="Type or paste the interview transcript here..."
          rows={8}
          className="font-mono text-sm"
        />
      </CardContent>
    </Card>
  );
}
