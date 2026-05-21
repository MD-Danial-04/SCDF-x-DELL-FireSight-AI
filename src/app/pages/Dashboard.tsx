import { Link } from "react-router";
import { FileText, FileImage, ArrowRight } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ActionCard } from "../components/ActionCard";

export function Dashboard() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Documentation hub"
        description="Start a new incident workflow, late activation / response slides, or browse past records."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActionCard
          to="/incident"
          icon={FileText}
          title="Incident report / slides"
          description="For active incidents — record a stop message, then generate a fire investigation report or activation slides."
          accent="fire"
        />
        <ActionCard
          to="/late-activation"
          icon={FileImage}
          title="Late activation / response slides"
          description="For late activations, response slides, and briefing presentations without a full stop-message flow."
          accent="slides"
        />
      </div>

      <Link
        to="/records"
        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm hover:bg-muted/40 transition-colors group"
      >
        <div>
          <p className="font-semibold text-foreground">Records</p>
          <p className="text-sm text-muted-foreground mt-1">
            View past fire investigation reports and activation slide decks
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </Link>
    </div>
  );
}
