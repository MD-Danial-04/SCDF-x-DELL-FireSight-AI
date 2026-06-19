import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FileText, Download, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";
import { StatusBanner } from "../components/StatusBanner";
import { Badge } from "../components/ui/badge";
import { getIncidentCategoryLabel } from "../constants/incidentTemplates";
import { useReportSession } from "../context/ReportSessionContext";
import { createEmptyReportFields, type FireReportData } from "../types/fireReport";
import { extractReportFields, mergeReportFields } from "../lib/extractReportFields";
import type { Interviewee } from "../types/interviewee";
import { parseSelectedAnnexes } from "../components/AnnexSelector";
import { validateAnnexPages, getRequiredPageIndices } from "../constants/annexDefinitions";
import { downloadDocx, generateFireReportDocx } from "../lib/generateFireReportDocx";
import { generatePrrDocx, getPrrFilename } from "../lib/generatePrrDocx";
import {
  generateStatementDocx,
  getStatementFilename,
} from "../lib/generateStatementDocx";
import {
  compositeHeaderValuesOntoTemplate,
  ANNEX_E_PAGE_INDEX,
  hasHeaderValues,
} from "../lib/annexHeaderOverlay";
import { getDefaultPagePreviewUrl } from "../lib/annexImageAssets";
import {
  observeDocxPreviewFit,
  scheduleDocxPreviewFit,
} from "../lib/fitDocxPreviewToViewport";
import { ReportFormFields } from "../components/ReportFormFields";
import { generateAnnexDBlobs, generateAnnexFBlobs } from "../lib/photoLogAnnexes";
import {
  createPhotoCopy,
  createPhotoLogEntry,
  type PhotoLogAnnexPreviewUrls,
  type PhotoLogEntry,
} from "../types/photoLog";

type Step = "review" | "edit";

/** Static annex template pages (A/B/C/E/G) that receive header value overlays. */
const STATIC_HEADER_PAGE_INDICES = [0, 1, 2, 4, 8];

interface ReportGenerationProps {
  onBack?: () => void;
}

export function ReportGeneration({ onBack }: ReportGenerationProps) {
  const navigate = useNavigate();
  const { incidentType, stopMessage, fieldNotes } = useReportSession();
  const [step, setStep] = useState<Step>("review");
  const [reportFields, setReportFields] = useState<FireReportData>(() => createEmptyReportFields());
  const [extractedKeys, setExtractedKeys] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrr, setIsGeneratingPrr] = useState(false);
  const [generatingStatementId, setGeneratingStatementId] = useState<string | null>(null);
  const [isGeneratingAllStatements, setIsGeneratingAllStatements] = useState(false);
  const [docBlob, setDocBlob] = useState<Blob | null>(null);
  const [annexImageOverrides, setAnnexImageOverrides] = useState<Map<number, Blob>>(
    () => new Map()
  );
  const [annexPreviewUrls, setAnnexPreviewUrls] = useState<Record<number, string>>({});
  const [annexHeaderPreviewUrls, setAnnexHeaderPreviewUrls] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<PhotoLogEntry[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});
  const [photoLogAnnexPreviewUrls, setPhotoLogAnnexPreviewUrls] =
    useState<PhotoLogAnnexPreviewUrls>({ D: [], F: [] });
  const [photoLogPreviewLoading, setPhotoLogPreviewLoading] = useState(false);
  const [floorplanSvg, setFloorplanSvg] = useState<string | null>(null);
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

  const handleAddPhotos = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    const entries = fileArray.map((file) => createPhotoLogEntry(file));
    setPhotos((prev) => [...prev, ...entries]);
    setPhotoPreviewUrls((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        next[entry.id] = URL.createObjectURL(entry.blob);
      }
      return next;
    });
  }, []);

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const removedIds = new Set<string>([id]);
      for (const photo of prev) {
        if (photo.copyOfId === id) removedIds.add(photo.id);
      }

      setPhotoPreviewUrls((urls) => {
        const next = { ...urls };
        for (const removedId of removedIds) {
          if (next[removedId]) {
            URL.revokeObjectURL(next[removedId]);
            delete next[removedId];
          }
        }
        return next;
      });

      return prev.filter((p) => !removedIds.has(p.id));
    });
  }, []);

  const handleCopyPhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1) return prev;

      const original = prev[index];
      if (original.isCopy) return prev;

      const copy = createPhotoCopy(original);
      setPhotoPreviewUrls((urls) => ({
        ...urls,
        [copy.id]: URL.createObjectURL(copy.blob),
      }));

      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  const handleReorderPhoto = useCallback((id: string, direction: "up" | "down") => {
    setPhotos((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const selectedAnnexes = useMemo(
    () => parseSelectedAnnexes(reportFields.selectedAnnexes),
    [reportFields.selectedAnnexes],
  );

  const annexPreviewUrlsRef = useRef(annexPreviewUrls);
  annexPreviewUrlsRef.current = annexPreviewUrls;
  const annexHeaderPreviewUrlsRef = useRef(annexHeaderPreviewUrls);
  annexHeaderPreviewUrlsRef.current = annexHeaderPreviewUrls;
  const annexImageOverridesRef = useRef(annexImageOverrides);
  annexImageOverridesRef.current = annexImageOverrides;
  const photoPreviewUrlsRef = useRef(photoPreviewUrls);
  photoPreviewUrlsRef.current = photoPreviewUrls;
  const photoLogAnnexPreviewUrlsRef = useRef(photoLogAnnexPreviewUrls);
  photoLogAnnexPreviewUrlsRef.current = photoLogAnnexPreviewUrls;

  const revokePhotoLogAnnexUrls = useCallback((urls: PhotoLogAnnexPreviewUrls) => {
    urls.D.forEach((url) => URL.revokeObjectURL(url));
    urls.F.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(annexPreviewUrlsRef.current).forEach((url) =>
        URL.revokeObjectURL(url),
      );
      Object.values(annexHeaderPreviewUrlsRef.current).forEach((url) =>
        URL.revokeObjectURL(url),
      );
      Object.values(photoPreviewUrlsRef.current).forEach((url) =>
        URL.revokeObjectURL(url),
      );
      revokePhotoLogAnnexUrls(photoLogAnnexPreviewUrlsRef.current);
    };
  }, [revokePhotoLogAnnexUrls]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const dSelected = selectedAnnexes.includes("D");
      const fSelected = selectedAnnexes.includes("F");

      if ((!dSelected && !fSelected) || photos.length === 0) {
        revokePhotoLogAnnexUrls(photoLogAnnexPreviewUrlsRef.current);
        const empty = { D: [], F: [] };
        photoLogAnnexPreviewUrlsRef.current = empty;
        setPhotoLogAnnexPreviewUrls(empty);
        return;
      }

      setPhotoLogPreviewLoading(true);
      try {
        const header = {
          incidentNo: reportFields.incidentNo,
          locationOfFire: reportFields.locationOfFire,
        };

        const [dBlobs, fBlobs] = await Promise.all([
          dSelected ? generateAnnexDBlobs(photos, header) : Promise.resolve([]),
          fSelected ? generateAnnexFBlobs(photos, header) : Promise.resolve([]),
        ]);

        revokePhotoLogAnnexUrls(photoLogAnnexPreviewUrlsRef.current);

        const next: PhotoLogAnnexPreviewUrls = {
          D: dBlobs.map((blob) => URL.createObjectURL(blob)),
          F: fBlobs.map((blob) => URL.createObjectURL(blob)),
        };
        photoLogAnnexPreviewUrlsRef.current = next;
        setPhotoLogAnnexPreviewUrls(next);
      } catch (err) {
        console.error("Photo log annex preview failed:", err);
      } finally {
        setPhotoLogPreviewLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [
    photos,
    reportFields.incidentNo,
    reportFields.locationOfFire,
    selectedAnnexes,
    revokePhotoLogAnnexUrls,
  ]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const header = {
        incidentNo: reportFields.incidentNo,
        locationOfFire: reportFields.locationOfFire,
      };

      const requiredPages = getRequiredPageIndices(selectedAnnexes);
      const pagesToRender = STATIC_HEADER_PAGE_INDICES.filter(
        (pageIndex) =>
          requiredPages.includes(pageIndex) &&
          !annexImageOverridesRef.current.has(pageIndex),
      );

      if (!hasHeaderValues(header) || pagesToRender.length === 0) {
        Object.values(annexHeaderPreviewUrlsRef.current).forEach((url) =>
          URL.revokeObjectURL(url),
        );
        annexHeaderPreviewUrlsRef.current = {};
        setAnnexHeaderPreviewUrls({});
        return;
      }

      try {
        const entries = await Promise.all(
          pagesToRender.map(async (pageIndex) => {
            const templateUrl = getDefaultPagePreviewUrl(pageIndex);
            if (!templateUrl) return null;
            const response = await fetch(templateUrl);
            const templateBlob = await response.blob();
            const withHeader = await compositeHeaderValuesOntoTemplate(
              templateBlob,
              header,
              { boldUnderline: pageIndex === ANNEX_E_PAGE_INDEX },
            );
            return [pageIndex, URL.createObjectURL(withHeader)] as const;
          }),
        );

        const next: Record<number, string> = {};
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }

        Object.values(annexHeaderPreviewUrlsRef.current).forEach((url) =>
          URL.revokeObjectURL(url),
        );
        annexHeaderPreviewUrlsRef.current = next;
        setAnnexHeaderPreviewUrls(next);
      } catch (err) {
        console.error("Annex header preview failed:", err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [
    reportFields.incidentNo,
    reportFields.locationOfFire,
    selectedAnnexes,
    annexImageOverrides,
  ]);

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

  const updateInterviewees = useCallback((interviewees: Interviewee[]) => {
    setReportFields((prev) => ({ ...prev, interviewees }));
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
        annexImageOverrides,
        photos,
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
        annexImageOverrides,
        photos,
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

  const handleGeneratePrr = async () => {
    setIsGeneratingPrr(true);
    try {
      const blob = await generatePrrDocx(reportFields);
      downloadDocx(blob, getPrrFilename(reportFields.incidentNo));
      toast.success("PRR downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PRR. Check template placeholders.");
    } finally {
      setIsGeneratingPrr(false);
    }
  };

  const handleGenerateStatement = async (intervieweeId: string) => {
    const interviewee = reportFields.interviewees.find((i) => i.id === intervieweeId);
    if (!interviewee) return;

    setGeneratingStatementId(intervieweeId);
    try {
      const blob = await generateStatementDocx(interviewee, reportFields);
      downloadDocx(
        blob,
        getStatementFilename(reportFields.incidentNo, interviewee.name || "Interviewee")
      );
      toast.success("Statement form downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate statement form. Check template placeholders.");
    } finally {
      setGeneratingStatementId(null);
    }
  };

  const handleGenerateAllStatements = async () => {
    if (reportFields.interviewees.length === 0) return;

    setIsGeneratingAllStatements(true);
    try {
      for (const interviewee of reportFields.interviewees) {
        const blob = await generateStatementDocx(interviewee, reportFields);
        downloadDocx(
          blob,
          getStatementFilename(reportFields.incidentNo, interviewee.name || "Interviewee")
        );
      }
      toast.success(
        reportFields.interviewees.length === 1
          ? "Statement form downloaded"
          : `${reportFields.interviewees.length} statement forms downloaded`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate statement forms.");
    } finally {
      setIsGeneratingAllStatements(false);
    }
  };

  const stopPreview = useMemo(
    () => (stopMessage.length > 120 ? `${stopMessage.slice(0, 120)}…` : stopMessage),
    [stopMessage]
  );

  const fieldNotesPreview = useMemo(() => {
    if (!fieldNotes) return "";
    return fieldNotes.length > 80 ? `${fieldNotes.slice(0, 80)}…` : fieldNotes;
  }, [fieldNotes]);

  const handlePrevious = () => {
    if (onBack) onBack();
    else navigate("/incident");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fire investigation report"
        description="Review extracted fields, generate the Word document, then edit and download."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGeneratePrr}
              disabled={isGeneratingPrr}
            >
              {isGeneratingPrr ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate PRR
            </Button>
            {incidentType ? (
              <>
                <Badge variant="outline" className="font-medium">
                  {getIncidentCategoryLabel(incidentType.category)}
                </Badge>
                <Badge variant="secondary" className="bg-brand-fire-muted text-primary border-red-100">
                  {incidentType.name}
                </Badge>
              </>
            ) : null}
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={handlePrevious}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        {step === "review" &&
          (docBlob ? (
            <Button type="button" variant="outline" onClick={() => setStep("edit")}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled
              title="Generate report to continue"
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ))}
      </div>

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
              annexHeaderPreviewUrls={annexHeaderPreviewUrls}
              onAnnexOverrideChange={handleAnnexOverrideChange}
              photos={photos}
              photoPreviewUrls={photoPreviewUrls}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
              onReorderPhoto={handleReorderPhoto}
              onCopyPhoto={handleCopyPhoto}
              photoLogAnnexPreviewUrls={photoLogAnnexPreviewUrls}
              photoLogPreviewLoading={photoLogPreviewLoading}
              floorplanSvg={floorplanSvg}
              onFloorplanSvgChange={setFloorplanSvg}
              onIntervieweesChange={updateInterviewees}
              onGenerateStatement={handleGenerateStatement}
              onGenerateAllStatements={handleGenerateAllStatements}
              generatingStatementId={generatingStatementId}
              isGeneratingAllStatements={isGeneratingAllStatements}
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
                annexHeaderPreviewUrls={annexHeaderPreviewUrls}
                onAnnexOverrideChange={handleAnnexOverrideChange}
                photos={photos}
                photoPreviewUrls={photoPreviewUrls}
                onAddPhotos={handleAddPhotos}
                onRemovePhoto={handleRemovePhoto}
                onReorderPhoto={handleReorderPhoto}
                onCopyPhoto={handleCopyPhoto}
                photoLogAnnexPreviewUrls={photoLogAnnexPreviewUrls}
                photoLogPreviewLoading={photoLogPreviewLoading}
                floorplanSvg={floorplanSvg}
                onFloorplanSvgChange={setFloorplanSvg}
                onIntervieweesChange={updateInterviewees}
                onGenerateStatement={handleGenerateStatement}
                onGenerateAllStatements={handleGenerateAllStatements}
                generatingStatementId={generatingStatementId}
                isGeneratingAllStatements={isGeneratingAllStatements}
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
