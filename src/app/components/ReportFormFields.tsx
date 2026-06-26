import { useEffect, useState, type ReactNode } from "react";
import { AnnexSelector, parseSelectedAnnexes } from "./AnnexSelector";
import { IntervieweeListEditor } from "./IntervieweeListEditor";
import { Badge } from "./ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { cn } from "./ui/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { Check, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  REPORT_FORM_SECTIONS,
  getAllSectionFields,
  getDefaultOpenSections,
  type ReportFormFieldConfig,
  type ReportFormSectionConfig,
} from "../constants/reportFormSections";
import { TenantSectionEditor } from "./TenantSectionEditor";
import {
  buildAnnexAttachmentList,
  getAnnexById,
} from "../constants/annexDefinitions";
import type { PhotoAnalysisPartialEntry, PhotoAnalysisReportContext } from "../lib/buildPhotoAnalysisContext";
import {
  PHOTO_REF_FIELD_TO_SECTION,
  type SuggestedPhotoSection,
} from "../types/photoAnalysis";
import type { PhotoLogAnnexPreviewUrls, PhotoLogEntry } from "../types/photoLog";
import type {
  FireReportData,
  FireReportFieldKey,
  PhotoRefLinks,
  PhotoRefNotes,
} from "../types/fireReport";
import { EXTRACTABLE_KEYS } from "../types/fireReport";
import { PhotoRefChips } from "./PhotoRefChips";
import type { Interviewee } from "../types/interviewee";
import type { FloorplanDraftPayload } from "../lib/floorplanDrafts";
import type { AnnexEMarker } from "../lib/annexEMarkers";
import type { AnnexGEditorState } from "./AnnexGBurnChartEditor";

interface ReportFormFieldsProps {
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
  visibleSectionIds?: string[];
  sectionConfigs?: ReportFormSectionConfig[];
  displayMode?: "accordion" | "tabs";
  annexPreviewUrls?: Record<number, string>;
  annexHeaderPreviewUrls?: Record<number, string>;
  onAnnexOverrideChange?: (pageIndex: number, blob: Blob | null) => void;
  photos?: PhotoLogEntry[];
  photoPreviewUrls?: Record<string, string>;
  onAddPhotos?: (files: FileList | File[]) => void;
  onRemovePhoto?: (id: string) => void;
  onReorderPhoto?: (id: string, direction: "up" | "down") => void;
  onCopyPhoto?: (id: string) => void;
  onUpdatePhotoCaption?: (id: string, caption: string) => void;
  photoAnalysisContext?: PhotoAnalysisReportContext;
  onPhotosAnalyzed?: (updates: Record<string, PhotoAnalysisPartialEntry>) => void;
  onApplyPhotoSection?: (photoId: string, section: SuggestedPhotoSection) => void;
  onPhotoRefLinksChange?: (section: SuggestedPhotoSection, photoIds: string[]) => void;
  onPhotoRefNoteChange?: (section: SuggestedPhotoSection, note: string) => void;
  photoLogAnnexPreviewUrls?: PhotoLogAnnexPreviewUrls;
  photoLogPreviewLoading?: boolean;
  floorplanSvg?: string | null;
  floorplanPersistenceKey?: string | null;
  onFloorplanSvgChange?: (svg: string | null) => void;
  floorplanDraftState?: FloorplanDraftPayload | null;
  onFloorplanDraftStateChange?: (payload: FloorplanDraftPayload) => void;
  annexEMarkers?: AnnexEMarker[] | null;
  onAnnexEMarkersChange?: (markers: AnnexEMarker[]) => void;
  annexGState?: AnnexGEditorState | null;
  onAnnexGStateChange?: (state: AnnexGEditorState) => void;
  onIntervieweesChange?: (interviewees: Interviewee[]) => void;
  onGenerateStatement?: (intervieweeId: string) => void;
  onGenerateAllStatements?: () => void;
  onPreviewStatement?: (intervieweeId: string) => Promise<Blob>;
  generatingStatementId?: string | null;
  isGeneratingAllStatements?: boolean;
}

type CompletionStatus = "not-edited" | "partial" | "complete";

/** Nav id for the interview sub-section pulled out of report section 5. */
const INTERVIEW_NAV_ID = "5-interview";
const INTERVIEW_NAV_LABEL = "Interview / Interviewees";

function getCompletionStatusFromValues(values: string[]): CompletionStatus {
  const filledCount = values.filter((value) => value.trim().length > 0).length;

  if (filledCount === 0) {
    return "not-edited";
  }

  if (filledCount === values.length) {
    return "complete";
  }

  return "partial";
}

function getCompletionStatusMeta(status: CompletionStatus) {
  switch (status) {
    case "complete":
      return {
        label: "Completed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "partial":
      return {
        label: "Partially completed",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    default:
      return {
        label: "Not edited",
        className: "border-slate-200 bg-slate-100 text-slate-600",
      };
  }
}

function parseSectionTitle(title: string): { number: string; label: string } {
  const match = title.match(/^(\d+)\s+(.*)$/);
  if (match) {
    return { number: match[1], label: match[2] };
  }
  return { number: "", label: title };
}

function getStatusBadgeColors(status: CompletionStatus, isActive: boolean) {
  if (isActive) {
    return "border-transparent bg-red-600 text-white";
  }
  switch (status) {
    case "complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-500";
  }
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

function getFieldConfigsStatus(
  fieldConfigs: ReportFormFieldConfig[],
  fields: FireReportData
): CompletionStatus {
  return getCompletionStatusFromValues(
    fieldConfigs.map((config) => String(fields[config.key] ?? ""))
  );
}

function getIntervieweesStatus(interviewees: Interviewee[]): CompletionStatus {
  const relevantValues = interviewees.flatMap((interviewee) => [
    interviewee.name,
    interviewee.designation,
    interviewee.nric,
    interviewee.nationality,
    interviewee.address,
    interviewee.contactMobile,
    interviewee.contactHome,
    interviewee.contactOffice,
    interviewee.recordedStartTime,
    interviewee.recordedEndTime,
    interviewee.recordedDate,
    interviewee.interviewTakenPlace,
    interviewee.interpretedBy,
    interviewee.recordedBy,
    interviewee.factsOriginal,
    interviewee.facts,
    interviewee.signatureDataUrl,
  ]);

  return getCompletionStatusFromValues(relevantValues);
}

function getAttachmentsEditorStatus({
  selectedAnnexes,
  floorplanSvg,
  photos,
  annexPreviewUrls,
}: {
  selectedAnnexes: string[];
  floorplanSvg: string | null;
  photos: PhotoLogEntry[];
  annexPreviewUrls: Record<number, string>;
}): CompletionStatus {
  const editorRequirements: boolean[] = [];

  if (selectedAnnexes.includes("A") || selectedAnnexes.includes("E")) {
    editorRequirements.push(Boolean(floorplanSvg?.trim()));
  }

  if (selectedAnnexes.includes("E")) {
    editorRequirements.push(Boolean(annexPreviewUrls[4]));
  }

  if (selectedAnnexes.includes("D") || selectedAnnexes.includes("F")) {
    editorRequirements.push(photos.length > 0);
  }

  if (selectedAnnexes.includes("G")) {
    editorRequirements.push(Boolean(annexPreviewUrls[8]));
  }

  if (editorRequirements.length === 0) {
    return "complete";
  }

  const completedCount = editorRequirements.filter(Boolean).length;

  if (completedCount === 0) {
    return "not-edited";
  }

  if (completedCount === editorRequirements.length) {
    return "complete";
  }

  return "partial";
}

interface PhotoRefContext {
  photos: PhotoLogEntry[];
  photoPreviewUrls: Record<string, string>;
  links: PhotoRefLinks;
  notes: PhotoRefNotes;
  onLinksChange: (section: SuggestedPhotoSection, photoIds: string[]) => void;
  onNoteChange: (section: SuggestedPhotoSection, note: string) => void;
}

function Field({
  config,
  value,
  onChange,
  extracted,
  photoRefContext,
}: {
  config: ReportFormFieldConfig;
  value: string;
  onChange: (key: FireReportFieldKey, value: string) => void;
  extracted?: boolean;
  photoRefContext?: PhotoRefContext;
}) {
  const { key, label, multiline } = config;

  const photoRefSection = PHOTO_REF_FIELD_TO_SECTION[key];
  if (photoRefSection && photoRefContext) {
    return (
      <PhotoRefChips
        section={photoRefSection}
        label={label}
        photos={photoRefContext.photos}
        photoPreviewUrls={photoRefContext.photoPreviewUrls}
        linkedIds={photoRefContext.links[photoRefSection] ?? []}
        onLinksChange={(ids) => photoRefContext.onLinksChange(photoRefSection, ids)}
      />
    );
  }

  return (
    <div>
      <Label htmlFor={key} className="flex items-center gap-2">
        {label}
        {extracted && (
          <span className="text-xs font-normal text-green-600">(auto-filled)</span>
        )}
      </Label>
      {multiline ? (
        <Textarea
          id={key}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          rows={3}
          className="mt-1 border-slate-200/70 bg-white/95 font-mono text-sm text-slate-950 shadow-sm ring-1 ring-slate-100 focus-visible:border-slate-300 focus-visible:ring-primary/15"
        />
      ) : (
        <Input
          id={key}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          className="mt-1 border-slate-200/70 bg-white/95 text-slate-950 shadow-sm ring-1 ring-slate-100 focus-visible:border-slate-300 focus-visible:ring-primary/15"
        />
      )}
    </div>
  );
}

function FieldsGrid({
  fieldConfigs,
  fields,
  extractedKeys,
  onChange,
  photoRefContext,
}: {
  fieldConfigs: ReportFormFieldConfig[];
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
  photoRefContext?: PhotoRefContext;
}) {
  const isExtracted = (config: ReportFormFieldConfig) =>
    (config.extractable || EXTRACTABLE_KEYS.includes(config.key)) &&
    extractedKeys.has(config.key);

  const isPhotoRef = (config: ReportFormFieldConfig) =>
    Boolean(photoRefContext && PHOTO_REF_FIELD_TO_SECTION[config.key]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {fieldConfigs.map((config) => (
        <div
          key={config.key}
          className={config.multiline || isPhotoRef(config) ? "md:col-span-2" : undefined}
        >
          <Field
            config={config}
            value={String(fields[config.key] ?? "")}
            onChange={onChange}
            extracted={isExtracted(config)}
            photoRefContext={photoRefContext}
          />
        </div>
      ))}
    </div>
  );
}

function SubsectionFields({
  sectionId,
  subsectionTitle,
  fieldConfigs,
  fields,
  extractedKeys,
  onChange,
  photoRefContext,
}: {
  sectionId: string;
  subsectionTitle: string;
  fieldConfigs: ReportFormFieldConfig[];
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
  photoRefContext?: PhotoRefContext;
}) {
  const statusMeta = getCompletionStatusMeta(getFieldConfigsStatus(fieldConfigs, fields));

  const content = (
    <FieldsGrid
      fieldConfigs={fieldConfigs}
      fields={fields}
      extractedKeys={extractedKeys}
      onChange={onChange}
      photoRefContext={photoRefContext}
    />
  );

  if (sectionId !== "5") {
    return (
      <div className="mb-5 last:mb-0">
        <h5 className="mb-3 flex items-center gap-2 border-l-2 border-red-400 pl-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          <span>{subsectionTitle}</span>
          <Badge variant="outline" className={statusMeta.className}>
            {statusMeta.label}
          </Badge>
        </h5>
        {content}
      </div>
    );
  }

  const subsectionValue = `${sectionId}-${subsectionTitle}`;

  return (
    <Accordion type="single" collapsible className="mb-3 rounded-lg border bg-white">
      <AccordionItem value={subsectionValue} className="border-b-0">
        <AccordionTrigger className="px-4 py-3 text-left text-sm font-semibold hover:no-underline">
          <div className="flex w-full items-center justify-between gap-3 pr-2">
            <span>{subsectionTitle}</span>
            <Badge variant="outline" className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-1">
          {content}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function ReportFormFields({
  fields,
  extractedKeys,
  onChange,
  visibleSectionIds,
  sectionConfigs = REPORT_FORM_SECTIONS,
  displayMode = "accordion",
  annexPreviewUrls = {},
  annexHeaderPreviewUrls = {},
  onAnnexOverrideChange,
  photos = [],
  photoPreviewUrls = {},
  onAddPhotos,
  onRemovePhoto,
  onReorderPhoto,
  onCopyPhoto,
  onUpdatePhotoCaption,
  photoAnalysisContext = {},
  onPhotosAnalyzed,
  onApplyPhotoSection,
  onPhotoRefLinksChange,
  onPhotoRefNoteChange,
  photoLogAnnexPreviewUrls = { D: [], F: [] },
  photoLogPreviewLoading = false,
  floorplanSvg = null,
  floorplanPersistenceKey = null,
  onFloorplanSvgChange,
  floorplanDraftState = null,
  onFloorplanDraftStateChange,
  annexEMarkers = null,
  onAnnexEMarkersChange,
  annexGState = null,
  onAnnexGStateChange,
  onIntervieweesChange,
  onGenerateStatement,
  onGenerateAllStatements,
  onPreviewStatement,
  generatingStatementId,
  isGeneratingAllStatements = false,
}: ReportFormFieldsProps) {
  const countAutoFilled = (sectionId: string) => {
    const section = sectionConfigs.find((item) => item.id === sectionId);
    if (!section) return 0;
    return getAllSectionFields(section).filter((field) => extractedKeys.has(field.key)).length;
  };

  const getSectionStatus = (sectionId: string): CompletionStatus => {
    const section = sectionConfigs.find((item) => item.id === sectionId);
    if (!section) return "not-edited";

    if (sectionId === "8") {
      const directFieldConfigs = (section.fields ?? []).filter(
        (field) => field.key !== "annexReferenceSource" && field.key !== "selectedAnnexes"
      );
      const textStatus = directFieldConfigs.length
        ? getFieldConfigsStatus(directFieldConfigs, fields)
        : "not-edited";
      const editorStatus = getAttachmentsEditorStatus({
        selectedAnnexes: parseSelectedAnnexes(fields.selectedAnnexes),
        floorplanSvg,
        photos,
        annexPreviewUrls,
      });

      if (textStatus === "complete" && editorStatus === "complete") {
        return "complete";
      }

      if (textStatus === "not-edited" && editorStatus === "not-edited") {
        return "not-edited";
      }

      return "partial";
    }

    const subsectionStatuses =
      section.subsections?.map((subsection) => getFieldConfigsStatus(subsection.fields, fields)) ??
      [];

    const directFieldConfigs = section.fields ?? [];

    const directStatuses = directFieldConfigs.length
      ? [getFieldConfigsStatus(directFieldConfigs, fields)]
      : [];

    const statuses = [...directStatuses, ...subsectionStatuses];

    if (statuses.length === 0) {
      return "not-edited";
    }

    if (statuses.every((status) => status === "complete")) {
      return "complete";
    }

    if (statuses.every((status) => status === "not-edited")) {
      return "not-edited";
    }

    return "partial";
  };

  const visibleSections = visibleSectionIds
    ? sectionConfigs.filter((section) => visibleSectionIds.includes(section.id))
    : sectionConfigs;

  // The interview editor is surfaced as its own nav sub-item under section 5
  // (tabs mode only); accordion mode keeps it inline within section 5.
  const showInterviewNav =
    displayMode === "tabs" &&
    Boolean(onIntervieweesChange) &&
    visibleSections.some((section) => section.id === "5");

  const intervieweeStatus = getIntervieweesStatus(fields.interviewees);

  const [activeSectionId, setActiveSectionId] = useState<string>(visibleSections[0]?.id ?? "");
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    const validIds = visibleSections.map((section) => section.id);
    if (showInterviewNav) validIds.push(INTERVIEW_NAV_ID);
    if (!validIds.includes(activeSectionId)) {
      setActiveSectionId(visibleSections[0]?.id ?? "");
    }
  }, [activeSectionId, visibleSections, showInterviewNav]);

  const photoRefContext: PhotoRefContext | undefined =
    onPhotoRefLinksChange && onPhotoRefNoteChange
      ? {
          photos,
          photoPreviewUrls,
          links: fields.photoRefLinks ?? {},
          notes: fields.photoRefNotes ?? {},
          onLinksChange: onPhotoRefLinksChange,
          onNoteChange: onPhotoRefNoteChange,
        }
      : undefined;

  function renderInterviewEditor() {
    if (!onIntervieweesChange) return null;
    return (
      <div className="pb-4 pt-2">
        <IntervieweeListEditor
          interviewees={fields.interviewees}
          onChange={onIntervieweesChange}
          investigatorNameRank={fields.investigatorNameRank}
          onGenerateStatement={onGenerateStatement}
          onGenerateAllStatements={onGenerateAllStatements}
          onPreviewStatement={onPreviewStatement}
          generatingStatementId={generatingStatementId}
          isGeneratingAll={isGeneratingAllStatements}
        />
      </div>
    );
  }

  function renderSectionBody(sectionId: string) {
    const section = visibleSections.find((item) => item.id === sectionId);
    if (!section) return null;

    const intervieweeStatusMeta = getCompletionStatusMeta(intervieweeStatus);

    return (
      <div className="pb-4 pt-2">
        {section.id === "8" && (
          <div className="mb-4">
            <AnnexSelector
              selectedIds={parseSelectedAnnexes(fields.selectedAnnexes)}
              incidentNo={fields.incidentNo}
              locationOfFire={fields.locationOfFire}
              nameOfVictim={fields.injuryName}
              nricFinNumber={fields.injuryPin}
              overrides={annexPreviewUrls}
              headerPreviewUrls={annexHeaderPreviewUrls}
              onOverrideChange={onAnnexOverrideChange}
              photos={photos}
              photoPreviewUrls={photoPreviewUrls}
              onAddPhotos={onAddPhotos}
              onRemovePhoto={onRemovePhoto}
              onReorderPhoto={onReorderPhoto}
              onCopyPhoto={onCopyPhoto}
              onUpdatePhotoCaption={onUpdatePhotoCaption}
              photoAnalysisContext={photoAnalysisContext}
              onPhotosAnalyzed={onPhotosAnalyzed}
              onApplyPhotoSection={onApplyPhotoSection}
              photoLogAnnexPreviewUrls={photoLogAnnexPreviewUrls}
              photoLogPreviewLoading={photoLogPreviewLoading}
              floorplanSvg={floorplanSvg}
              floorplanPersistenceKey={floorplanPersistenceKey}
              onFloorplanSvgChange={onFloorplanSvgChange}
              floorplanDraftState={floorplanDraftState}
              onFloorplanDraftStateChange={onFloorplanDraftStateChange}
              annexEMarkers={annexEMarkers}
              onAnnexEMarkersChange={onAnnexEMarkersChange}
              annexGState={annexGState}
              onAnnexGStateChange={onAnnexGStateChange}
              onChange={(ids, attachmentList) => {
                onChange("selectedAnnexes", ids.join(","));
                onChange("annexAttachmentList", attachmentList);
                const annexA = getAnnexById("A");
                const annexB = getAnnexById("B");
                if (annexA) onChange("annexLayoutPlan", ids.includes("A") ? annexA.title : "");
                if (annexB) onChange("annexPhotographs", ids.includes("B") ? annexB.title : "");
              }}
            />
          </div>
        )}

        {section.id === "3" ? (
          <TenantSectionEditor
            fields={fields}
            extractedKeys={extractedKeys}
            onChange={onChange}
          />
        ) : (
          section.fields && (
            <FieldsGrid
              fieldConfigs={
                section.id === "8"
                  ? section.fields.filter(
                      (field) =>
                        field.key !== "annexReferenceSource" &&
                        field.key !== "selectedAnnexes" &&
                        field.key !== "annexAttachmentList" &&
                        field.key !== "annexLayoutPlan" &&
                        field.key !== "annexPhotographs"
                    )
                  : section.fields
              }
              fields={fields}
              extractedKeys={extractedKeys}
              onChange={onChange}
              photoRefContext={photoRefContext}
            />
          )
        )}

        {section.subsections?.map((subsection) => (
          <SubsectionFields
            key={subsection.title}
            sectionId={section.id}
            subsectionTitle={subsection.title}
            fieldConfigs={subsection.fields}
            fields={fields}
            extractedKeys={extractedKeys}
            onChange={onChange}
            photoRefContext={photoRefContext}
          />
        ))}

        {section.id === "5" && onIntervieweesChange && displayMode === "accordion" && (
          <Accordion type="single" collapsible className="mt-4 rounded-lg border bg-white">
            <AccordionItem value="5-e-interviewees" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 text-left text-sm font-semibold hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3 pr-2">
                  <span>E Interview - Interviewees</span>
                  <Badge variant="outline" className={intervieweeStatusMeta.className}>
                    {intervieweeStatusMeta.label}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-1">
                <IntervieweeListEditor
                  interviewees={fields.interviewees}
                  onChange={onIntervieweesChange}
                  investigatorNameRank={fields.investigatorNameRank}
                  onGenerateStatement={onGenerateStatement}
                  onGenerateAllStatements={onGenerateAllStatements}
                  onPreviewStatement={onPreviewStatement}
                  generatingStatementId={generatingStatementId}
                  isGeneratingAll={isGeneratingAllStatements}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    );
  }

  if (displayMode === "tabs") {
    const interviewComplete = showInterviewNav && intervieweeStatus === "complete";
    const totalCount = visibleSections.length + (showInterviewNav ? 1 : 0);
    const completedCount =
      visibleSections.filter(
        (section) => getSectionStatus(section.id) === "complete"
      ).length + (interviewComplete ? 1 : 0);
    const interviewActive = activeSectionId === INTERVIEW_NAV_ID;

    return (
      <div className="flex flex-col gap-6 md:flex-row">
        <nav className={`shrink-0 ${navCollapsed ? "md:w-14" : "md:w-64"}`}>
          <div
            className={`mb-2 flex items-center gap-2 ${
              navCollapsed ? "justify-center" : "justify-between px-1"
            }`}
          >
            {!navCollapsed && (
              <p className="text-xs font-medium text-muted-foreground">
                {completedCount} of {totalCount} completed
              </p>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setNavCollapsed((prev) => !prev)}
                  aria-label={navCollapsed ? "Expand sections" : "Minimize sections"}
                  aria-expanded={!navCollapsed}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {navCollapsed ? (
                    <PanelLeftOpen className="size-4" />
                  ) : (
                    <PanelLeftClose className="size-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>{navCollapsed ? "Expand sections" : "Minimize sections"}</span>
              </TooltipContent>
            </Tooltip>
          </div>
          <ul className="space-y-1">
            {visibleSections.map((section) => {
              const autoCount = countAutoFilled(section.id);
              const isActive = section.id === activeSectionId;
              const status = getSectionStatus(section.id);
              const { number, label } = parseSectionTitle(section.title);

              const sectionButton = (
                <button
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`group flex w-full items-center gap-3 rounded-lg border-l-2 py-2 text-left transition-colors ${
                    navCollapsed ? "justify-center px-2" : "px-3"
                  } ${
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
                  {!navCollapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                      <SectionStatusIndicator status={status} autoCount={autoCount} />
                    </>
                  )}
                </button>
              );

              return (
                <li key={section.id}>
                  {navCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{sectionButton}</TooltipTrigger>
                      <TooltipContent side="right">
                        <span>{label}</span>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    sectionButton
                  )}

                  {section.id === "5" && showInterviewNav && (
                    navCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setActiveSectionId(INTERVIEW_NAV_ID)}
                            aria-current={interviewActive ? "true" : undefined}
                            className={`group mt-1 flex w-full items-center justify-center rounded-lg border-l-2 px-2 py-2 text-left transition-colors ${
                              interviewActive
                                ? "border-red-600 bg-red-50 font-semibold text-red-900"
                                : "border-transparent text-foreground hover:bg-muted"
                            }`}
                          >
                            <SectionStatusIndicator status={intervieweeStatus} autoCount={0} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span>{INTERVIEW_NAV_LABEL}</span>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSectionId(INTERVIEW_NAV_ID)}
                        aria-current={interviewActive ? "true" : undefined}
                        className={`group mt-1 flex w-full items-center gap-3 rounded-lg border-l-2 py-2 pl-9 pr-3 text-left transition-colors ${
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
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3">
          {interviewActive ? renderInterviewEditor() : renderSectionBody(activeSectionId)}
        </div>
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={getDefaultOpenSections()}
      className="w-full"
    >
      {visibleSections.map((section) => {
        const autoCount = countAutoFilled(section.id);
        const statusMeta = getCompletionStatusMeta(getSectionStatus(section.id));

        return (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                {section.title}
                <Badge variant="outline" className={statusMeta.className}>
                  {statusMeta.label}
                </Badge>
                {autoCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="border-emerald-200 bg-emerald-50 text-xs font-normal text-emerald-800"
                  >
                    {autoCount} auto-filled
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>{renderSectionBody(section.id)}</AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
