import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { FireReportData, FireReportFieldKey } from "../types/fireReport";
import { EXTRACTABLE_KEYS } from "../types/fireReport";
import {
  REPORT_FORM_SECTIONS,
  getAllSectionFields,
  getDefaultOpenSections,
  type ReportFormFieldConfig,
} from "../constants/reportFormSections";
import { AnnexSelector, parseSelectedAnnexes } from "./AnnexSelector";
import { IntervieweeListEditor } from "./IntervieweeListEditor";
import type { Interviewee } from "../types/interviewee";
import type { PhotoLogAnnexPreviewUrls, PhotoLogEntry } from "../types/photoLog";
import type { PhotoAnalysisPartialEntry, PhotoAnalysisReportContext } from "../lib/buildPhotoAnalysisContext";
import type { SuggestedPhotoSection } from "../types/photoAnalysis";
import {
  buildAnnexAttachmentList,
  getAnnexById,
  sortAnnexIds,
} from "../constants/annexDefinitions";

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
  generatingStatementId?: string | null;
  isGeneratingAllStatements?: boolean;
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
          className="mt-1 border-slate-300 bg-slate-50 font-mono text-sm text-slate-900 shadow-sm focus-visible:border-red-300 focus-visible:bg-white"
        />
      ) : (
        <Input
          id={key}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          className="mt-1 border-slate-300 bg-slate-50 text-slate-900 shadow-sm focus-visible:border-red-300 focus-visible:bg-white"
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
  generatingStatementId,
  isGeneratingAllStatements = false,
}: ReportFormFieldsProps) {
  const countAutoFilled = (sectionId: string) => {
    const section = REPORT_FORM_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return 0;
    return getAllSectionFields(section).filter((f) => extractedKeys.has(f.key)).length;
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

    return (
      <div className="pt-2 pb-4">
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
                const a = getAnnexById("A");
                const b = getAnnexById("B");
                if (a) onChange("annexLayoutPlan", ids.includes("A") ? a.title : "");
                if (b) onChange("annexPhotographs", ids.includes("B") ? b.title : "");
              }}
            />
          </div>
        )}
        {section.fields && (
          <FieldsGrid
            fieldConfigs={
              section.id === "8"
                ? section.fields.filter(
                    (f) => f.key !== "annexReferenceSource" && f.key !== "selectedAnnexes"
                  )
                : section.fields
            }
            fields={fields}
            extractedKeys={extractedKeys}
            onChange={onChange}
          />
        )}
        {section.subsections?.map((sub) => (
          <div key={sub.title} className="mb-5 last:mb-0">
            <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 border-l-2 border-red-400 pl-2">
              {sub.title}
            </h5>
            <FieldsGrid
              fieldConfigs={sub.fields}
              fields={fields}
              extractedKeys={extractedKeys}
              onChange={onChange}
            />
          </div>
        ))}
        {section.id === "5" && onIntervieweesChange && (
          <IntervieweeListEditor
            interviewees={fields.interviewees}
            onChange={onIntervieweesChange}
            investigatorNameRank={fields.investigatorNameRank}
            onGenerateStatement={onGenerateStatement}
            onGenerateAllStatements={onGenerateAllStatements}
            generatingStatementId={generatingStatementId}
            isGeneratingAll={isGeneratingAllStatements}
          />
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
                  {autoCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-50 text-emerald-800 border-emerald-200"
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
        return (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                {section.title}
                {autoCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal bg-emerald-50 text-emerald-800 border-emerald-200"
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
