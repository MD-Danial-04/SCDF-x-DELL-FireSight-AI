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
import type { FireReportData, FireReportFieldKey } from "../types/fireReport";
import { EXTRACTABLE_KEYS } from "../types/fireReport";
import {
  REPORT_FORM_SECTIONS,
  getAllSectionFields,
  getDefaultOpenSections,
  type ReportFormFieldConfig,
} from "../constants/reportFormSections";
import { AnnexSelector, parseSelectedAnnexes } from "./AnnexSelector";
import { getAnnexById } from "../constants/annexDefinitions";

interface ReportFormFieldsProps {
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
  annexPreviewUrls?: Record<number, string>;
  onAnnexOverrideChange?: (pageIndex: number, blob: Blob | null) => void;
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
          className="mt-1 font-mono text-sm"
        />
      ) : (
        <Input
          id={key}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          className="mt-1"
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
  annexPreviewUrls = {},
  onAnnexOverrideChange,
}: ReportFormFieldsProps) {
  const countAutoFilled = (sectionId: string) => {
    const section = REPORT_FORM_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return 0;
    return getAllSectionFields(section).filter((f) => extractedKeys.has(f.key)).length;
  };

  return (
    <Accordion
      type="multiple"
      defaultValue={getDefaultOpenSections()}
      className="w-full"
    >
      {REPORT_FORM_SECTIONS.map((section) => {
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
            <AccordionContent className="pt-2 pb-4">
              {section.id === "8" && (
                <div className="mb-4">
                  <AnnexSelector
                    selectedIds={parseSelectedAnnexes(fields.selectedAnnexes)}
                    overrides={annexPreviewUrls}
                    onOverrideChange={onAnnexOverrideChange}
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
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
