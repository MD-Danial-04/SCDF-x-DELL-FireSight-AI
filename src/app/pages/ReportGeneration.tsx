import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { DocxPreviewSurface } from "../components/DocxPreviewSurface";
import { FileText, Download, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { StatusBanner } from "../components/StatusBanner";
import { ExtractionLoadingScreen } from "../components/ExtractionLoadingScreen";
import { remainingMinDelayMs, randomDemoDelayMs } from "../lib/loadingTiming";
import { useReportSession } from "../context/ReportSessionContext";
import { createEmptyReportFields, type FireReportData } from "../types/fireReport";
import { extractReportFields, mergeReportFields } from "../lib/extractReportFields";
import { getOfficerProfile, getOfficerStation } from "../lib/userSettings";
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
  observeDocxPreviewFit,
  scheduleDocxPreviewFit,
} from "../lib/fitDocxPreviewToViewport";
import { ReportFormFields } from "../components/ReportFormFields";
import { ReportEditorNav } from "../components/ReportEditorNav";
import { PREVIEW_NAV_ID } from "../lib/reportSectionStatus";
import { REPORT_FORM_SECTIONS } from "../constants/reportFormSections";
import { generateAnnexDBlobs, generateAnnexFBlobs } from "../lib/photoLogAnnexes";
import {
  createPhotoCopy,
  createPhotoLogEntry,
  type PhotoLogAnnexPreviewUrls,
  type PhotoLogEntry,
} from "../types/photoLog";
import {
  PHOTO_REF_FIELD_TO_SECTION,
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

type ReportView = "fir" | "prr";

/** Static annex template pages (A/B/C/E/G) that receive header value overlays. */
const STATIC_HEADER_PAGE_INDICES = [0, 1, 2, 4, 8];
const PRR_SECTION_IDS = ["1", "2", "6"] as const;

/** PRR sections derived from the full report config, with photo-reference fields removed. */
const PRR_SECTION_CONFIGS = REPORT_FORM_SECTIONS
  .filter((section) =>
    PRR_SECTION_IDS.includes(section.id as (typeof PRR_SECTION_IDS)[number])
  )
  .map((section) => ({
    ...section,
    fields: section.fields?.filter((field) => !PHOTO_REF_FIELD_TO_SECTION[field.key]),
  }));

/**
 * Prefills the author fields from the saved officer profile, but only when they
 * are still blank so extracted values and resumed drafts are never overwritten.
 */
function applyOfficerProfile(fields: FireReportData): FireReportData {
  const profile = getOfficerProfile().trim();
  const station = getOfficerStation().trim();
  if (!profile && !station) return fields;

  const next = { ...fields };
  if (profile && !next.investigatorNameRank.trim()) next.investigatorNameRank = profile;
  if (profile && !next.preparedBy.trim()) next.preparedBy = profile;
  if (station && !next.station.trim()) next.station = station;
  return next;
}

interface ReportGenerationProps {
  onBack?: () => void;
}

export function ReportGeneration({ onBack }: ReportGenerationProps) {
  const navigate = useNavigate();
  const {
    incidentType,
    stopMessage,
    fieldNotes,
    transcriptionJobId,
    resumeDraftIncidentNo,
    initialSectionId,
  } = useReportSession();
  const { runExtraction, error: extractionError } = useExtractionJob();
  const [reportView, setReportView] = useState<ReportView>("fir");
  const [activeSectionId, setActiveSectionId] = useState<string>(
    initialSectionId ?? REPORT_FORM_SECTIONS[0]?.id ?? "1"
  );
  const [reportFields, setReportFields] = useState<FireReportData>(() =>
    applyOfficerProfile(createEmptyReportFields())
  );
  const [extractedKeys, setExtractedKeys] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
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

  const handleReorderPhotos = useCallback((orderedIds: string[]) => {
    setPhotos((prev) => {
      const byId = new Map(prev.map((photo) => [photo.id, photo]));
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((photo): photo is PhotoLogEntry => photo !== undefined);
      if (next.length !== prev.length) return prev;
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
        setReportFields(
          applyOfficerProfile(mergeReportFields(createEmptyReportFields(), extracted))
        );
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
          setReportFields(
          applyOfficerProfile(mergeReportFields(createEmptyReportFields(), extracted))
        );
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
    if (activeSectionId !== PREVIEW_NAV_ID || !docBlob) return;
    void renderPreview(docBlob);
  }, [activeSectionId, docBlob, renderPreview]);

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
      setActiveSectionId(PREVIEW_NAV_ID);
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
    const name =
      reportView === "prr"
        ? getPrrFilename(reportFields.incidentNo)
        : `${reportFields.incidentNo}_Fire_Investigation_Report.docx`;
    downloadDocx(docBlob, name);
    toast.success("Report downloaded");
  };

  const handleGeneratePrr = async () => {
    setIsGeneratingPrr(true);
    try {
      const blob = await generatePrrDocx(reportFields);
      setDocBlob(blob);
      setActiveSectionId(PREVIEW_NAV_ID);
      toast.success("Preliminary Report Response generated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PRR. Check template placeholders.");
    } finally {
      setIsGeneratingPrr(false);
    }
  };

  const handleUpdatePreviewPrr = async () => {
    if (!docBlob) return;
    setIsGeneratingPrr(true);
    try {
      const blob = await generatePrrDocx(reportFields);
      setDocBlob(blob);
      await renderPreview(blob);
      toast.success("Preview updated");
    } catch {
      toast.error("Failed to update preview");
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

  const handleReportViewChange = (view: ReportView) => {
    setReportView(view);
    setActiveSectionId(view === "prr" ? PRR_SECTION_IDS[0] : REPORT_FORM_SECTIONS[0]?.id ?? "1");
    setDocBlob(null);
    setPreviewVersion(0);
    setPreviewError(null);
  };

  const navVisibleSectionIds =
    reportView === "prr" ? [...PRR_SECTION_IDS] : REPORT_FORM_SECTIONS.map((section) => section.id);

  if (phase === "loading") {
    return <ExtractionLoadingScreen variant="report" stopMessagePreview={stopPreview} />;
  }

  return (
    <div className="space-y-8">
      <ReportEditorNav
        title={reportTypeLabel}
        reportView={reportView}
        onReportViewChange={handleReportViewChange}
        fields={reportFields}
        extractedKeys={extractedKeys}
        floorplanSvg={floorplanSvg}
        photos={photos}
        annexPreviewUrls={annexPreviewUrls}
        visibleSectionIds={navVisibleSectionIds}
        showInterviewNav={reportView === "fir"}
        activeSectionId={activeSectionId}
        onSelectSection={setActiveSectionId}
        onSaveDraft={() => void handleSaveDraft()}
        isSavingDraft={isSavingDraft}
        onGenerate={reportView === "prr" ? () => void handleGeneratePrr() : () => void handleGenerate()}
        isGenerating={reportView === "prr" ? isGeneratingPrr : isGenerating}
        hasGeneratedDoc={Boolean(docBlob)}
      />

      {extractionError ? (
        <StatusBanner variant="warning" title="Using local fallback extraction">
          <p>{extractionError}</p>
        </StatusBanner>
      ) : null}

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

      {reportView === "fir" && activeSectionId !== PREVIEW_NAV_ID && (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="space-y-6 pt-6">
            <ReportFormFields
              fields={reportFields}
              extractedKeys={extractedKeys}
              onChange={updateField}
              displayMode="tabs"
              activeSectionId={activeSectionId}
              onActiveSectionChange={setActiveSectionId}
              annexPreviewUrls={annexPreviewUrls}
              annexHeaderPreviewUrls={annexHeaderPreviewUrls}
              onAnnexOverrideChange={handleAnnexOverrideChange}
              photos={photos}
              photoPreviewUrls={photoPreviewUrls}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
              onReorderPhotos={handleReorderPhotos}
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
          </CardContent>
        </Card>
      )}

      <Dialog
        open={activeSectionId === PREVIEW_NAV_ID}
        onOpenChange={(open) => {
          if (!open) setActiveSectionId(navVisibleSectionIds[0] ?? "1");
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl xl:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document preview</DialogTitle>
            <DialogDescription>
              This matches the document that will be downloaded.
            </DialogDescription>
          </DialogHeader>

          {!docBlob ? (
            <div className="flex items-center justify-center py-6">
              <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No document generated yet. Open the menu and choose
                  <span className="font-medium text-foreground">
                    {reportView === "prr" ? " Generate PRR " : " Generate Word Report "}
                  </span>
                  to build a preview.
                </p>
                <Button
                  className="mt-4"
                  onClick={reportView === "prr" ? handleGeneratePrr : handleGenerate}
                  disabled={reportView === "prr" ? isGeneratingPrr : isGenerating}
                >
                  {(reportView === "prr" ? isGeneratingPrr : isGenerating) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {reportView === "prr" ? "Generate PRR" : "Generate Word Report"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <DocxPreviewSurface
                viewportRef={previewViewportRef}
                scalerRef={previewScalerRef}
                hostRef={previewRef}
                isRendering={previewVersion === 0}
                error={previewError}
              />

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={reportView === "prr" ? handleUpdatePreviewPrr : handleUpdatePreview}
                  disabled={reportView === "prr" ? isGeneratingPrr : isGenerating}
                >
                  {(reportView === "prr" ? isGeneratingPrr : isGenerating) ? (
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
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {reportView === "prr" && activeSectionId !== PREVIEW_NAV_ID && (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="space-y-6 pt-6">
            <ReportFormFields
              fields={reportFields}
              extractedKeys={extractedKeys}
              onChange={updateField}
              displayMode="tabs"
              activeSectionId={activeSectionId}
              onActiveSectionChange={setActiveSectionId}
              sectionConfigs={PRR_SECTION_CONFIGS}
              visibleSectionIds={[...PRR_SECTION_IDS]}
            />
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
              >
                Back to Incident
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
