import type { ComponentType } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  FilePlus2,
  FileText,
  Images,
  MapPin,
  MessagesSquare,
  ScanLine,
  type LucideProps,
} from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { useLatestDraft } from "../hooks/useLatestDraft";
import { INTERVIEW_NAV_ID } from "../lib/reportSectionStatus";
import logoUrl from "../../assets/brand/firesight-logo.png?url";

const ATTACHMENTS_SECTION_ID = "8";

function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

type QuickActionProps = {
  icon: ComponentType<LucideProps>;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
};

function QuickAction({ icon: Icon, label, description, onClick, disabled }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:bg-muted/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card disabled:hover:shadow-sm sm:gap-4 sm:p-5 lg:p-6"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-fire-muted text-primary transition-transform group-hover:scale-105 lg:h-12 lg:w-12">
        <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground lg:text-lg">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground lg:text-sm">{description}</span>
      </span>
    </button>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { draft, drafts, loading } = useLatestDraft();
  const recentRecords = drafts.slice(0, 5);

  const resumeDraft = (initialSectionId?: string) => {
    if (!draft) {
      navigate("/incident");
      return;
    }
    navigate("/report", {
      state: { resumeDraftIncidentNo: draft.incidentNo, incidentType: null, initialSectionId },
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pt-[env(safe-area-inset-top)] lg:max-w-5xl">
      <header className="space-y-5">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="FireSight logo"
            className="h-11 w-11 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-foreground">FireSight AI</p>
            <p className="text-xs text-muted-foreground">SCDF incident documentation</p>
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {getGreeting()}, Officer
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Let&apos;s complete your report.
          </p>
        </div>
      </header>

      <div className="space-y-8">
      {/* Active case / resume latest draft */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-40" />
          <Skeleton className="mt-5 h-11 w-full rounded-xl" />
        </div>
      ) : draft ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active case
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{draft.incidentNo}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{draft.locationOfFire || "Location not set"}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Last edited {formatRelativeTime(draft.updatedAt)}
            </p>
            <button
              type="button"
              onClick={() => resumeDraft()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-fire-muted text-primary">
            <FilePlus2 className="h-6 w-6" />
          </span>
          <h2 className="mt-3 font-semibold text-foreground">No report in progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a new incident to capture a stop message and generate your report.
          </p>
          <button
            type="button"
            onClick={() => navigate("/incident")}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Start your first report
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <QuickAction
            icon={FilePlus2}
            label="New incident"
            description="Capture a stop message"
            onClick={() => navigate("/incident")}
          />
          <QuickAction
            icon={ScanLine}
            label="Floorplan scanner"
            description={draft ? "Resume in active case" : "Start a case first"}
            onClick={() => resumeDraft(ATTACHMENTS_SECTION_ID)}
            disabled={!draft}
          />
          <QuickAction
            icon={MessagesSquare}
            label="Guided interview"
            description={draft ? "Resume in active case" : "Start a case first"}
            onClick={() => resumeDraft(INTERVIEW_NAV_ID)}
            disabled={!draft}
          />
          <QuickAction
            icon={Images}
            label="Photo log"
            description={draft ? "Resume in active case" : "Start a case first"}
            onClick={() => resumeDraft(ATTACHMENTS_SECTION_ID)}
            disabled={!draft}
          />
        </div>
      </section>
      </div>

      {/* Recent records — desktop only; mobile uses the Drafts tab */}
      <section className="hidden lg:block">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent records</h2>
          <button
            type="button"
            onClick={() => navigate("/records")}
            className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : recentRecords.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No saved records yet. Saved drafts from the report editor appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentRecords.map((record) => (
                <li key={record.incidentNo}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/report", {
                        state: { resumeDraftIncidentNo: record.incidentNo, incidentType: null },
                      })
                    }
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-fire-muted text-primary">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">
                        {record.incidentNo}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {record.locationOfFire || "Location not set"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground/80">
                      {formatRelativeTime(record.updatedAt)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
