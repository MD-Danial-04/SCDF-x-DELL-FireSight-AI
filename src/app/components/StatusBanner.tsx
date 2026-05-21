import type { ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "./ui/utils";

type StatusVariant = "success" | "info" | "warning";

const variantStyles: Record<
  StatusVariant,
  { container: string; icon: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    container: "border-emerald-200 bg-success-muted text-emerald-950",
    icon: "text-success",
    Icon: CheckCircle2,
  },
  info: {
    container: "border-blue-200 bg-brand-slides-muted text-blue-950",
    icon: "text-brand-slides",
    Icon: Info,
  },
  warning: {
    container: "border-amber-200 bg-warning-muted text-amber-950",
    icon: "text-amber-600",
    Icon: AlertTriangle,
  },
};

interface StatusBannerProps {
  variant: StatusVariant;
  title: string;
  children?: ReactNode;
  className?: string;
}

export function StatusBanner({ variant, title, children, className }: StatusBannerProps) {
  const { container, icon, Icon } = variantStyles[variant];
  return (
    <div className={cn("rounded-xl border px-4 py-4 shadow-sm", container, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", icon)} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-sm">{title}</p>
          {children && <div className="text-sm opacity-90">{children}</div>}
        </div>
      </div>
    </div>
  );
}
