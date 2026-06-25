import { useEffect, useState } from "react";
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
import {
  REPORT_FORM_SECTIONS,
  getAllSectionFields,
  getDefaultOpenSections,
  type ReportFormFieldConfig,
} from "../constants/reportFormSections";
import { TenantSectionEditor } from "./TenantSectionEditor";
import {
  buildAnnexAttachmentList,
  getAnnexById,
} from "../constants/annexDefinitions";
import type { PhotoAnalysisPartialEntry, PhotoAnalysisReportContext } from "../lib/buildPhotoAnalysisContext";
import type { SuggestedPhotoSection } from "../types/photoAnalysis";
import type { PhotoLogAnnexPreviewUrls, PhotoLogEntry } from "../types/photoLog";
import type { FireReportData, FireReportFieldKey } from "../types/fireReport";
import { EXTRACTABLE_KEYS } from "../types/fireReport";
import type { Interviewee } from "../types/interviewee";

interface ReportFormFieldsProps {
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
  visibleSectionIds?: string[];
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
  photoLogAnnexPreviewUrls?: PhotoLogAnnexPreviewUrls;
  photoLogPreviewLoading?: boolean;
  floorplanSvg?: string | null;
  onFloorplanSvgChange?: (svg: string | null) => void;
  onIntervieweesChange?: (interviewees: Interviewee[]) => void;
  onGenerateStatement?: (intervieweeId: string) => void;
  onGenerateAllStatements?: () => void;
  onPreviewStatement?: (intervieweeId: string) => Promise<Blob>;
  generatingStatementId?: string | null;
  isGeneratingAllStatements?: boolean;
}

type CompletionStatus = "not-edited" | "partial" | "complete";

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

function Field({
  config,
  value,
  onChange,
  extracted,
}: {
  config: ReportFormFieldConfig;
  value: string;
  onChange: (key: FireReportFieldKey, value: string) => void;
  extracted?: boolean;
}) {
  const { key, label, multiline } = config;

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
          className="mt-1 border-slate-400 bg-white font-mono text-sm text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
        />
      ) : (
        <Input
          id={key}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          className="mt-1 border-slate-400 bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
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
}: {
  fieldConfigs: ReportFormFieldConfig[];
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
}) {
  const isExtracted = (config: ReportFormFieldConfig) =>
    (config.extractable || EXTRACTABLE_KEYS.includes(config.key)) &&
    extractedKeys.has(config.key);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {fieldConfigs.map((config) => (
        <div
          key={config.key}
          className={config.multiline ? "md:col-span-2" : undefined}
        >
          <Field
            config={config}
            value={fields[config.key]}
            onChange={onChange}
            extracted={isExtracted(config)}
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
}: {
  sectionId: string;
  subsectionTitle: string;
  fieldConfigs: ReportFormFieldConfig[];
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
}) {
  const statusMeta = getCompletionStatusMeta(getFieldConfigsStatus(fieldConfigs, fields));

  const content = (
    <FieldsGrid
      fieldConfigs={fieldConfigs}
      fields={fields}
      extractedKeys={extractedKeys}
      onChange={onChange}
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
  photoLogAnnexPreviewUrls = { D: [], F: [] },
  photoLogPreviewLoading = false,
  floorplanSvg = null,
  onFloorplanSvgChange,
  onIntervieweesChange,
  onGenerateStatement,
  onGenerateAllStatements,
  onPreviewStatement,
  generatingStatementId,
  isGeneratingAllStatements = false,
}: ReportFormFieldsProps) {
  const countAutoFilled = (sectionId: string) => {
    const section = REPORT_FORM_SECTIONS.find((item) => item.id === sectionId);
    if (!section) return 0;
    return getAllSectionFields(section).filter((field) => extractedKeys.has(field.key)).length;
  };

  const getSectionStatus = (sectionId: string): CompletionStatus => {
    const section = REPORT_FORM_SECTIONS.find((item) => item.id === sectionId);
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

    const intervieweeStatuses =
      section.id === "5" && onIntervieweesChange
        ? [getIntervieweesStatus(fields.interviewees)]
        : [];

    const statuses = [...directStatuses, ...subsectionStatuses, ...intervieweeStatuses];

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
    ? REPORT_FORM_SECTIONS.filter((section) => visibleSectionIds.includes(section.id))
    : REPORT_FORM_SECTIONS;

  const [activeSectionId, setActiveSectionId] = useState<string>(visibleSections[0]?.id ?? "");

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(visibleSections[0]?.id ?? "");
    }
  }, [activeSectionId, visibleSections]);

  function renderSectionBody(sectionId: string) {
    const section = visibleSections.find((item) => item.id === sectionId);
    if (!section) return null;

    const intervieweeStatusMeta = getCompletionStatusMeta(
      getIntervieweesStatus(fields.interviewees)
    );

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
              onFloorplanSvgChange={onFloorplanSvgChange}
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
                        field.key !== "annexReferenceSource" && field.key !== "selectedAnnexes"
                    )
                  : section.fields
              }
              fields={fields}
              extractedKeys={extractedKeys}
              onChange={onChange}
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
          />
        ))}

        {section.id === "5" && onIntervieweesChange && (
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
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {visibleSections.map((section) => {
            const autoCount = countAutoFilled(section.id);
            const isActive = section.id === activeSectionId;
            const statusMeta = getCompletionStatusMeta(getSectionStatus(section.id));

            return (
              <Button
                key={section.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                className="h-auto min-h-10 max-w-full items-start px-3 py-2 text-left whitespace-normal"
                onClick={() => setActiveSectionId(section.id)}
              >
                <span className="flex flex-col items-start gap-1">
                  <span className="text-xs sm:text-sm">{section.title}</span>
                  <Badge variant="outline" className={statusMeta.className}>
                    {statusMeta.label}
                  </Badge>
                  {autoCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="border-emerald-200 bg-emerald-50 text-emerald-800"
                    >
                      {autoCount} auto-filled
                    </Badge>
                  )}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="rounded-xl border bg-background px-4 py-3">
          {renderSectionBody(activeSectionId)}
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
