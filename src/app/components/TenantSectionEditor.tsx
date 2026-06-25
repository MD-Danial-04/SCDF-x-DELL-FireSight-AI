import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
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
import {
  mergeTenantFields,
  type MergeTenantFieldsResult,
} from "../lib/mergeTenantFields";
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
              className="mt-1 border-slate-400 bg-white font-mono text-sm text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
            />
          ) : (
            <Input
              id={config.key}
              value={fields[config.key]}
              onChange={(e) => onChange(config.key, e.target.value)}
              className="mt-1 border-slate-400 bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
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
  const { runExtraction, isExtracting } = useExtractionJob();
  const [localExtractedKeys, setLocalExtractedKeys] = useState<
    Set<FireReportFieldKey>
  >(new Set());
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  const combinedExtractedKeys = new Set<string>(extractedKeys);
  localExtractedKeys.forEach((key) => combinedExtractedKeys.add(key));

  const applyMerge = (merged: MergeTenantFieldsResult): boolean => {
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

  const applyFallback = (
    english: string,
    overwriteKeys?: Set<FireReportFieldKey>
  ): boolean => {
    const fallback = extractInterviewFields(english);
    return applyMerge(mergeTenantFields(fields, fallback, overwriteKeys));
  };

  const extractAndApply = async (
    text: string,
    jobId: string | null,
    overwriteKeys?: Set<FireReportFieldKey>
  ) => {
    const english = text.trim();
    if (!english) {
      toast.error("Add a transcript first");
      return;
    }

    if (!isCoordinatorConfigured() || !jobId) {
      if (applyFallback(english, overwriteKeys)) {
        toast.warning("Using local fallback extraction for tenant details");
      } else {
        toast.info("No new tenant details found in transcript");
      }
      return;
    }

    try {
      const job = await runExtraction({
        jobId,
        text: english,
        messageType: "interview",
      });

      const merged = mergeTenantFields(
        fields,
        job.interview_details_result,
        overwriteKeys
      );
      if (applyMerge(merged)) {
        toast.success(`Tenant details extracted (${merged.updates.length} fields)`);
      } else if (applyFallback(english, overwriteKeys)) {
        toast.warning("Using local fallback extraction for tenant details");
      } else {
        toast.info("No new tenant details found in transcript");
      }
    } catch (err) {
      if (applyFallback(english, overwriteKeys)) {
        toast.warning("Using local fallback extraction for tenant details");
      } else {
        toast.error(
          err instanceof Error ? err.message : "Tenant detail extraction failed"
        );
      }
    }
  };

  const applyTranscript = async (
    _original: string,
    english: string,
    jobId: string
  ) => {
    onChange("tenantInterviewTranscript", english);
    setLastJobId(jobId);
    await extractAndApply(english, jobId);
  };

  const reExtract = () => {
    void extractAndApply(
      fields.tenantInterviewTranscript,
      lastJobId,
      localExtractedKeys
    );
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

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="tenantInterviewTranscript">Transcript</Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={reExtract}
                disabled={!fields.tenantInterviewTranscript.trim() || isExtracting}
              >
                {isExtracting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Extract details from transcript
              </Button>
            </div>
            <Textarea
              id="tenantInterviewTranscript"
              value={fields.tenantInterviewTranscript}
              onChange={(e) =>
                onChange("tenantInterviewTranscript", e.target.value)
              }
              rows={6}
              placeholder="The tenant interview transcript appears here after recording, and can be edited..."
              className="mt-1 border-slate-400 bg-white font-mono text-sm text-slate-950 shadow-sm ring-1 ring-slate-200 focus-visible:border-red-400 focus-visible:ring-red-200"
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
