import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "./ui/utils";

type ActionAccent = "fire" | "slides";

const accentStyles: Record<
  ActionAccent,
  { border: string; bg: string; iconBg: string; icon: string; hover: string }
> = {
  fire: {
    border: "border-red-200 hover:border-red-300",
    bg: "bg-brand-fire-muted/50 hover:bg-brand-fire-muted",
    iconBg: "bg-primary/10",
    icon: "text-primary",
    hover: "hover:shadow-md hover:shadow-red-100",
  },
  slides: {
    border: "border-blue-200 hover:border-blue-300",
    bg: "bg-brand-slides-muted/50 hover:bg-brand-slides-muted",
    iconBg: "bg-brand-slides/10",
    icon: "text-brand-slides",
    hover: "hover:shadow-md hover:shadow-blue-100",
  },
};

interface ActionCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  accent: ActionAccent;
}

export function ActionCard({ to, icon: Icon, title, description, accent }: ActionCardProps) {
  const styles = accentStyles[accent];
  return (
    <Link
      to={to}
      className={cn(
        "group block rounded-xl border-2 p-6 transition-all duration-200",
        styles.border,
        styles.bg,
        styles.hover
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105",
          styles.iconBg
        )}
      >
        <Icon className={cn("w-6 h-6", styles.icon)} />
      </div>
      <h3 className="font-semibold text-lg text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
    </Link>
  );
}
