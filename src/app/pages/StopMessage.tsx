import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Mic, MicOff, FileText, FileImage, Loader2 } from "lucide-react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";
import { StepIndicator } from "../components/StepIndicator";
import { ReportGeneration } from "./ReportGeneration";
import { SlidesGeneration } from "./SlidesGeneration";
import { ReportSessionProvider } from "../context/ReportSessionContext";
import {
  incidentTypes,
  getIncidentTypesByCategory,
  type IncidentType,
} from "../constants/incidentTemplates";
import {
  DEMO_SELECT_OPTIONS,
  getDemoScenarioBySelectId,
  isDemoSelectId,
  type DemoScenario,
} from "../constants/demoScenarios";
import { useRecordingTimer } from "../hooks/useRecordingTimer";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useTranscriptionJob } from "../hooks/useTranscriptionJob";
import { AiProcessingDialog } from "../components/AiProcessingDialog";
import { AudioWaveform } from "../components/AudioWaveform";
import { isInferenceConfigured } from "../types/inference";

const FAM_DEMO_SELECT_ID = "demo-fam";
const FAM_TYPEWRITER_DURATION_MS = 2500;

const NON_DEMO_STOP_MESSAGE =
  "Red Rhino 1 stop at location, case of fire mod. Upon arrival, white smoke seen in the lift shaft. Upon investigation, fire found in CRC of block 123 involving rubbish contents. CD extinguished fire using 2x hosereel. Case classified as C2 accidental due to naked light. Case handed over to SGT John Tan T123456 from Ang Mo Kio NPC.";

function scrollPageToTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
}

export function StopMessage() {
  const { pathname } = useLocation();
  const mode = pathname.startsWith("/late-activation") ? "late" : "incident";

  const [selectedSelectValue, setSelectedSelectValue] = useState("");
  const [isDemoSelection, setIsDemoSelection] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType | null>(null);
  const { isRecording, recordingTime, start, stop, formatTime } = useRecordingTimer();
  const {
    isRecording: isMediaRecording,
    stream: mediaStream,
    start: startMediaRecording,
    stop: stopMediaRecording,
  } = useMediaRecorder();
  const { job, isProcessing, error: inferenceError, submitTranscription } = useTranscriptionJob();
  const [textInput, setTextInput] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [fieldNotes, setFieldNotes] = useState("");
  const [showGeneration, setShowGeneration] = useState(false);
  const [documentType, setDocumentType] = useState<"report" | "slides" | null>(null);
  const [famDemoPending, setFamDemoPending] = useState<{
    stopMessage: string;
    fieldNotes: string;
  } | null>(null);
  const [famFieldNotesRevealed, setFamFieldNotesRevealed] = useState(false);

  const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTypewriterTimer = useCallback(() => {
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
  }, []);

  const clearRecordingState = useCallback(() => {
    stop();
    clearTypewriterTimer();
  }, [stop, clearTypewriterTimer]);

  useEffect(() => () => clearRecordingState(), [clearRecordingState]);

  const startFamTypewriter = useCallback((stopMessage: string) => {
    const chunks = stopMessage.split(/\s+/).filter(Boolean);
    if (chunks.length === 0) return;

    const intervalMs = Math.max(50, Math.floor(FAM_TYPEWRITER_DURATION_MS / chunks.length));
    let index = 0;
    setVoiceTranscript("");

    typewriterTimerRef.current = setInterval(() => {
      index += 1;
      setVoiceTranscript(chunks.slice(0, index).join(" "));
      if (index >= chunks.length && typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
    }, intervalMs);
  }, []);

  const loadDemoScenario = useCallback((scenario: DemoScenario, selectId: string) => {
    const type = incidentTypes.find((t) => t.id === scenario.incidentTypeId);
    if (!type) {
      toast.error("Demo scenario incident type not found");
      return;
    }
    setSelectedSelectValue(selectId);
    setIsDemoSelection(true);
    setSelectedIncidentType(type);

    if (selectId === FAM_DEMO_SELECT_ID) {
      setFamDemoPending({
        stopMessage: scenario.stopMessage,
        fieldNotes: scenario.fieldNotes,
      });
      setFamFieldNotesRevealed(false);
      setVoiceTranscript("");
      setFieldNotes("");
      return;
    }

    setFamDemoPending(null);
    setFamFieldNotesRevealed(false);
    setVoiceTranscript(scenario.stopMessage);
    setFieldNotes(scenario.fieldNotes);
    toast.success("Demo sample loaded");
  }, []);

  const handleIncidentSelectChange = useCallback(
    (value: string) => {
      if (isDemoSelectId(value)) {
        const scenario = getDemoScenarioBySelectId(value);
        if (scenario) loadDemoScenario(scenario, value);
        return;
      }
      clearRecordingState();
      setFamDemoPending(null);
      setFamFieldNotesRevealed(false);
      setIsDemoSelection(false);
      setSelectedSelectValue(value);
      const type = incidentTypes.find((t) => t.id === value);
      setSelectedIncidentType(type || null);
    },
    [loadDemoScenario, clearRecordingState]
  );

  const handleFieldNotesFocus = useCallback(() => {
    if (
      famDemoPending?.fieldNotes &&
      !famFieldNotesRevealed &&
      !fieldNotes.trim()
    ) {
      setFieldNotes(famDemoPending.fieldNotes);
      setFamFieldNotesRevealed(true);
    }
  }, [famDemoPending, famFieldNotesRevealed, fieldNotes]);

  useEffect(() => {
    if (selectedIncidentType) {
      setTextInput(selectedIncidentType.template);
    }
  }, [selectedIncidentType]);

  const useLiveInference = isInferenceConfigured() && !isDemoSelection;

  useEffect(() => {
    if (job?.status === "transcribed") {
      if (job.transcript) {
        setVoiceTranscript(job.transcript);
      }
      toast.success("Recording transcribed");
    }
  }, [job]);

  useEffect(() => {
    if (inferenceError) {
      toast.error(inferenceError);
    }
  }, [inferenceError]);

  const isActivelyRecording = useLiveInference ? isMediaRecording : isRecording;

  const handleRecord = async () => {
    if (useLiveInference) {
      if (!isMediaRecording) {
        clearTypewriterTimer();
        try {
          await startMediaRecording();
          start();
        } catch {
          toast.error("Microphone access denied");
        }
        return;
      }

      clearTypewriterTimer();
      stop();
      try {
        const blob = await stopMediaRecording();
        toast.info("Processing recording...");
        await submitTranscription(blob);
      } catch {
        toast.error("Failed to submit recording");
      }
      return;
    }

    if (!isRecording) {
      clearTypewriterTimer();
      start();
      if (famDemoPending) {
        startFamTypewriter(famDemoPending.stopMessage);
      }
    } else {
      clearTypewriterTimer();
      stop();
      toast.success("Recording stopped and transcribed");
      if (famDemoPending) {
        setVoiceTranscript(famDemoPending.stopMessage);
      } else {
        setVoiceTranscript(NON_DEMO_STOP_MESSAGE);
      }
    }
  };

  const handleGenerateReport = () => {
    toast.success("Generating Fire Investigation Report...");
    setDocumentType("report");
    setShowGeneration(true);
    scrollPageToTop();
  };

  const handleGenerateSlides = () => {
    toast.success("Generating Activation Slides...");
    setDocumentType("slides");
    setShowGeneration(true);
    scrollPageToTop();
  };

  const effectiveStopMessage = voiceTranscript.trim() || textInput.trim();
  const canGenerate =
    Boolean(selectedIncidentType) &&
    Boolean(effectiveStopMessage || fieldNotes.trim());
  const activeDemoScenario = isDemoSelection
    ? getDemoScenarioBySelectId(selectedSelectValue)
    : undefined;
  const showFireReport =
    Boolean(selectedIncidentType?.requiresFireReport) ||
    Boolean(activeDemoScenario?.requiresFireReport);

  if (showGeneration) {
    if (documentType === "report") {
      return (
        <ReportSessionProvider
          value={{
            incidentType: selectedIncidentType,
            stopMessage: effectiveStopMessage,
            fieldNotes: fieldNotes.trim(),
            transcriptionJobId: job?.id,
          }}
        >
          <ReportGeneration
            onBack={() => {
              setShowGeneration(false);
              setDocumentType(null);
              scrollPageToTop();
            }}
          />
        </ReportSessionProvider>
      );
    }
    const demoScenario = isDemoSelection
      ? getDemoScenarioBySelectId(selectedSelectValue)
      : undefined;

    return (
      <ReportSessionProvider
        value={{
          incidentType: selectedIncidentType,
          stopMessage: effectiveStopMessage,
          fieldNotes: fieldNotes.trim(),
          transcriptionJobId: job?.id,
          premisesOwner: demoScenario?.premisesOwner,
          premisesUen: demoScenario?.premisesUen,
        }}
      >
        <SlidesGeneration
          onBack={() => {
            setShowGeneration(false);
            setDocumentType(null);
            scrollPageToTop();
          }}
        />
      </ReportSessionProvider>
    );
  }

  const workflowStep = !selectedIncidentType ? 0 : canGenerate ? 2 : 1;

  return (
    <div className="space-y-8">
      <AiProcessingDialog open={isProcessing} kind="transcription" />
      <PageHeader
        title={mode === "late" ? "Late activation / response slides" : "Incident report / slides"}
        description={
          mode === "late"
            ? "Generate late activation and response slides for briefings."
            : "Select incident type, capture your stop message, then generate a report or slides."
        }
      />

      {mode === "incident" && (
        <>
          <StepIndicator
            currentIndex={workflowStep}
            steps={[
              { label: "Select type", description: "Choose incident template" },
              { label: "Capture", description: "Record or edit message" },
              { label: "Generate", description: "Report or slides" },
            ]}
          />

          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Select incident type</CardTitle>
              <CardDescription>
                Choose a category, then the specific incident template for your stop message
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSelectValue} onValueChange={handleIncidentSelectChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category and incident type..." />
                </SelectTrigger>
                <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))] py-1">
                  {getIncidentTypesByCategory().map(({ category, label, types }, groupIndex) => (
                    <SelectGroup
                      key={category}
                      className={groupIndex > 0 ? "mt-2 border-t border-border/60 pt-2" : ""}
                    >
                      <SelectLabel className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                        {label}
                      </SelectLabel>
                      <div className="ml-3 border-l-2 border-border/70 pl-1 mr-1">
                        {DEMO_SELECT_OPTIONS.filter((d) => d.category === category).map(
                          ({ selectId, scenario }) => (
                            <SelectItem
                              key={selectId}
                              value={selectId}
                              className="pl-6 pr-8 rounded-sm"
                            >
                              <span className="flex w-full items-center justify-between gap-3">
                                <span className="text-foreground/90">{scenario.label}</span>
                                {selectId !== FAM_DEMO_SELECT_ID && (
                                  <span className="text-xs text-brand-slides font-medium shrink-0">
                                    Demo
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          )
                        )}
                        {types.map((type) => (
                          <SelectItem
                            key={type.id}
                            value={type.id}
                            className="pl-6 pr-8 rounded-sm"
                          >
                            <span className="flex w-full items-center justify-between gap-3">
                              <span className="text-foreground/90">{type.name}</span>
                              {type.requiresFireReport && (
                                <span className="text-xs text-primary font-medium shrink-0">
                                  Report
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedIncidentType && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Template Reference</CardTitle>
                  <CardDescription>
                    Use the template as a guide, then record your stop message below
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={textInput}
                    readOnly
                    rows={12}
                    className="font-mono text-sm bg-muted/50"
                  />

                  <div className="border-t pt-4 space-y-3">
                    {isActivelyRecording && (
                      <div className="flex items-center justify-center gap-3">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                        </span>
                        <AudioWaveform
                          active={isActivelyRecording}
                          stream={useLiveInference ? mediaStream : null}
                          className="h-9 w-full max-w-xs"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-3">
                    {isActivelyRecording && (
                      <span className="text-sm font-mono text-primary tabular-nums">
                        {formatTime(recordingTime)}
                      </span>
                    )}
                    {isProcessing && (
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Transcribing…
                      </span>
                    )}
                    <Button
                      onClick={handleRecord}
                      size="lg"
                      variant={isActivelyRecording ? "secondary" : "default"}
                      disabled={isProcessing || !selectedIncidentType}
                    >
                      {isActivelyRecording ? (
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
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Transcribed Text</CardTitle>
                  <CardDescription>
                    {isProcessing
                      ? "Transcription in progress…"
                      : voiceTranscript
                        ? "Review and edit the transcribed stop message"
                        : "Your recording will appear here after you stop, or paste your stop message"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={voiceTranscript}
                    onChange={(e) => setVoiceTranscript(e.target.value)}
                    placeholder="Transcription will appear here after recording, or paste your stop message..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {selectedIncidentType && (
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>Field Notes</CardTitle>
                <CardDescription>
                  Paste drafts, shorthand, or scene notes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  id="field-notes"
                  value={fieldNotes}
                  onChange={(e) => setFieldNotes(e.target.value)}
                  onFocus={handleFieldNotesFocus}
                  placeholder="Paste incident notes, interview snippets, observations..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Optional — supplements your stop message when generating the report.
                </p>
              </CardContent>
            </Card>
          )}

          {canGenerate && (
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>Generate documentation</CardTitle>
                <CardDescription>
                  Choose the type of documentation to generate for this incident
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {showFireReport && (
                    <Button
                      onClick={handleGenerateReport}
                      className="h-auto flex items-center gap-3 rounded-xl px-4 py-3 text-left"
                    >
                      <FileText className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Full Fire Investigation Report</div>
                        <div className="text-xs opacity-90">Detailed Word report for fire incidents</div>
                      </div>
                    </Button>
                  )}
                  <Button
                    onClick={handleGenerateSlides}
                    variant="slides"
                    className="h-auto flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left"
                  >
                    <FileImage className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-semibold text-sm">Activation slides</div>
                      <div className="text-[11px] opacity-90 leading-tight">
                        Presentation slides for briefings
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode === "late" && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Late activation / response slides</CardTitle>
            <CardDescription>Enter information for late activation and response slides</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="activation-title">Activation Title</Label>
              <Input
                id="activation-title"
                placeholder="e.g., Night Shift Briefing - 20 May 2026"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="activation-description">Description</Label>
              <Textarea
                id="activation-description"
                placeholder="Enter briefing details..."
                rows={6}
                className="mt-1"
              />
            </div>
            <Button onClick={handleGenerateSlides} variant="slides">
              <FileImage className="mr-2 h-4 w-4" />
              Generate Slides
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
