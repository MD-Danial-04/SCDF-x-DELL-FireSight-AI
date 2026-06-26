import { ClipboardCheck, Mic, Settings2, type LucideIcon } from "lucide-react";
import { cn } from "./ui/utils";

export type InterviewPhase = "setup" | "record" | "review";

const STEPS: { id: InterviewPhase; label: string; Icon: LucideIcon }[] = [
  { id: "setup", label: "Setup", Icon: Settings2 },
  { id: "record", label: "Record", Icon: Mic },
  { id: "review", label: "Review", Icon: ClipboardCheck },
];

const PHASE_ORDER: Record<InterviewPhase, number> = {
  setup: 0,
  record: 1,
  review: 2,
};

interface InterviewStepperProps {
  phase: InterviewPhase;
  onPhaseChange: (phase: InterviewPhase) => void;
  /** Short status shown under the Record step (e.g. "Asked 3 / 10"). */
  recordMeta?: string;
}

/**
 * Tablet-first guided stepper for the statement interview flow. Tapping a step
 * jumps to that phase; all phases operate on the same page data so navigation
 * is free.
 */
export function InterviewStepper({
  phase,
  onPhaseChange,
  recordMeta,
}: InterviewStepperProps) {
  const currentIndex = PHASE_ORDER[phase];

  return (
    <ol className="flex w-full items-stretch gap-2">
      {STEPS.map((step, index) => {
        const isActive = index === currentIndex;
        const isDone = index < currentIndex;
        const Icon = step.Icon;
        const showMeta = step.id === "record" && recordMeta;

        return (
          <li key={step.id} className="flex-1">
            <button
              type="button"
              onClick={() => onPhaseChange(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
                isActive
                  ? "border-primary bg-primary/5 text-primary"
                  : isDone
                    ? "border-green-200 bg-green-50/50 text-green-700 hover:border-green-300"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  isActive
                    ? "bg-primary text-white"
                    : isDone
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-tight">
                  {step.label}
                </span>
                {showMeta ? (
                  <span className="block truncate text-[11px] font-normal text-gray-500">
                    {recordMeta}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
