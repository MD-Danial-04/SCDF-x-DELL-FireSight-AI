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
      <ol className="flex flex-col sm:flex-row gap-2 sm:gap-0">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li
              key={step.label}
              className={cn(
                "flex flex-1 items-center gap-3 sm:flex-col sm:items-start sm:gap-1 px-3 py-2 rounded-lg sm:rounded-none sm:px-0 sm:py-0",
                isCurrent && "bg-muted/80 sm:bg-transparent"
              )}
            >
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border-2",
                    isComplete && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-brand-fire-muted text-primary",
                    !isComplete && !isCurrent && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isComplete ? "✓" : index + 1}
                </span>
                <div className="min-w-0 sm:hidden">
                  <p className={cn("text-sm font-medium", isCurrent && "text-foreground")}>
                    {step.label}
                  </p>
                </div>
              </div>
              <div className="hidden sm:block pl-9">
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className="hidden sm:block absolute" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
