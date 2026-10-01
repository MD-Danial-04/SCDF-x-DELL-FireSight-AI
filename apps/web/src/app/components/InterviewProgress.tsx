import { CheckCircle2, ListChecks, Loader2, ScanText } from "lucide-react";
import { cn } from "./ui/utils";

export type InterviewProgressStage = "transcribing" | "analyzing" | null;

const STAGE_SEQUENCE: {
  id: Exclude<InterviewProgressStage, null>;
  label: string;
  sublabel: string;
}[] = [
  {
    id: "transcribing",
    label: "Transcribing",
    sublabel: "Converting speech to text and translating to English",
  },
  {
    id: "analyzing",
    label: "Analyzing",
    sublabel: "Matching answers to the leading questions",
  },
];

const STAGE_ICONS = {
  transcribing: ScanText,
  analyzing: ListChecks,
} as const;

interface InterviewProgressProps {
  stage: InterviewProgressStage;
  className?: string;
}

/**
 * Compact, non-blocking progress strip for the interview flow. Shows the
 * current stage (Transcribe -> Analyze) inline so the investigator can keep
 * reading questions instead of being covered by a modal.
 */
export function InterviewProgress({ stage, className }: InterviewProgressProps) {
  if (!stage) return null;

  const activeIndex = STAGE_SEQUENCE.findIndex((item) => item.id === stage);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">
          {STAGE_SEQUENCE[activeIndex]?.label}…
        </p>
        <p className="truncate text-xs text-gray-500">
          {STAGE_SEQUENCE[activeIndex]?.sublabel}
        </p>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        {STAGE_SEQUENCE.map((item, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          const Icon = STAGE_ICONS[item.id];
          return (
            <span
              key={item.id}
              title={item.label}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
                isActive
                  ? "bg-primary text-white"
                  : isDone
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-400"
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
