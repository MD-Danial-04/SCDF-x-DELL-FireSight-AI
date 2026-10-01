import { cn } from "./ui/utils";

export interface StepItem {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: StepItem[];
  currentIndex: number;
  className?: string;
}

export function StepIndicator({ steps, currentIndex, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex flex-row items-start">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;
          return (
            <li
              key={step.label}
              className={cn("flex items-start", !isLast && "flex-1")}
            >
              <div className="flex flex-col items-center px-1 text-center">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    isComplete && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-brand-fire-muted text-primary",
                    !isComplete &&
                      !isCurrent &&
                      "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isComplete ? "✓" : index + 1}
                </span>
                <p
                  className={cn(
                    "mt-1.5 text-[11px] font-medium leading-tight sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wide",
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                    {step.description}
                  </p>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-1 mt-4 h-0.5 flex-1 rounded-full sm:mx-2",
                    isComplete ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
