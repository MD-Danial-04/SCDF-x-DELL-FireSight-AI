import { useEffect, useState } from "react";
import {
  AudioLines,
  ScanText,
  ScanSearch,
  Languages,
  Tags,
  ListChecks,
  Gauge,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./ui/utils";

export type AiPipelineVariant = "report" | "slides";
export type AiPipelineKind =
  | "transcription"
  | "extraction"
  | "interview-analysis"
  | "photo-analysis";

export interface AiPipelineStage {
  label: string;
  sublabel: string;
  Icon: LucideIcon;
}

interface VariantStyle {
  /** CSS color value (used for glow/progress fills via inline style). */
  colorVar: string;
  accentText: string;
  ring: string;
  progressTrack: string;
  badge: string;
}

const VARIANT_STYLES: Record<AiPipelineVariant, VariantStyle> = {
  report: {
    colorVar: "var(--brand-fire)",
    accentText: "text-brand-fire",
    ring: "ring-brand-fire/30",
    progressTrack: "bg-brand-fire-muted",
    badge: "bg-brand-fire-muted text-brand-fire",
  },
  slides: {
    colorVar: "var(--brand-slides)",
    accentText: "text-brand-slides",
    ring: "ring-brand-slides/30",
    progressTrack: "bg-brand-slides-muted",
    badge: "bg-brand-slides-muted text-brand-slides",
  },
};

export interface AiPipelinePreset {
  variant: AiPipelineVariant;
  badgeLabel: string;
  title: string;
  description: string;
  stages: AiPipelineStage[];
}

export const AI_PIPELINE_PRESETS: Record<AiPipelineKind, AiPipelinePreset> = {
  transcription: {
    variant: "slides",
    badgeLabel: "Speech to text",
    title: "Transcribing your recording",
    description: "Converting speech to text and translating where needed.",
    stages: [
      { label: "Uploading audio", sublabel: "Securely sending your recording", Icon: AudioLines },
      { label: "Transcribing speech", sublabel: "Recognising spoken words (ASR)", Icon: ScanText },
      { label: "Translating", sublabel: "Normalising to English", Icon: Languages },
      { label: "Finalizing", sublabel: "Preparing the transcript", Icon: FileText },
    ],
  },
  extraction: {
    variant: "report",
    badgeLabel: "NLP extraction",
    title: "Reading the transcript",
    description: "Pulling structured details from the transcript.",
    stages: [
      { label: "Reading transcript", sublabel: "Parsing the captured text", Icon: ScanText },
      { label: "Identifying details", sublabel: "Tagging names, times and places (NER)", Icon: Tags },
      { label: "Filling fields", sublabel: "Populating fields for review", Icon: FileText },
    ],
  },
  "interview-analysis": {
    variant: "slides",
    badgeLabel: "Interview analysis",
    title: "Analyzing the interview",
    description: "Matching answers to the leading questions.",
    stages: [
      { label: "Reading transcript", sublabel: "Parsing the interview text", Icon: ScanText },
      { label: "Matching questions", sublabel: "Linking answers to prompts", Icon: ListChecks },
      { label: "Scoring coverage", sublabel: "Filling answers for review", Icon: Gauge },
    ],
  },
  "photo-analysis": {
    variant: "report",
    badgeLabel: "Vision analysis",
    title: "Analyzing your photos",
    description: "Detecting and describing fire scene evidence.",
    stages: [
      { label: "Uploading image", sublabel: "Securely sending the photo", Icon: ImageIcon },
      { label: "Detecting objects", sublabel: "Locating scene elements", Icon: ScanSearch },
      { label: "Describing scene", sublabel: "Drafting captions for review", Icon: FileText },
    ],
  },
};

/** How long the visual pipeline takes to walk through every stage. */
const STAGE_INTERVAL_MS = 750;

interface AiPipelineProps {
  variant: AiPipelineVariant;
  badgeLabel?: string;
  title: string;
  description: string;
  stages: AiPipelineStage[];
  /** Optional text echoed in a monospace chip (e.g. the stop message preview). */
  previewText?: string;
  /** Optional batch progress label (e.g. "Photo 2 of 5"). */
  progressLabel?: string;
}

/**
 * Animated extraction-pipeline visual shared by the full-panel loading screen
 * and the blocking processing dialog. Self-drives through the supplied stages
 * and holds on the last stage ("Finalizing...") so a slow real job never looks
 * stuck. The consumer controls when it unmounts.
 */
export function AiPipeline({
  variant,
  badgeLabel = "AI processing",
  title,
  description,
  stages,
  previewText,
  progressLabel,
}: AiPipelineProps) {
  const style = VARIANT_STYLES[variant];
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    setActiveStage(0);
    const timer = setInterval(() => {
      setActiveStage((prev) => Math.min(prev + 1, stages.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [stages.length]);

  const onFinalStage = activeStage >= stages.length - 1;
  const progressPct = ((activeStage + 1) / stages.length) * 100;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border bg-card p-8 shadow-lg ring-1",
        style.ring,
      )}
    >
      {/* Ambient accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: style.colorVar }}
      />

      <div className="relative flex flex-col items-center text-center">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            style.badge,
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {badgeLabel}
        </span>

        <h2 className="mt-4 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {onFinalStage ? "Finalizing results..." : description}
        </p>

        {progressLabel ? (
          <p className={cn("mt-3 text-sm font-medium", style.accentText)}>{progressLabel}</p>
        ) : null}

        {previewText ? (
          <p className="mt-4 line-clamp-2 max-w-md rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {previewText}
          </p>
        ) : null}
      </div>

      {/* Progress bar */}
      <div className={cn("relative mt-7 h-1.5 w-full overflow-hidden rounded-full", style.progressTrack)}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%`, background: style.colorVar }}
        />
      </div>

      {/* Pipeline stages */}
      <ol className="relative mt-7 space-y-3">
        {stages.map((stage, index) => {
          const isDone = index < activeStage;
          const isActive = index === activeStage;
          const isLast = index === stages.length - 1;
          // The last stage keeps spinning (Finalizing) rather than showing a check.
          const showActiveSpinner = isActive && (!isLast || onFinalStage);
          const Icon = stage.Icon;
          return (
            <li
              key={stage.label}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-300",
                isActive
                  ? cn("border-transparent bg-muted ring-1", style.ring)
                  : "border-transparent",
                !isActive && !isDone && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isDone || isActive ? style.badge : "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : showActiveSpinner ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className={cn("h-5 w-5", isActive && "animate-pulse")} />
                )}
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isActive ? style.accentText : "text-foreground",
                  )}
                >
                  {stage.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">{stage.sublabel}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
