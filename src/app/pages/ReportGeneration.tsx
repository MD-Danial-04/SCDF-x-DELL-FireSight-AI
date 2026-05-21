import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FileText, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";
import { StatusBanner } from "../components/StatusBanner";
import { Badge } from "../components/ui/badge";
import { getIncidentCategoryLabel } from "../constants/incidentTemplates";
import { useReportSession } from "../context/ReportSessionContext";
import { createEmptyReportFields, type FireReportData } from "../types/fireReport";
import { extractReportFields, mergeReportFields } from "../lib/extractReportFields";
import { parseSelectedAnnexes } from "../components/AnnexSelector";
import { validateAnnexPages } from "../constants/annexDefinitions";
import { downloadDocx, generateFireReportDocx } from "../lib/generateFireReportDocx";
import {
  observeDocxPreviewFit,
  scheduleDocxPreviewFit,
} from "../lib/fitDocxPreviewToViewport";
import { ReportFormFields } from "../components/ReportFormFields";

type Step = "review" | "edit";

export function ReportGeneration() {
  const { incidentType, stopMessage, fieldNotes } = useReportSession();
  const [step, setStep] = useState<Step>("review");
  const [reportFields, setReportFields] = useState<FireReportData>(() => createEmptyReportFields());
  const [extractedKeys, setExtractedKeys] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [docBlob, setDocBlob] = useState<Blob | null>(null);
  const [annexImageOverrides, setAnnexImageOverrides] = useState<Map<number, Blob>>(
    () => new Map()
  );
  const [annexPreviewUrls, setAnnexPreviewUrls] = useState<Record<number, string>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  const handleAnnexOverrideChange = useCallback((pageIndex: number, blob: Blob | null) => {
    setAnnexImageOverrides((prev) => {
      const next = new Map(prev);
      if (blob) next.set(pageIndex, blob);
      else next.delete(pageIndex);
      return next;
    });
    setAnnexPreviewUrls((prev) => {
      const next = { ...prev };
      if (prev[pageIndex]) URL.revokeObjectURL(prev[pageIndex]);
      if (blob) next[pageIndex] = URL.createObjectURL(blob);
      else delete next[pageIndex];
      return next;
    });
  }, []);

  const annexPreviewUrlsRef = useRef(annexPreviewUrls);
  annexPreviewUrlsRef.current = annexPreviewUrls;
  useEffect(() => {
    return () => {
      Object.values(annexPreviewUrlsRef.current).forEach((url) =>
        URL.revokeObjectURL(url)
      );
    };
  }, []);

  useEffect(() => {
    const extracted = extractReportFields(stopMessage, incidentType?.name);
    const keys = new Set(
      Object.entries(extracted)
        .filter(([, v]) => v && String(v).trim())
        .map(([k]) => k)
    );
    setExtractedKeys(keys);
    setReportFields(mergeReportFields(createEmptyReportFields(), extracted));
  }, [stopMessage, incidentType?.name]);

  const updateField = useCallback((key: keyof FireReportData, value: string) => {
    setReportFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const previewRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const previewScalerRef = useRef<HTMLDivElement>(null);

  const getPreviewElements = useCallback(() => {
    const viewport = previewViewportRef.current;
    const host = previewRef.current;
    const scaler = previewScalerRef.current;
    if (!viewport || !host || !scaler) return null;
    return { viewport, host, scaler };
  }, []);

  const schedulePreviewFit = useCallback(() => {
    const elements = getPreviewElements();
    if (!elements) return;
    scheduleDocxPreviewFit(elements);
  }, [getPreviewElements]);

  const renderPreview = useCallback(async (blob: Blob) => {
    setPreviewError(null);
    for (let attempt = 0; attempt < 5; attempt++) {
      if (previewRef.current) break;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    if (!previewRef.current) {
      setPreviewError("Preview panel is not ready yet. Try Update preview again.");
      return false;
    }
    previewRef.current.innerHTML = "";
    try {
      await renderAsync(blob, previewRef.current, undefined, {
        className: "docx-preview",
        inWrapper: true,
        breakPages: true,
        ignoreWidth: false,
        ignoreHeight: false,
        useBase64URL: true,
      });
      schedulePreviewFit();
      setPreviewVersion((v) => v + 1);
      return true;
    } catch (err) {
      console.error("Document preview failed:", err);
      const message =
        err instanceof Error ? err.message : "Document preview failed to render";
      setPreviewError(message);
      toast.error("Document preview failed to render");
      return false;
    }
  }, [schedulePreviewFit]);

  useEffect(() => {
    if (step !== "edit" || !docBlob) return;
    void renderPreview(docBlob);
  }, [step, docBlob, renderPreview]);

  useEffect(() => {
    if (previewVersion === 0) return;
    const elements = getPreviewElements();
    if (!elements) return;
    return observeDocxPreviewFit(elements);
  }, [getPreviewElements, previewVersion]);

  const handleGenerate = async () => {
    const selected = parseSelectedAnnexes(reportFields.selectedAnnexes);
    const { valid, missing } = validateAnnexPages(selected, annexImageOverrides);
    if (!valid) {
      const pages = missing.map((i) => (i === 8 ? "Annex G (page 8)" : `page ${i}`)).join(", ");
      toast.error(`Missing annex images: ${pages}. Paste or upload before generating.`);
      return;
    }

    setIsGenerating(true);
    try {
      const blob = await generateFireReportDocx(
        reportFields,
        selected,
        annexImageOverrides
      );
      setDocBlob(blob);
      setStep("edit");
      toast.success("Fire Investigation Report generated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report. Check template placeholders.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdatePreview = async () => {
    if (!docBlob) return;
    const selected = parseSelectedAnnexes(reportFields.selectedAnnexes);
    const { valid, missing } = validateAnnexPages(selected, annexImageOverrides);
    if (!valid) {
      const pages = missing.map((i) => (i === 8 ? "Annex G (page 8)" : `page ${i}`)).join(", ");
      toast.error(`Missing annex images: ${pages}. Paste or upload before updating.`);
      return;
    }

    setIsGenerating(true);
    try {
      const blob = await generateFireReportDocx(
        reportFields,
        selected,
        annexImageOverrides
      );
      setDocBlob(blob);
      await renderPreview(blob);
      toast.success("Preview updated");
    } catch {
      toast.error("Failed to update preview");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!docBlob) return;
    const name = `${reportFields.incidentNo}_Fire_Investigation_Report.docx`;
    downloadDocx(docBlob, name);
    toast.success("Report downloaded");
  };

  const stopPreview = useMemo(
    () => (stopMessage.length > 120 ? `${stopMessage.slice(0, 120)}…` : stopMessage),
    [stopMessage]
  );

  const fieldNotesPreview = useMemo(() => {
    if (!fieldNotes) return "";
    return fieldNotes.length > 80 ? `${fieldNotes.slice(0, 80)}…` : fieldNotes;
  }, [fieldNotes]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fire investigation report"
        description="Review extracted fields, generate the Word document, then edit and download."
        actions={
          incidentType ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline" className="font-medium">
                {getIncidentCategoryLabel(incidentType.category)}
              </Badge>
              <Badge variant="secondary" className="bg-brand-fire-muted text-primary border-red-100">
                {incidentType.name}
              </Badge>
            </div>
          ) : undefined
        }
      />

      <StatusBanner variant="success" title="Stop message captured">
        {stopMessage ? (
          <p className="font-mono text-xs sm:text-sm break-words">{stopPreview}</p>
        ) : (
          <p className="italic">No stop message — using field notes only</p>
        )}
        {fieldNotes && (
          <div className="pt-2 mt-2 border-t border-emerald-200/80">
            <p className="font-medium">
              Field notes ({fieldNotes.length} characters) — NLP extraction coming soon
            </p>
            <p className="font-mono text-xs mt-1 opacity-80">{fieldNotesPreview}</p>
          </div>
        )}
      </StatusBanner>

      {step === "review" && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Review extracted information</CardTitle>
            <CardDescription>
              Fields marked auto-filled were parsed from your stop message. Edit as needed, then generate the Word report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ReportFormFields
              fields={reportFields}
              extractedKeys={extractedKeys}
              onChange={updateField}
              annexPreviewUrls={annexPreviewUrls}
              onAnnexOverrideChange={handleAnnexOverrideChange}
            />
            <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Word Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "edit" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Edit report fields</CardTitle>
              <CardDescription>Changes apply when you update the preview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReportFormFields
                fields={reportFields}
                extractedKeys={extractedKeys}
                onChange={updateField}
                annexPreviewUrls={annexPreviewUrls}
                onAnnexOverrideChange={handleAnnexOverrideChange}
              />
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Button
                  onClick={handleUpdatePreview}
                  disabled={isGenerating}
                  variant="outline"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Update preview
                </Button>
                <Button onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download DOCX
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col rounded-xl shadow-sm xl:sticky xl:top-20 xl:self-start">
            <CardHeader>
              <CardTitle>Document preview</CardTitle>
              <CardDescription>Scroll to review pages — scaled to panel width</CardDescription>
            </CardHeader>
            <CardContent>
              {previewError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {previewError}
                </p>
              )}
              {!previewError && previewVersion === 0 && step === "edit" && docBlob && (
                <p className="mb-3 text-sm text-muted-foreground">Rendering preview…</p>
              )}
              <div
                ref={previewViewportRef}
                className="docx-preview-viewport overflow-auto border rounded-xl bg-muted/40 p-3 h-[min(480px,50vh)] xl:h-[min(calc(100vh-7rem),720px)]"
              >
                <div ref={previewScalerRef} className="docx-preview-scaler mx-auto">
                  <div ref={previewRef} className="docx-preview-host bg-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
