import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FileText, Download, Loader2, RefreshCw, Save } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "../components/PageHeader";
import { StatusBanner } from "../components/StatusBanner";
import { ExtractionLoadingScreen } from "../components/ExtractionLoadingScreen";
import { remainingMinDelayMs, randomDemoDelayMs } from "../lib/loadingTiming";
import { Badge } from "../components/ui/badge";
import { getIncidentCategoryLabel } from "../constants/incidentTemplates";
import { useReportSession } from "../context/ReportSessionContext";
import { createEmptyReportFields, type FireReportData } from "../types/fireReport";
import { extractReportFields, mergeReportFields } from "../lib/extractReportFields";
import {
  migrateLegacyPhotoRefs,
  resolvePhotoRefText,
} from "../lib/applyPhotoSectionRef";
import type { PhotoAnalysisPartialEntry } from "../lib/buildPhotoAnalysisContext";
import { useExtractionJob } from "../hooks/useExtractionJob";
import { isInferenceConfigured } from "../types/inference";
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
  fitDocxPreviewToWidth,
  observeDocxPreviewFit,
  scheduleDocxPreviewFit,
} from "../lib/fitDocxPreviewToViewport";
import { ReportFormFields } from "../components/ReportFormFields";
import { PRR_FORM_SECTIONS } from "../constants/reportFormSections";
import { generateAnnexDBlobs, generateAnnexFBlobs } from "../lib/photoLogAnnexes";
import {
  createPhotoCopy,
  createPhotoLogEntry,
  type PhotoLogAnnexPreviewUrls,
  type PhotoLogEntry,
} from "../types/photoLog";
import {
  PHOTO_REF_LABELS,
  SUGGESTED_PHOTO_SECTIONS,
  SUGGESTED_SECTION_TO_PHOTO_REF,
  type SuggestedPhotoSection,
} from "../types/photoAnalysis";
import {
  getIncidentDraft,
  upsertIncidentDraft,
  INCIDENT_DRAFT_PAYLOAD_VERSION,
  type IncidentDraftPayload,
} from "../lib/incidentDrafts";
import { loadPhotos, savePhotos } from "../lib/photoDraftStore";
import type { FloorplanDraftPayload } from "../lib/floorplanDrafts";
import type { AnnexEMarker } from "../lib/annexEMarkers";
import type { AnnexGEditorState } from "../components/AnnexGBurnChartEditor";

type Step = "review" | "edit";
type ReportView = "fir" | "prr";
type PrrScreen = "form" | "preview";

/** Static annex template pages (A/B/C/E/G) that receive header value overlays. */
const STATIC_HEADER_PAGE_INDICES = [0, 1, 2, 4, 8];
const PRR_SECTION_IDS = ["1", "2", "6"] as const;

interface ReportGenerationProps {
  onBack?: () => void;
}

export function ReportGeneration({ onBack }: ReportGenerationProps) {
  const navigate = useNavigate();
  const { incidentType, stopMessage, fieldNotes, transcriptionJobId, resumeDraftIncidentNo } =
    useReportSession();
  const { runExtraction, error: extractionError } = useExtractionJob();
  const [step, setStep] = useState<Step>("review");
  const [reportView, setReportView] = useState<ReportView>("fir");
  const [reportFields, setReportFields] = useState<FireReportData>(() => createEmptyReportFields());
  const [extractedKeys, setExtractedKeys] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrr, setIsGeneratingPrr] = useState(false);
  const [generatingStatementId, setGeneratingStatementId] = useState<string | null>(null);
  const [isGeneratingAllStatements, setIsGeneratingAllStatements] = useState(false);
  const [docBlob, setDocBlob] = useState<Blob | null>(null);
  const [prrDocBlob, setPrrDocBlob] = useState<Blob | null>(null);
  const [prrScreen, setPrrScreen] = useState<PrrScreen>("form");
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
  const [floorplanDraftState, setFloorplanDraftState] = useState<FloorplanDraftPayload | null>(null);
  const [annexEMarkers, setAnnexEMarkers] = useState<AnnexEMarker[] | null>(null);
  const [annexGState, setAnnexGState] = useState<AnnexGEditorState | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const resumeHandledRef = useRef(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const floorplanPersistenceKey = useMemo(
    () => transcriptionJobId ?? null,
    [transcriptionJobId],
  );

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

      setReportFields((fields) => {
        if (!fields.photoRefLinks) return fields;
        let changed = false;
        const nextLinks: typeof fields.photoRefLinks = {};
        for (const [section, ids] of Object.entries(fields.photoRefLinks)) {
          const filtered = (ids ?? []).filter((pid) => !removedIds.has(pid));
          if (filtered.length !== (ids ?? []).length) changed = true;
          nextLinks[section as SuggestedPhotoSection] = filtered;
        }
        return changed ? { ...fields, photoRefLinks: nextLinks } : fields;
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

  const handleUpdatePhotoCaption = useCallback((id: string, caption: string) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, caption: caption || undefined, captionSource: "manual" as const }
          : p,
      ),
    );
  }, []);

  const photoAnalysisContext = useMemo(
    () => ({
      locationOfFire: reportFields.locationOfFire,
      incidentTypeName: incidentType?.name,
      stopMessage,
      fieldNotes,
    }),
    [reportFields.locationOfFire, incidentType?.name, stopMessage, fieldNotes],
  );

  const handlePhotosAnalyzed = useCallback(
    (updates: Record<string, PhotoAnalysisPartialEntry>) => {
      setPhotos((prev) =>
        prev.map((p) => (updates[p.id] ? { ...p, ...updates[p.id] } : p)),
      );
    },
    [],
  );

  const handleApplyPhotoSection = useCallback(
    (photoId: string, section: SuggestedPhotoSection) => {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) {
        toast.error("Photo not found");
        return;
      }

      let alreadyLinked = false;
      setReportFields((prev) => {
        const existing = prev.photoRefLinks?.[section] ?? [];
        if (existing.includes(photoId)) {
          alreadyLinked = true;
          return prev;
        }
        return {
          ...prev,
          photoRefLinks: { ...prev.photoRefLinks, [section]: [...existing, photoId] },
        };
      });

      if (alreadyLinked) {
        toast.info(`Already linked to ${PHOTO_REF_LABELS[section]}`);
      } else {
        toast.success(`Linked to ${PHOTO_REF_LABELS[section]}`);
      }
    },
    [photos],
  );

  const handlePhotoRefLinksChange = useCallback(
    (section: SuggestedPhotoSection, photoIds: string[]) => {
      setReportFields((prev) => ({
        ...prev,
        photoRefLinks: { ...prev.photoRefLinks, [section]: photoIds },
      }));
    },
    [],
  );

  const handlePhotoRefNoteChange = useCallback(
    (section: SuggestedPhotoSection, note: string) => {
      setReportFields((prev) => ({
        ...prev,
        photoRefNotes: { ...prev.photoRefNotes, [section]: note },
      }));
    },
    [],
  );

  // Keep the derived *PhotoRef string fields in sync with the structured links
  // and current photo order, so reordering/deleting photos updates references.
  useEffect(() => {
    setReportFields((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of SUGGESTED_PHOTO_SECTIONS) {
        const fieldKey = SUGGESTED_SECTION_TO_PHOTO_REF[section];
        const resolved = resolvePhotoRefText(
          section,
          prev.photoRefLinks?.[section],
          photos,
          prev.photoRefNotes?.[section],
        );
        if (next[fieldKey] !== resolved) {
          (next as Record<string, unknown>)[fieldKey] = resolved;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [photos, reportFields.photoRefLinks, reportFields.photoRefNotes]);

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
    // When resuming a saved draft, skip extraction; the resume effect seeds state.
    if (resumeDraftIncidentNo) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const finish = (delayMs: number) => {
      timer = setTimeout(() => {
        if (!cancelled) setPhase("ready");
      }, delayMs);
    };

    const applyFallback = () => {
      const extracted = extractReportFields(stopMessage, incidentType?.name);
      const keys = new Set(
        Object.entries(extracted)
          .filter(([, v]) => v && String(v).trim())
          .map(([k]) => k)
      );
      if (!cancelled) {
        setExtractedKeys(keys);
        setReportFields(mergeReportFields(createEmptyReportFields(), extracted));
      }
    };

    // Demo / unconfigured: no live extraction, play a random 1-3s fake load.
    if (!transcriptionJobId || !isInferenceConfigured() || !stopMessage.trim()) {
      const delay = randomDemoDelayMs();
      timer = setTimeout(() => {
        if (cancelled) return;
        applyFallback();
        setPhase("ready");
      }, delay);
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    void runExtraction({
      jobId: transcriptionJobId,
      text: stopMessage,
      messageType: "stop_message",
      incidentTypeName: incidentType?.name,
    })
      .then((job) => {
        const extracted = (job.result?.fields ?? {}) as Partial<FireReportData>;
        const keys = new Set(
          Object.entries(extracted)
            .filter(([, v]) => v && String(v).trim())
            .map(([k]) => k)
        );
        if (!cancelled) {
          setExtractedKeys(keys);
          setReportFields(mergeReportFields(createEmptyReportFields(), extracted));
        }
      })
      .catch(() => {
        applyFallback();
      })
      .finally(() => {
        finish(remainingMinDelayMs(startedAt));
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [incidentType?.name, runExtraction, stopMessage, transcriptionJobId, resumeDraftIncidentNo]);

  useEffect(() => {
    if (!resumeDraftIncidentNo || resumeHandledRef.current) return;
    resumeHandledRef.current = true;

    let cancelled = false;
    const createdUrls: string[] = [];

    void (async () => {
      try {
        const draft = await getIncidentDraft(resumeDraftIncidentNo);
        if (cancelled) return;
        if (!draft) {
          toast.error("Saved draft not found.");
          return;
        }

        const payload = draft.payload;
        setReportFields(payload.reportFields);
        setExtractedKeys(new Set());
        setFloorplanSvg(payload.floorplanSvg ?? null);
        setFloorplanDraftState(payload.floorplanDraftState ?? null);
        setAnnexEMarkers(payload.annexEMarkers ?? null);
        setAnnexGState(payload.annexGState ?? null);

        const restoredPhotos = await loadPhotos(resumeDraftIncidentNo);
        if (cancelled) return;
        if (restoredPhotos.length > 0) {
          setPhotos(restoredPhotos);
          const urls: Record<string, string> = {};
          for (const photo of restoredPhotos) {
            const url = URL.createObjectURL(photo.blob);
            urls[photo.id] = url;
            createdUrls.push(url);
          }
          setPhotoPreviewUrls(urls);
          toast.success("Draft resumed (photos restored from this device)");
        } else {
          toast.success("Draft resumed");
        }

        // Migrate legacy free-text photo refs (drafts saved before structured
        // linking) into photoRefLinks/notes, without clobbering existing links.
        const hasLinks = Object.keys(payload.reportFields.photoRefLinks ?? {}).length > 0;
        if (!hasLinks) {
          const migrated = migrateLegacyPhotoRefs(payload.reportFields, restoredPhotos);
          setReportFields((prev) => ({
            ...prev,
            photoRefLinks: { ...migrated.links, ...prev.photoRefLinks },
            photoRefNotes: { ...migrated.notes, ...prev.photoRefNotes },
          }));
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Failed to load draft.");
        }
      } finally {
        if (!cancelled) setPhase("ready");
      }
    })();

    return () => {
      cancelled = true;
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };
  }, [resumeDraftIncidentNo]);

  const updateField = useCallback((key: keyof FireReportData, value: string) => {
    setReportFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateInterviewees = useCallback((interviewees: Interviewee[]) => {
    setReportFields((prev) => ({ ...prev, interviewees }));
  }, []);

  const handleFloorplanDraftStateChange = useCallback((payload: FloorplanDraftPayload) => {
    setFloorplanDraftState(payload);
  }, []);

  const handleAnnexEMarkersChange = useCallback((markers: AnnexEMarker[]) => {
    setAnnexEMarkers(markers);
  }, []);

  const handleAnnexGStateChange = useCallback((state: AnnexGEditorState) => {
    setAnnexGState(state);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    const incidentNo = reportFields.incidentNo?.trim();
    if (!incidentNo) {
      toast.warning("Set an incident number before saving a draft.");
      return;
    }
    setIsSavingDraft(true);
    try {
      const payload: IncidentDraftPayload = {
        version: INCIDENT_DRAFT_PAYLOAD_VERSION,
        reportFields,
        floorplanSvg,
        floorplanDraftState,
        annexEMarkers: annexEMarkers ?? [],
        annexGState,
      };
      await upsertIncidentDraft(incidentNo, reportFields.locationOfFire || null, payload);
      await savePhotos(incidentNo, photos);
      toast.success("Draft saved");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  }, [annexEMarkers, annexGState, floorplanDraftState, floorplanSvg, photos, reportFields]);

  const previewRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const previewScalerRef = useRef<HTMLDivElement>(null);
  const hasShownStopMessageToastRef = useRef(false);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);
  const appliedPreviewZoomRef = useRef(1);
  const panTouchIdRef = useRef<number | null>(null);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const panStartScrollLeftRef = useRef(0);
  const panStartScrollTopRef = useRef(0);
  const previewAnchorFrameRef = useRef<number | null>(null);
  const previewZoomFrameRef = useRef<number | null>(null);
  const pendingPreviewZoomRef = useRef<number | null>(null);
  const pendingPreviewAnchorRef = useRef<{
    contentX: number;
    contentY: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  const getDefaultPreviewZoom = useCallback(() => {
    if (typeof window === "undefined") return 1;
    return window.innerWidth < 640 ? 2.4 : 1;
  }, []);

  const clampPreviewZoom = useCallback((value: number) => {
    return Math.min(3, Math.max(1, value));
  }, []);

  const getTouchDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return null;
    const [first, second] = [touches[0], touches[1]];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }, []);

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
    scheduleDocxPreviewFit(elements, previewZoom);
  }, [getPreviewElements, previewZoom]);

  const getPreviewLayoutSnapshot = useCallback(() => {
    const viewport = previewViewportRef.current;
    const host = previewRef.current;
    if (!viewport || !host) return null;

    const viewportRect = viewport.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const scale = Number.parseFloat(host.style.getPropertyValue("--docx-fit-scale")) || 1;

    return {
      viewport,
      scale,
      baseOffsetX: hostRect.left - viewportRect.left + viewport.scrollLeft,
      baseOffsetY: hostRect.top - viewportRect.top + viewport.scrollTop,
    };
  }, []);

  const capturePinchAnchor = useCallback((touches: TouchList) => {
    const layout = getPreviewLayoutSnapshot();
    if (!layout || touches.length < 2) return null;

    const first = touches[0];
    const second = touches[1];
    if (!first || !second) return null;

    const rect = layout.viewport.getBoundingClientRect();
    const viewportX = (first.clientX + second.clientX) / 2 - rect.left;
    const viewportY = (first.clientY + second.clientY) / 2 - rect.top;

    return {
      contentX:
        (layout.viewport.scrollLeft + viewportX - layout.baseOffsetX) / layout.scale,
      contentY:
        (layout.viewport.scrollTop + viewportY - layout.baseOffsetY) / layout.scale,
      viewportX,
      viewportY,
    };
  }, [getPreviewLayoutSnapshot]);

  const restorePreviewAnchor = useCallback((
    anchorPoint: {
      contentX: number;
      contentY: number;
      viewportX: number;
      viewportY: number;
    },
    layout = getPreviewLayoutSnapshot(),
  ) => {
    if (!layout) return;

    const nextScrollLeft =
      anchorPoint.contentX * layout.scale +
      layout.baseOffsetX -
      anchorPoint.viewportX;
    const nextScrollTop =
      anchorPoint.contentY * layout.scale +
      layout.baseOffsetY -
      anchorPoint.viewportY;

    layout.viewport.scrollLeft = Math.min(
      Math.max(0, nextScrollLeft),
      Math.max(0, layout.viewport.scrollWidth - layout.viewport.clientWidth),
    );
    layout.viewport.scrollTop = Math.min(
      Math.max(0, nextScrollTop),
      Math.max(0, layout.viewport.scrollHeight - layout.viewport.clientHeight),
    );
  }, [getPreviewLayoutSnapshot]);

  const applyPreviewZoom = useCallback((nextZoom: number, anchorPoint?: {
    contentX: number;
    contentY: number;
    viewportX: number;
    viewportY: number;
  } | null) => {
    const elements = getPreviewElements();
    if (!elements) return;

    fitDocxPreviewToWidth(elements, nextZoom);
    appliedPreviewZoomRef.current = nextZoom;

    if (!anchorPoint) return;

    restorePreviewAnchor(anchorPoint);
    if (previewAnchorFrameRef.current != null) {
      cancelAnimationFrame(previewAnchorFrameRef.current);
    }
    previewAnchorFrameRef.current = requestAnimationFrame(() => {
      previewAnchorFrameRef.current = null;
      restorePreviewAnchor(anchorPoint);
    });
  }, [getPreviewElements, restorePreviewAnchor]);

  const queuePreviewZoom = useCallback((nextZoom: number, anchorPoint?: {
    contentX: number;
    contentY: number;
    viewportX: number;
    viewportY: number;
  } | null) => {
    pendingPreviewZoomRef.current = nextZoom;
    pendingPreviewAnchorRef.current = anchorPoint ?? null;
    if (previewZoomFrameRef.current != null) return;

    previewZoomFrameRef.current = requestAnimationFrame(() => {
      previewZoomFrameRef.current = null;
      const pendingZoom = pendingPreviewZoomRef.current;
      if (pendingZoom == null) return;
      applyPreviewZoom(pendingZoom, pendingPreviewAnchorRef.current);
    });
  }, [applyPreviewZoom]);

  const capturePointerAnchor = useCallback((clientX: number, clientY: number) => {
    const layout = getPreviewLayoutSnapshot();
    if (!layout) return null;

    const rect = layout.viewport.getBoundingClientRect();
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;

    return {
      contentX:
        (layout.viewport.scrollLeft + viewportX - layout.baseOffsetX) / layout.scale,
      contentY:
        (layout.viewport.scrollTop + viewportY - layout.baseOffsetY) / layout.scale,
      viewportX,
      viewportY,
    };
  }, [getPreviewLayoutSnapshot]);

  const handlePreviewWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    const anchorPoint = capturePointerAnchor(event.clientX, event.clientY);
    if (!anchorPoint) return;

    const zoomFactor = Math.exp(-event.deltaY * 0.01);
    const nextZoom = clampPreviewZoom(appliedPreviewZoomRef.current * zoomFactor);
    queuePreviewZoom(nextZoom, anchorPoint);
  }, [capturePointerAnchor, clampPreviewZoom, queuePreviewZoom]);

  const handlePreviewTouchStart = useCallback((event: TouchEvent) => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    if (event.touches.length >= 2) {
      const distance = getTouchDistance(event.touches);
      if (!distance) return;
      pinchStartDistanceRef.current = distance;
      pinchStartZoomRef.current = appliedPreviewZoomRef.current;
      pendingPreviewAnchorRef.current = capturePinchAnchor(event.touches);
      panTouchIdRef.current = null;
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;
    panTouchIdRef.current = touch.identifier;
    panStartXRef.current = touch.clientX;
    panStartYRef.current = touch.clientY;
    panStartScrollLeftRef.current = viewport.scrollLeft;
    panStartScrollTopRef.current = viewport.scrollTop;
  }, [capturePinchAnchor, getTouchDistance]);

  const handlePreviewTouchMove = useCallback((event: TouchEvent) => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    if (event.touches.length >= 2 && pinchStartDistanceRef.current != null) {
      const nextDistance = getTouchDistance(event.touches);
      if (!nextDistance) return;
      event.preventDefault();
      const anchorPoint = capturePinchAnchor(event.touches);
      const scale = nextDistance / pinchStartDistanceRef.current;
      const nextZoom = clampPreviewZoom(pinchStartZoomRef.current * scale);
      queuePreviewZoom(nextZoom, anchorPoint);
      return;
    }

    if (event.touches.length !== 1 || panTouchIdRef.current == null) return;
    const touch = Array.from(event.touches).find((entry) => entry.identifier === panTouchIdRef.current)
      ?? event.touches[0];
    if (!touch) return;
    event.preventDefault();
    viewport.scrollLeft = panStartScrollLeftRef.current - (touch.clientX - panStartXRef.current);
    viewport.scrollTop = panStartScrollTopRef.current - (touch.clientY - panStartYRef.current);
  }, [capturePinchAnchor, clampPreviewZoom, getTouchDistance, queuePreviewZoom]);

  const handlePreviewTouchEnd = useCallback((event: TouchEvent) => {
    if (event.touches.length < 2) {
      pinchStartDistanceRef.current = null;
    }
    if (event.touches.length === 0) {
      panTouchIdRef.current = null;
      return;
    }
    if (event.touches.length === 1) {
      const remainingTouch = event.touches[0];
      const viewport = previewViewportRef.current;
      if (!viewport) return;
      panTouchIdRef.current = remainingTouch.identifier;
      panStartXRef.current = remainingTouch.clientX;
      panStartYRef.current = remainingTouch.clientY;
      panStartScrollLeftRef.current = viewport.scrollLeft;
      panStartScrollTopRef.current = viewport.scrollTop;
    }
  }, []);

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
      const viewport = previewViewportRef.current;
      if (viewport) {
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      }
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
    if (reportView !== "prr" || prrScreen !== "preview" || !prrDocBlob) return;
    void renderPreview(prrDocBlob);
  }, [reportView, prrScreen, prrDocBlob, renderPreview]);

  useEffect(() => {
    if (previewVersion === 0) return;
    const elements = getPreviewElements();
    if (!elements) return;
    return observeDocxPreviewFit(elements, () => appliedPreviewZoomRef.current);
  }, [getPreviewElements, previewVersion]);

  useEffect(() => {
    setPreviewZoom(getDefaultPreviewZoom());
  }, [docBlob, prrDocBlob, step, reportView, prrScreen, getDefaultPreviewZoom]);

  useEffect(() => {
    if (previewVersion === 0) return;
    if (Math.abs(appliedPreviewZoomRef.current - previewZoom) < 0.001) return;
    applyPreviewZoom(previewZoom);
  }, [applyPreviewZoom, previewVersion, previewZoom]);

  useEffect(() => {
    return () => {
      if (previewAnchorFrameRef.current != null) {
        cancelAnimationFrame(previewAnchorFrameRef.current);
      }
      if (previewZoomFrameRef.current != null) {
        cancelAnimationFrame(previewZoomFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = 0;
  }, [prrScreen, reportView]);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const onTouchStart = (event: Event) => {
      handlePreviewTouchStart(event as TouchEvent);
    };
    const onTouchMove = (event: Event) => {
      handlePreviewTouchMove(event as TouchEvent);
    };
    const onTouchEnd = (event: Event) => {
      handlePreviewTouchEnd(event as TouchEvent);
    };
    const onWheel = (event: Event) => {
      handlePreviewWheel(event as WheelEvent);
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: true });
    viewport.addEventListener("touchcancel", onTouchEnd, { passive: true });
    viewport.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [handlePreviewTouchEnd, handlePreviewTouchMove, handlePreviewTouchStart, handlePreviewWheel, prrScreen, reportView, step, previewVersion]);

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

  const handlePreviewPrr = async () => {
    setIsGeneratingPrr(true);
    try {
      const blob = await generatePrrDocx(reportFields);
      setPrrScreen("preview");
      setPrrDocBlob(blob);
      toast.success("PRR preview updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to preview PRR. Check template placeholders.");
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

  const handlePreviewStatementBlob = useCallback(
    async (intervieweeId: string): Promise<Blob> => {
      const interviewee = reportFields.interviewees.find(
        (i) => i.id === intervieweeId
      );
      if (!interviewee) {
        throw new Error("Interviewee not found");
      }
      return generateStatementDocx(interviewee, reportFields);
    },
    [reportFields]
  );

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

  useEffect(() => {
    if (hasShownStopMessageToastRef.current) return;
    hasShownStopMessageToastRef.current = true;

    toast.success("Stop message captured", {
      duration: 5000,
      description: "The stop message has been recorded.",
    });
  }, []);

  const handlePrevious = () => {
    if (onBack) onBack();
    else navigate("/incident");
  };

  const reportTypeLabel = reportView === "fir" ? "Fire investigation report" : "Preliminary report response";
  const reportTypeDescription =
    reportView === "fir"
      ? "Review extracted fields, generate the Word document, then edit and download."
      : "";

  if (phase === "loading") {
    return <ExtractionLoadingScreen variant="report" stopMessagePreview={stopPreview} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={reportTypeLabel}
        description={reportTypeDescription}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSaveDraft()}
              disabled={isSavingDraft}
            >
              {isSavingDraft ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save draft
            </Button>
          </div>
        }
      />

      {extractionError ? (
        <StatusBanner variant="warning" title="Using local fallback extraction">
          <p>{extractionError}</p>
        </StatusBanner>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant={reportView === "fir" ? "default" : "outline"}
          onClick={() => setReportView("fir")}
        >
          FIR
        </Button>
        <Button
          type="button"
          variant={reportView === "prr" ? "default" : "outline"}
          onClick={() => setReportView("prr")}
        >
          PRR
        </Button>
      </div>

      {false && <StatusBanner variant="success" title="Stop message captured">
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
      </StatusBanner>}

      {reportView === "fir" && step === "review" && (
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
              displayMode="tabs"
              annexPreviewUrls={annexPreviewUrls}
              annexHeaderPreviewUrls={annexHeaderPreviewUrls}
              onAnnexOverrideChange={handleAnnexOverrideChange}
              photos={photos}
              photoPreviewUrls={photoPreviewUrls}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
              onReorderPhoto={handleReorderPhoto}
              onCopyPhoto={handleCopyPhoto}
              onUpdatePhotoCaption={handleUpdatePhotoCaption}
              photoAnalysisContext={photoAnalysisContext}
              onPhotosAnalyzed={handlePhotosAnalyzed}
              onApplyPhotoSection={handleApplyPhotoSection}
              onPhotoRefLinksChange={handlePhotoRefLinksChange}
              onPhotoRefNoteChange={handlePhotoRefNoteChange}
              photoLogAnnexPreviewUrls={photoLogAnnexPreviewUrls}
              photoLogPreviewLoading={photoLogPreviewLoading}
              floorplanSvg={floorplanSvg}
              floorplanPersistenceKey={floorplanPersistenceKey}
              onFloorplanSvgChange={setFloorplanSvg}
              floorplanDraftState={floorplanDraftState}
              onFloorplanDraftStateChange={handleFloorplanDraftStateChange}
              annexEMarkers={annexEMarkers}
              onAnnexEMarkersChange={handleAnnexEMarkersChange}
              annexGState={annexGState}
              onAnnexGStateChange={handleAnnexGStateChange}
              onIntervieweesChange={updateInterviewees}
              onGenerateStatement={handleGenerateStatement}
              onGenerateAllStatements={handleGenerateAllStatements}
              onPreviewStatement={handlePreviewStatementBlob}
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

      {reportView === "fir" && step === "edit" && (
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
                displayMode="tabs"
                annexPreviewUrls={annexPreviewUrls}
                annexHeaderPreviewUrls={annexHeaderPreviewUrls}
                onAnnexOverrideChange={handleAnnexOverrideChange}
                photos={photos}
                photoPreviewUrls={photoPreviewUrls}
                onAddPhotos={handleAddPhotos}
                onRemovePhoto={handleRemovePhoto}
                onReorderPhoto={handleReorderPhoto}
                onCopyPhoto={handleCopyPhoto}
                onUpdatePhotoCaption={handleUpdatePhotoCaption}
                photoAnalysisContext={photoAnalysisContext}
                onPhotosAnalyzed={handlePhotosAnalyzed}
                onApplyPhotoSection={handleApplyPhotoSection}
                onPhotoRefLinksChange={handlePhotoRefLinksChange}
                onPhotoRefNoteChange={handlePhotoRefNoteChange}
                photoLogAnnexPreviewUrls={photoLogAnnexPreviewUrls}
                photoLogPreviewLoading={photoLogPreviewLoading}
                floorplanSvg={floorplanSvg}
                floorplanPersistenceKey={floorplanPersistenceKey}
                onFloorplanSvgChange={setFloorplanSvg}
                onIntervieweesChange={updateInterviewees}
                onGenerateStatement={handleGenerateStatement}
                onGenerateAllStatements={handleGenerateAllStatements}
                onPreviewStatement={handlePreviewStatementBlob}
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
                className="docx-preview-viewport overflow-auto border rounded-xl bg-muted/40 p-1 sm:p-3 h-[min(480px,50vh)] xl:h-[min(calc(100vh-7rem),720px)]"
              >
                <div ref={previewScalerRef} className="docx-preview-scaler sm:mx-auto">
                  <div ref={previewRef} className="docx-preview-host bg-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {reportView === "prr" && prrScreen === "form" && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>PRR information</CardTitle>
            <CardDescription>
              Complete the sections required for the Preliminary Report Response, then generate the document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ReportFormFields
              fields={reportFields}
              extractedKeys={extractedKeys}
              onChange={updateField}
              sectionConfigs={PRR_FORM_SECTIONS}
              visibleSectionIds={[...PRR_SECTION_IDS, "9"]}
            />
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewPrr}
                disabled={isGeneratingPrr}
                className="w-full sm:w-auto"
              >
                {isGeneratingPrr ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Preview PRR
              </Button>
              <Button
                type="button"
                onClick={handleGeneratePrr}
                disabled={isGeneratingPrr}
                className="w-full sm:w-auto"
              >
                {isGeneratingPrr ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Generate PRR
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {reportView === "prr" && prrScreen === "preview" && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>PRR preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {previewError}
              </p>
            )}
            {!previewError && !prrDocBlob && (
              <p className="mb-3 text-sm text-muted-foreground">Generate a PRR preview to review the document here.</p>
            )}
            {!previewError && prrDocBlob && (
              <div
                ref={previewViewportRef}
                className="docx-preview-viewport overflow-auto border rounded-xl bg-muted/40 p-1 sm:p-3 h-[60dvh] sm:h-[70vh]"
              >
                <div ref={previewScalerRef} className="docx-preview-scaler sm:mx-auto">
                  <div ref={previewRef} className="docx-preview-host bg-white" />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPrrScreen("form")}
                className="w-full sm:w-auto"
              >
                Back to PRR information
              </Button>
              <Button
                type="button"
                onClick={handleGeneratePrr}
                disabled={isGeneratingPrr}
                className="w-full sm:w-auto"
              >
                {isGeneratingPrr ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Generate PRR
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
