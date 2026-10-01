import { Fragment, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import {
  Check,
  ClipboardList,
  Eye,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  Menu,
  Save,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useLayoutHeader } from "../context/LayoutHeaderContext";
import { REPORT_FORM_SECTIONS } from "../constants/reportFormSections";
import {
  INTERVIEW_NAV_ID,
  INTERVIEW_NAV_LABEL,
  MENU_NAV_ID,
  PREVIEW_NAV_ID,
  PREVIEW_NAV_LABEL,
  countAutoFilled,
  getCompletionStatusMeta,
  getIntervieweesStatus,
  getSectionStatus,
  getStatusBadgeColors,
  parseSectionTitle,
  type CompletionStatus,
} from "../lib/reportSectionStatus";
import type { FireReportData } from "../types/fireReport";
import type { PhotoLogEntry } from "../types/photoLog";

export type ReportView = "fir" | "prr";

interface ReportEditorNavProps {
  title: string;
  reportView: ReportView;
  onReportViewChange: (view: ReportView) => void;
  fields: FireReportData;
  extractedKeys: Set<string>;
  floorplanSvg: string | null;
  photos: PhotoLogEntry[];
  annexPreviewUrls: Record<number, string>;
  visibleSectionIds: string[];
  showInterviewNav: boolean;
  activeSectionId: string;
  onSelectSection: (id: string) => void;
  onSaveDraft: () => void;
  isSavingDraft: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  hasGeneratedDoc: boolean;
}

function SectionStatusIndicator({
  status,
  autoCount,
}: {
  status: CompletionStatus;
  autoCount: number;
}) {
  const { label } = getCompletionStatusMeta(status);

  let indicator: ReactNode;
  if (status === "complete") {
    indicator = (
      <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  } else if (status === "partial") {
    indicator = <span className="size-2.5 rounded-full bg-amber-400" />;
  } else {
    indicator = <span className="size-2.5 rounded-full border border-slate-300" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 items-center justify-center" aria-label={label}>
          {indicator}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        <span>{label}</span>
        {autoCount > 0 && <span> · {autoCount} auto-filled</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export function ReportEditorNav({
  title,
  reportView,
  onReportViewChange,
  fields,
  extractedKeys,
  floorplanSvg,
  photos,
  annexPreviewUrls,
  visibleSectionIds,
  showInterviewNav,
  activeSectionId,
  onSelectSection,
  onSaveDraft,
  isSavingDraft,
  onGenerate,
  isGenerating,
  hasGeneratedDoc,
}: ReportEditorNavProps) {
  const layoutHeader = useLayoutHeader();
  const slot = layoutHeader?.slot ?? null;
  const actionsSlot = layoutHeader?.actionsSlot ?? null;
  const sidebarSlot = layoutHeader?.sidebarSlot ?? null;
  const setHasMenu = layoutHeader?.setHasMenu;
  const setHasSidebar = layoutHeader?.setHasSidebar;
  const setTitle = layoutHeader?.setTitle;
  const setDocumentId = layoutHeader?.setDocumentId;

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (activeSectionId !== MENU_NAV_ID) return;
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    if (mobileQuery.matches) setOpen(true);
  }, [activeSectionId]);

  useEffect(() => {
    if (!setHasMenu) return;
    setHasMenu(true);
    return () => setHasMenu(false);
  }, [setHasMenu]);

  useEffect(() => {
    if (!setHasSidebar) return;
    setHasSidebar(true);
    return () => setHasSidebar(false);
  }, [setHasSidebar]);

  useEffect(() => {
    if (!setTitle) return;
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);

  useEffect(() => {
    if (!setDocumentId) return;
    setDocumentId(fields.incidentNo?.trim() || null);
    return () => setDocumentId(null);
  }, [setDocumentId, fields.incidentNo]);

  const visibleSections = REPORT_FORM_SECTIONS.filter((section) =>
    visibleSectionIds.includes(section.id)
  );
  const statusCtx = { fields, floorplanSvg, photos, annexPreviewUrls };
  const interviewActive = activeSectionId === INTERVIEW_NAV_ID;
  const previewActive = activeSectionId === PREVIEW_NAV_ID;
  const generateLabel = reportView === "prr" ? "Generate PRR" : "Generate Word Report";
  const intervieweeStatus = getIntervieweesStatus(fields.interviewees);
  const interviewComplete = showInterviewNav && intervieweeStatus === "complete";
  const totalCount = visibleSections.length + (showInterviewNav ? 1 : 0);
  const completedCount =
    visibleSections.filter((section) => getSectionStatus(section.id, statusCtx) === "complete")
      .length + (interviewComplete ? 1 : 0);

  const selectSection = (id: string) => {
    onSelectSection(id);
    setOpen(false);
  };

  const appNavItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      to: "/",
    },
    {
      key: "fir",
      label: "Fire investigation report",
      icon: FileText,
      active: reportView === "fir",
      onClick: () => {
        onReportViewChange("fir");
        setOpen(false);
      },
    },
    {
      key: "prr",
      label: "Preliminary report response",
      icon: ClipboardList,
      active: reportView === "prr",
      onClick: () => {
        onReportViewChange("prr");
        setOpen(false);
      },
    },
    {
      key: "records",
      label: "Records",
      icon: FolderOpen,
      to: "/records",
    },
  ] as const;

  const sectionTrigger = (
    <button
      type="button"
      aria-label="Open report navigation"
      onClick={() => setOpen(true)}
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
    >
      <Menu className="size-5" />
    </button>
  );

  const saveButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Save draft"
      onClick={onSaveDraft}
      disabled={isSavingDraft}
    >
      {isSavingDraft ? (
        <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
      ) : (
        <Save className="h-4 w-4 sm:mr-2" />
      )}
      <span className="hidden sm:inline">Save draft</span>
    </Button>
  );

  const navBody = (
    <>
      <div className="flex-1 overflow-y-auto">
            <nav className="px-2 py-2">
              <ul className="space-y-1">
                {appNavItems.map((item) => {
                  const Icon = item.icon;
                  const baseClasses =
                    "group flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-left text-sm font-medium transition-colors";
                  const stateClasses =
                    "active" in item && item.active
                      ? "border-red-600 bg-red-50 font-semibold text-red-900"
                      : "border-transparent text-foreground hover:bg-muted";

                  if ("to" in item) {
                    return (
                      <li key={item.key}>
                        <Link
                          to={item.to}
                          onClick={() => setOpen(false)}
                          className={`${baseClasses} ${stateClasses}`}
                        >
                          <Icon className="size-4 shrink-0 opacity-80" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={item.onClick}
                        aria-current={item.active ? "true" : undefined}
                        className={`${baseClasses} ${stateClasses}`}
                      >
                        <Icon className="size-4 shrink-0 opacity-80" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="px-4 pt-2 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Report sections
              </p>
            </div>

            <nav className="px-2 pb-2">
              <ul className="space-y-1">
                {visibleSections.map((section) => {
                  const autoCount = countAutoFilled(section.id, extractedKeys);
                  const isActive = section.id === activeSectionId && !interviewActive;
                  const status = getSectionStatus(section.id, statusCtx);
                  const { number, label } = parseSectionTitle(section.title);

                  return (
                    <Fragment key={section.id}>
                      <li>
                        <button
                          type="button"
                          onClick={() => selectSection(section.id)}
                          aria-current={isActive ? "true" : undefined}
                          className={`group flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-left transition-colors ${
                            isActive
                              ? "border-red-600 bg-red-50 font-semibold text-red-900"
                              : "border-transparent text-foreground hover:bg-muted"
                          }`}
                        >
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${getStatusBadgeColors(
                              status,
                              isActive
                            )}`}
                          >
                            {number}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                          <SectionStatusIndicator status={status} autoCount={autoCount} />
                        </button>
                      </li>

                      {section.id === "5" && showInterviewNav && (
                        <li>
                          <button
                            type="button"
                            onClick={() => selectSection(INTERVIEW_NAV_ID)}
                            aria-current={interviewActive ? "true" : undefined}
                            className={`group flex w-full items-center gap-3 rounded-lg border-l-2 py-2 pl-9 pr-3 text-left transition-colors ${
                              interviewActive
                                ? "border-red-600 bg-red-50 font-semibold text-red-900"
                                : "border-transparent text-foreground hover:bg-muted"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {INTERVIEW_NAV_LABEL}
                            </span>
                            <SectionStatusIndicator status={intervieweeStatus} autoCount={0} />
                          </button>
                        </li>
                      )}
                    </Fragment>
                  );
                })}

                <li>
                    <button
                      type="button"
                      onClick={() => selectSection(PREVIEW_NAV_ID)}
                      aria-current={previewActive ? "true" : undefined}
                      className={`group flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-left transition-colors ${
                        previewActive
                          ? "border-red-600 bg-red-50 font-semibold text-red-900"
                          : "border-transparent text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500">
                        <Eye className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{PREVIEW_NAV_LABEL}</span>
                      {hasGeneratedDoc ? (
                        <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Not generated
                        </span>
                      )}
                    </button>
                  </li>
              </ul>
            </nav>
          </div>

          <div className="border-t p-3">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                onGenerate();
                setOpen(false);
              }}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {generateLabel}
            </Button>
          </div>
    </>
  );

  return (
    <>
      {slot ? createPortal(sectionTrigger, slot) : null}
      {actionsSlot ? createPortal(saveButton, actionsSlot) : null}
      {sidebarSlot
        ? createPortal(
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Navigation</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {completedCount} of {totalCount} sections completed
                </p>
              </div>
              {navBody}
            </div>,
            sidebarSlot
          )
        : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-80 max-w-[85vw] flex-col p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription className="text-xs">
              {completedCount} of {totalCount} sections completed
            </SheetDescription>
          </SheetHeader>
          {navBody}
        </SheetContent>
      </Sheet>
    </>
  );
}
