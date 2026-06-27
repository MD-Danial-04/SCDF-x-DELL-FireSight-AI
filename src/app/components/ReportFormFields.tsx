import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnnexSelector, parseSelectedAnnexes } from "./AnnexSelector";
import { IntervieweeListEditor } from "./IntervieweeListEditor";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
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
  REPORT_FORM_SECTIONS,
  getDefaultOpenSections,
  type ReportFormFieldConfig,
  type ReportFormSectionConfig,
} from "../constants/reportFormSections";
import {
  INTERVIEW_NAV_ID,
  INTERVIEW_NAV_LABEL,
  buildSectionNavOrder,
  countAutoFilled,
  getCompletionStatusMeta,
  getFieldConfigsStatus,
  getIntervieweesStatus,
  getSectionStatus,
  parseSectionTitle,
} from "../lib/reportSectionStatus";
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
  /** Controlled active section id (tabs mode); the drawer/hamburger is owned by ReportEditorNav. */
  activeSectionId?: string;
  /** Called when the in-page prev/next buttons move to an adjacent section (tabs mode). */
  onActiveSectionChange?: (id: string) => void;
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
      <Label htmlFor={key} className="flex items-center gap-2 text-sm">
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
          className="mt-1 border-slate-200/70 bg-white/95 text-sm text-slate-950 shadow-sm ring-1 ring-slate-100 focus-visible:border-slate-300 focus-visible:ring-primary/15"
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
  activeSectionId: activeSectionIdProp,
  onActiveSectionChange,
}: ReportFormFieldsProps) {
  const statusCtx = { fields, floorplanSvg, photos, annexPreviewUrls };

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

  const [internalActiveSectionId, setInternalActiveSectionId] = useState<string>(
    visibleSections[0]?.id ?? ""
  );
  const activeSectionId = activeSectionIdProp ?? internalActiveSectionId;

  useEffect(() => {
    if (activeSectionIdProp !== undefined) return;
    const validIds = visibleSections.map((section) => section.id);
    if (showInterviewNav) validIds.push(INTERVIEW_NAV_ID);
    if (!validIds.includes(internalActiveSectionId)) {
      setInternalActiveSectionId(visibleSections[0]?.id ?? "");
    }
  }, [activeSectionIdProp, internalActiveSectionId, visibleSections, showInterviewNav]);

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
    const interviewActive = activeSectionId === INTERVIEW_NAV_ID;
    const activeSection = visibleSections.find((section) => section.id === activeSectionId);
    const activeParsed = activeSection ? parseSectionTitle(activeSection.title) : null;
    const headingEyebrow = interviewActive ? "Section 5" : activeParsed?.number ? `Section ${activeParsed.number}` : null;
    const headingTitle = interviewActive ? INTERVIEW_NAV_LABEL : activeParsed?.label ?? "";

    const navOrder = buildSectionNavOrder(
      visibleSections.map((section) => section.id),
      showInterviewNav
    );
    const currentIndex = navOrder.indexOf(activeSectionId);
    const prevId = currentIndex > 0 ? navOrder[currentIndex - 1] : null;
    const nextId =
      currentIndex >= 0 && currentIndex < navOrder.length - 1
        ? navOrder[currentIndex + 1]
        : null;

    return (
      <div className="min-w-0 rounded-xl border bg-background px-4 py-3">
        {headingTitle && (
          <div className="mb-3 border-b pb-3">
            {headingEyebrow && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {headingEyebrow}
              </p>
            )}
            <h3 className="text-base font-semibold text-foreground">{headingTitle}</h3>
          </div>
        )}
        {interviewActive ? renderInterviewEditor() : renderSectionBody(activeSectionId)}
        {onActiveSectionChange && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!prevId}
              onClick={() => prevId && onActiveSectionChange(prevId)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nextId}
              onClick={() => nextId && onActiveSectionChange(nextId)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
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
        const autoCount = countAutoFilled(section.id, extractedKeys);
        const statusMeta = getCompletionStatusMeta(getSectionStatus(section.id, statusCtx));

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
