import { useState } from "react";
import { toast } from "sonner";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { InterviewRecordingCard } from "./InterviewRecordingCard";
import {
  TENANT_CONTACT_FIELDS,
  TENANT_PERSONAL_FIELDS,
  type ReportFormFieldConfig,
} from "../constants/reportFormSections";
import { useExtractionJob } from "../hooks/useExtractionJob";
import { extractInterviewFields } from "../lib/extractInterviewFields";
import { mergeTenantFields } from "../lib/mergeTenantFields";
import type { FireReportData, FireReportFieldKey } from "../types/fireReport";
import { EXTRACTABLE_KEYS } from "../types/fireReport";
import { isCoordinatorConfigured } from "../types/inference";

const DEFAULT_OPEN_SECTIONS = ["personal"];

interface TenantSectionEditorProps {
  fields: FireReportData;
  extractedKeys: Set<string>;
  onChange: (key: FireReportFieldKey, value: string) => void;
}

function TenantFieldGrid({
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
          <Label htmlFor={config.key} className="flex items-center gap-2">
            {config.label}
            {isExtracted(config) ? (
              <span className="text-xs font-normal text-green-600">(auto-filled)</span>
            ) : null}
          </Label>
          {config.multiline ? (
            <Textarea
              id={config.key}
              value={fields[config.key]}
              onChange={(e) => onChange(config.key, e.target.value)}
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          ) : (
            <Input
              id={config.key}
              value={fields[config.key]}
              onChange={(e) => onChange(config.key, e.target.value)}
              className="mt-1"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function TenantSectionEditor({
  fields,
  extractedKeys,
  onChange,
}: TenantSectionEditorProps) {
  const { runExtraction } = useExtractionJob();
  const [localExtractedKeys, setLocalExtractedKeys] = useState<
    Set<FireReportFieldKey>
  >(new Set());

  const combinedExtractedKeys = new Set<string>(extractedKeys);
  localExtractedKeys.forEach((key) => combinedExtractedKeys.add(key));

  const applyFallback = (english: string): boolean => {
    const fallback = extractInterviewFields(english);
    const merged = mergeTenantFields(fields, fallback);
    if (merged.updates.length === 0) {
      return false;
    }
    merged.updates.forEach((update) => onChange(update.key, update.value));
    setLocalExtractedKeys((prev) => {
      const next = new Set(prev);
      merged.extractedKeys.forEach((key) => next.add(key));
      return next;
    });
    return true;
  };

  const applyTranscript = async (
    _original: string,
    english: string,
    jobId: string
  ) => {
    if (!isCoordinatorConfigured()) {
      if (applyFallback(english)) {
        toast.warning("Using local fallback extraction for tenant details");
      }
      return;
    }

    try {
      const job = await runExtraction({
        jobId,
        text: english,
        messageType: "interview",
      });

      const merged = mergeTenantFields(fields, job.interview_details_result);
      if (merged.updates.length === 0) {
        if (applyFallback(english)) {
          toast.warning("Using local fallback extraction for tenant details");
        }
        return;
      }

      merged.updates.forEach((update) => onChange(update.key, update.value));
      setLocalExtractedKeys((prev) => {
        const next = new Set(prev);
        merged.extractedKeys.forEach((key) => next.add(key));
        return next;
      });
      toast.success(`Tenant details extracted (${merged.updates.length} fields)`);
    } catch (err) {
      if (applyFallback(english)) {
        toast.warning("Using local fallback extraction for tenant details");
      } else {
        toast.error(
          err instanceof Error ? err.message : "Tenant detail extraction failed"
        );
      }
    }
  };

  return (
    <Accordion type="multiple" defaultValue={DEFAULT_OPEN_SECTIONS} className="w-full">
      <AccordionItem value="personal">
        <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
          Personal details
        </AccordionTrigger>
        <AccordionContent>
          <TenantFieldGrid
            fieldConfigs={TENANT_PERSONAL_FIELDS}
            fields={fields}
            extractedKeys={combinedExtractedKeys}
            onChange={onChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="contact">
        <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
          Contact numbers
        </AccordionTrigger>
        <AccordionContent>
          <TenantFieldGrid
            fieldConfigs={TENANT_CONTACT_FIELDS}
            fields={fields}
            extractedKeys={combinedExtractedKeys}
            onChange={onChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="interview">
        <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
          Record interview
        </AccordionTrigger>
        <AccordionContent>
          <InterviewRecordingCard
            description="Record the tenant interview, then empty tenant fields above are auto-filled from the transcript"
            interviewLanguage="en"
            onInterviewLanguageChange={() => {}}
            showLanguageSelect={false}
            appliedToastMessage="Transcript captured - extracting tenant details"
            onTranscriptsComplete={applyTranscript}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
