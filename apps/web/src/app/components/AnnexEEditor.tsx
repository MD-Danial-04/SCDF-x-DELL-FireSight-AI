import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, Compass, Loader2, MousePointer2, Plus, Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { cn } from "./ui/utils";
import {
  buildAnnotatedFloorplanSvg,
  clampMarkerTip,
  createDefaultMarker,
  findMarkerHitAtPoint,
  getMarkerAngleDeg,
  getMarkerLengthBounds,
  getMarkerVisibleLength,
  parseViewBoxFromSvg,
  setMarkerTipFromAngleVisibleLength,
  type AnnexEMarker,
  type MarkerHitPart,
} from "../lib/annexEMarkers";
import { svgStringToAnnexTemplatePngBlob } from "../lib/svgToAnnexPng";
import { getPhotoLogDisplayInfo, type PhotoLogEntry } from "../types/photoLog";

const ANNEX_E_PAGE_INDEX = 4;
const TAP_THRESHOLD_PX = 5;
const HANDLE_SIZE_PX = 28;
const ANNEX_E_MARKERS_STORAGE_PREFIX = "annex-e-markers";

const COMPASS_ANGLES: { label: string; angle: number }[] = [
  { label: "N", angle: 270 },
  { label: "NE", angle: 315 },
  { label: "E", angle: 0 },
  { label: "SE", angle: 45 },
  { label: "S", angle: 90 },
  { label: "SW", angle: 135 },
  { label: "W", angle: 180 },
  { label: "NW", angle: 225 },
];

type EditorMode = "select" | "place";
type SelectionFocus = MarkerHitPart | null;

interface AnnexEEditorProps {
  enabled: boolean;
  floorplanSvg: string | null;
  photos: PhotoLogEntry[];
  photoPreviewUrls?: Record<string, string>;
  incidentNo?: string;
  locationOfFire?: string;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
  initialMarkers?: AnnexEMarker[] | null;
  onMarkersChange?: (markers: AnnexEMarker[]) => void;
}

type DragMode =
  | { mode: "place-arrow"; pointerId: number; markerId: string }
  | {
      mode: "move-marker";
      pointerId: number;
      markerId: string;
      startPoint: { x: number; y: number };
      startMarker: AnnexEMarker;
    }
  | { mode: "adjust-arrow"; pointerId: number; markerId: string };

interface CanvasPoint {
  x: number;
  y: number;
}

/**
 * Map a point in floorplan SVG user units to pixels relative to the SVG's own box.
 * The handle overlay shares that box, so the result lines up exactly with the
 * marker as the browser actually renders it (independent of letterboxing/border).
 */
function svgUserToCanvasPx(svg: SVGSVGElement, x: number, y: number): CanvasPoint | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  const screen = point.matrixTransform(ctm);
  const rect = svg.getBoundingClientRect();
  return { x: screen.x - rect.left, y: screen.y - rect.top };
}

/** Map a client (screen) point to floorplan SVG user units using the live render transform. */
function clientToSvgUser(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): CanvasPoint | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildAnnexEMarkersStorageKey({
  incidentNo,
  locationOfFire,
  floorplanSvg,
}: {
  incidentNo?: string;
  locationOfFire?: string;
  floorplanSvg: string | null;
}) {
  const fingerprint = floorplanSvg ? hashString(floorplanSvg) : "no-floorplan";
  return [
    ANNEX_E_MARKERS_STORAGE_PREFIX,
    incidentNo?.trim() || "no-incident",
    locationOfFire?.trim() || "no-location",
    fingerprint,
  ].join(":");
}

function isValidMarker(candidate: unknown): candidate is AnnexEMarker {
  if (!candidate || typeof candidate !== "object") return false;
  const marker = candidate as Record<string, unknown>;
  return (
    typeof marker.id === "string" &&
    typeof marker.cx === "number" &&
    typeof marker.cy === "number" &&
    typeof marker.tipX === "number" &&
    typeof marker.tipY === "number" &&
    (typeof marker.photoId === "string" || marker.photoId === null)
  );
}

function MarkerHandles({
  center,
  tip,
  onMoveDrag,
  onTipDrag,
  onMoveStart,
  onTipStart,
  onDragEnd,
}: {
  center: CanvasPoint;
  tip: CanvasPoint;
  onMoveDrag: (clientX: number, clientY: number) => void;
  onTipDrag: (clientX: number, clientY: number) => void;
  onMoveStart: () => void;
  onTipStart: () => void;
  onDragEnd: () => void;
}) {
  const half = HANDLE_SIZE_PX / 2;

  const handleProps = (onMove: (e: ReactPointerEvent<HTMLButtonElement>) => void) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onMove(e);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.stopPropagation();
      onMove(e);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.stopPropagation();
      onDragEnd();
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.stopPropagation();
      onDragEnd();
    },
  });

  return (
    <>
      <button
        type="button"
        aria-label="Move marker"
        className="absolute z-30 rounded-full border-2 border-sky-600 bg-transparent shadow-[0_0_0_2px_rgba(255,255,255,0.85)] touch-none transition-colors hover:border-sky-700 hover:bg-sky-500/10"
        style={{
          width: HANDLE_SIZE_PX,
          height: HANDLE_SIZE_PX,
          left: center.x - half,
          top: center.y - half,
          cursor: "move",
        }}
        {...handleProps((e) => {
          if (e.type === "pointerdown") onMoveStart();
          onMoveDrag(e.clientX, e.clientY);
        })}
      />
      <button
        type="button"
        aria-label="Adjust arrow direction and length"
        className="absolute z-30 flex items-center justify-center rounded-full border-2 border-sky-600 bg-transparent shadow-[0_0_0_2px_rgba(255,255,255,0.85)] touch-none transition-colors hover:bg-sky-500/10"
        style={{
          width: HANDLE_SIZE_PX,
          height: HANDLE_SIZE_PX,
          left: tip.x - half,
          top: tip.y - half,
          cursor: "crosshair",
        }}
        {...handleProps((e) => {
          if (e.type === "pointerdown") onTipStart();
          onTipDrag(e.clientX, e.clientY);
        })}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
      </button>
    </>
  );
}

export function AnnexEEditor({
  enabled,
  floorplanSvg,
  photos,
  photoPreviewUrls = {},
  incidentNo,
  locationOfFire,
  onOverrideChange,
  initialMarkers = null,
  onMarkersChange,
}: AnnexEEditorProps) {
  const [markers, setMarkers] = useState<AnnexEMarker[]>([]);
  const initialMarkersRef = useRef(initialMarkers);
  initialMarkersRef.current = initialMarkers;
  const markersHydratedRef = useRef(false);
  const markersEmitReadyRef = useRef(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [selectionFocus, setSelectionFocus] = useState<SelectionFocus>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [hoverHit, setHoverHit] = useState<{ hit: MarkerHitPart } | null>(null);
  const [dragState, setDragState] = useState<DragMode | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const floorContainerRef = useRef<HTMLDivElement>(null);
  const dragStartClientRef = useRef<{ x: number; y: number } | null>(null);
  const moveDragStartRef = useRef<{
    startPoint: { x: number; y: number };
    startMarker: AnnexEMarker;
  } | null>(null);

  const markersStorageKey = useMemo(
    () =>
      buildAnnexEMarkersStorageKey({
        incidentNo,
        locationOfFire,
        floorplanSvg,
      }),
    [floorplanSvg, incidentNo, locationOfFire],
  );

  const viewBox = useMemo(
    () => (floorplanSvg ? parseViewBoxFromSvg(floorplanSvg) : null),
    [floorplanSvg],
  );

  const getFloorSvg = useCallback(
    () => floorContainerRef.current?.querySelector("svg") as SVGSVGElement | null,
    [],
  );

  const { photoOptions, numberById } = useMemo(() => {
    const options: { id: string; number: number; uid: string; previewUrl?: string }[] = [];
    const byId = new Map<string, number>();
    for (const info of getPhotoLogDisplayInfo(photos)) {
      if (info.isCopy || info.number === null) continue;
      options.push({
        id: info.entry.id,
        number: info.number,
        uid: info.entry.uid,
        previewUrl: photoPreviewUrls[info.entry.id],
      });
      byId.set(info.entry.id, info.number);
    }
    return { photoOptions: options, numberById: byId };
  }, [photos, photoPreviewUrls]);

  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId) ?? null;

  const lengthBounds = viewBox ? getMarkerLengthBounds(viewBox) : { min: 0, max: 100 };

  const selectedAngle = selectedMarker ? Math.round(getMarkerAngleDeg(selectedMarker)) : 0;
  const selectedLength =
    selectedMarker && viewBox
      ? getMarkerVisibleLength(selectedMarker, viewBox)
      : lengthBounds.min;

  const renderMarkers = useMemo(
    () =>
      markers.map((marker) => ({
        ...marker,
        photoNumber: marker.photoId ? numberById.get(marker.photoId) ?? null : null,
      })),
    [markers, numberById],
  );

  const placedPhotoIds = useMemo(() => {
    const set = new Set<string>();
    for (const marker of markers) {
      if (marker.photoId) set.add(marker.photoId);
    }
    return set;
  }, [markers]);

  const displayMarkers = useMemo(
    () =>
      renderMarkers.map((marker) =>
        marker.id === selectedMarkerId
          ? { ...marker, highlight: selectionFocus }
          : marker,
      ),
    [renderMarkers, selectedMarkerId, selectionFocus],
  );

  const displaySvg = useMemo(() => {
    if (!floorplanSvg || !viewBox) return null;
    return buildAnnotatedFloorplanSvg(floorplanSvg, displayMarkers, viewBox);
  }, [floorplanSvg, displayMarkers, viewBox]);

  const handlePositions = useMemo(() => {
    void layoutTick;
    void displaySvg;
    const svg = getFloorSvg();
    if (!selectedMarker || !svg) return null;
    const center = svgUserToCanvasPx(svg, selectedMarker.cx, selectedMarker.cy);
    const tip = svgUserToCanvasPx(svg, selectedMarker.tipX, selectedMarker.tipY);
    if (!center || !tip) return null;
    return { center, tip };
  }, [getFloorSvg, selectedMarker, layoutTick, displaySvg]);

  const activePhotoNumber =
    activePhotoId != null ? numberById.get(activePhotoId) ?? null : null;

  const modeHint =
    editorMode === "place"
      ? activePhotoNumber != null
        ? `Selected Photo ${activePhotoNumber} – click the floorplan to drop its marker, then drag the arrow to set direction.`
        : "Click the floorplan to drop a marker, then drag the arrow to set direction. Press Select or Esc to stop."
      : "Pick a photo below to place its marker, or drag the center dot to move and the tip dot for direction/length.";

  const canvasCursor =
    editorMode === "place"
      ? "cursor-crosshair"
      : hoverHit?.hit === "arrow"
        ? "cursor-crosshair"
        : hoverHit?.hit === "body"
          ? "cursor-grab"
          : dragState?.mode === "move-marker"
            ? "cursor-grabbing"
            : "cursor-default";

  const updateMarker = useCallback((markerId: string, patch: Partial<AnnexEMarker>) => {
    setMarkers((current) =>
      current.map((marker) => (marker.id === markerId ? { ...marker, ...patch } : marker)),
    );
  }, []);

  const removeMarker = useCallback((markerId: string) => {
    setMarkers((current) => current.filter((marker) => marker.id !== markerId));
    setSelectedMarkerId((current) => (current === markerId ? null : current));
    setSelectionFocus(null);
  }, []);

  const selectMarker = useCallback((markerId: string, focus: SelectionFocus) => {
    setSelectedMarkerId(markerId);
    setSelectionFocus(focus);
  }, []);

  const deselectMarker = useCallback(() => {
    setSelectedMarkerId(null);
    setSelectionFocus(null);
  }, []);

  useEffect(() => {
    setMarkers((current) => {
      let changed = false;
      const next = current.map((marker) => {
        if (marker.photoId && !numberById.has(marker.photoId)) {
          changed = true;
          return { ...marker, photoId: null };
        }
        return marker;
      });
      return changed ? next : current;
    });
  }, [numberById]);

  const applyAngleAndLength = useCallback(
    (markerId: string, angleDeg: number, length: number) => {
      const marker = markers.find((m) => m.id === markerId);
      if (!marker || !viewBox) return;
      const bounds = getMarkerLengthBounds(viewBox);
      const clampedLength = Math.min(bounds.max, Math.max(bounds.min, length));
      const tip = setMarkerTipFromAngleVisibleLength(
        marker,
        angleDeg,
        clampedLength,
        viewBox,
      );
      updateMarker(markerId, tip);
    },
    [markers, updateMarker, viewBox],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setLayoutTick((n) => n + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [floorplanSvg, viewBox]);

  useEffect(() => {
    if (!viewBox) return;

    setMarkers((current) => {
      let changed = false;
      const next = current.map((marker) => {
        const clampedTip = clampMarkerTip(marker, marker.tipX, marker.tipY, viewBox);
        if (clampedTip.tipX !== marker.tipX || clampedTip.tipY !== marker.tipY) {
          changed = true;
          return { ...marker, ...clampedTip };
        }
        return marker;
      });

      return changed ? next : current;
    });
  }, [viewBox]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!floorplanSvg) {
      setMarkers([]);
      setSelectedMarkerId(null);
      setSelectionFocus(null);
      return;
    }

    try {
      const raw = window.localStorage.getItem(markersStorageKey);
      if (!raw) {
        const seed = initialMarkersRef.current;
        if (!markersHydratedRef.current && Array.isArray(seed) && seed.length > 0) {
          markersHydratedRef.current = true;
          setMarkers(seed.filter(isValidMarker));
          setSelectedMarkerId(null);
          setSelectionFocus(null);
          return;
        }
        setMarkers([]);
        setSelectedMarkerId(null);
        setSelectionFocus(null);
        return;
      }

      markersHydratedRef.current = true;
      const parsed = JSON.parse(raw);
      const nextMarkers = Array.isArray(parsed) ? parsed.filter(isValidMarker) : [];
      setMarkers(nextMarkers);
      setSelectedMarkerId((current) =>
        current && nextMarkers.some((marker) => marker.id === current) ? current : null,
      );
      setSelectionFocus(null);
    } catch {
      setMarkers([]);
      setSelectedMarkerId(null);
      setSelectionFocus(null);
    }
  }, [floorplanSvg, markersStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !floorplanSvg) return;
    window.localStorage.setItem(markersStorageKey, JSON.stringify(markers));
  }, [floorplanSvg, markers, markersStorageKey]);

  useEffect(() => {
    if (!markersEmitReadyRef.current) {
      markersEmitReadyRef.current = true;
      return;
    }
    onMarkersChange?.(markers);
  }, [markers, onMarkersChange]);

  useEffect(() => {
    if (!enabled || !floorplanSvg || !viewBox) {
      onOverrideChange(ANNEX_E_PAGE_INDEX, null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setExporting(true);
      setExportError(null);
      try {
        const annotatedSvg = buildAnnotatedFloorplanSvg(floorplanSvg, renderMarkers, viewBox);
        const blob = await svgStringToAnnexTemplatePngBlob(
          annotatedSvg,
          { incidentNo, locationOfFire },
          { templatePageIndex: ANNEX_E_PAGE_INDEX },
        );
        if (!cancelled) onOverrideChange(ANNEX_E_PAGE_INDEX, blob);
      } catch (error) {
        if (!cancelled) {
          setExportError(error instanceof Error ? error.message : "Unable to prepare Annex E image.");
        }
      } finally {
        if (!cancelled) setExporting(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, floorplanSvg, viewBox, renderMarkers, incidentNo, locationOfFire, onOverrideChange]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (editorMode === "place") {
          event.preventDefault();
          setEditorMode("select");
          setActivePhotoId(null);
        }
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedMarkerId) {
        event.preventDefault();
        removeMarker(selectedMarkerId);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorMode, removeMarker, selectedMarkerId]);

  const clientPointToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const svg = getFloorSvg();
      if (!svg || !viewBox) return null;
      return clientToSvgUser(svg, clientX, clientY);
    },
    [getFloorSvg, viewBox],
  );

  function beginCanvasDrag(
    mode: DragMode["mode"],
    markerId: string,
    point: { x: number; y: number },
    marker: AnnexEMarker,
    pointerId: number,
    clientX: number,
    clientY: number,
  ) {
    dragStartClientRef.current = { x: clientX, y: clientY };

    if (mode === "move-marker") {
      setDragState({
        mode: "move-marker",
        pointerId,
        markerId,
        startPoint: point,
        startMarker: marker,
      });
    } else if (mode === "adjust-arrow") {
      setDragState({ mode: "adjust-arrow", pointerId, markerId });
    } else {
      setDragState({ mode: "place-arrow", pointerId, markerId });
    }
  }

  function applyCanvasDragPoint(point: { x: number; y: number }) {
    if (!dragState) return;

    if (dragState.mode === "place-arrow" || dragState.mode === "adjust-arrow") {
      const marker = markers.find((entry) => entry.id === dragState.markerId);
      if (!marker || !viewBox) return;
      const tip = clampMarkerTip(marker, point.x, point.y, viewBox);
      updateMarker(dragState.markerId, tip);
      return;
    }

    const deltaX = point.x - dragState.startPoint.x;
    const deltaY = point.y - dragState.startPoint.y;
    updateMarker(dragState.markerId, {
      cx: dragState.startMarker.cx + deltaX,
      cy: dragState.startMarker.cy + deltaY,
      tipX: dragState.startMarker.tipX + deltaX,
      tipY: dragState.startMarker.tipY + deltaY,
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !viewBox || !floorplanSvg) return;
    if ((event.target as HTMLElement).closest("[data-marker-handle]")) return;

    const point = clientPointToSvg(event.clientX, event.clientY);
    if (!point) return;

    const hit = findMarkerHitAtPoint(point, markers, viewBox);

    if (hit) {
      selectMarker(hit.marker.id, hit.hit);
      beginCanvasDrag(
        hit.hit === "body" ? "move-marker" : "adjust-arrow",
        hit.marker.id,
        point,
        hit.marker,
        event.pointerId,
        event.clientX,
        event.clientY,
      );
      canvasRef.current?.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (editorMode === "place") {
      const marker = createDefaultMarker(point.x, point.y, viewBox);
      marker.photoId = activePhotoId;
      setMarkers((current) => [...current, marker]);
      selectMarker(marker.id, "arrow");
      beginCanvasDrag(
        "place-arrow",
        marker.id,
        point,
        marker,
        event.pointerId,
        event.clientX,
        event.clientY,
      );
      canvasRef.current?.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    deselectMarker();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!viewBox) return;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      const point = clientPointToSvg(event.clientX, event.clientY);
      if (!point) {
        setHoverHit(null);
        return;
      }
      const hit = findMarkerHitAtPoint(point, markers, viewBox);
      setHoverHit(hit ? { hit: hit.hit } : null);
      return;
    }

    const point = clientPointToSvg(event.clientX, event.clientY);
    if (!point) return;
    applyCanvasDragPoint(point);
  }

  function clearDragState(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragState && dragState.pointerId === event.pointerId) {
      const start = dragStartClientRef.current;
      const moved =
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >= TAP_THRESHOLD_PX;

      if (!moved && dragState.mode === "adjust-arrow") {
        setSelectionFocus("arrow");
      }

      if (dragState.mode === "place-arrow") {
        setEditorMode("select");
        setActivePhotoId(null);
      }

      setDragState(null);
      dragStartClientRef.current = null;

      if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
        canvasRef.current.releasePointerCapture(event.pointerId);
      }
    }

    setHoverHit(null);
  }

  function handleMoveHandleDrag(clientX: number, clientY: number) {
    if (!selectedMarker || !viewBox) return;
    const point = clientPointToSvg(clientX, clientY);
    if (!point) return;

    if (!moveDragStartRef.current) {
      moveDragStartRef.current = {
        startPoint: point,
        startMarker: selectedMarker,
      };
      return;
    }

    const deltaX = point.x - moveDragStartRef.current.startPoint.x;
    const deltaY = point.y - moveDragStartRef.current.startPoint.y;
    const start = moveDragStartRef.current.startMarker;
    updateMarker(selectedMarker.id, {
      cx: start.cx + deltaX,
      cy: start.cy + deltaY,
      tipX: start.tipX + deltaX,
      tipY: start.tipY + deltaY,
    });
  }

  function handleTipHandleDrag(clientX: number, clientY: number) {
    if (!selectedMarker || !viewBox) return;
    const point = clientPointToSvg(clientX, clientY);
    if (!point) return;
    updateMarker(
      selectedMarker.id,
      clampMarkerTip(selectedMarker, point.x, point.y, viewBox),
    );
  }

  function endHandleDrag() {
    moveDragStartRef.current = null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <p className="font-semibold text-foreground">Annex E photo-direction editor</p>
            <Badge
              variant={enabled ? "secondary" : "outline"}
              className={enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
            >
              {enabled ? "Included in report" : "Select Annex E to attach"}
            </Badge>
            {exporting && (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating preview
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{modeHint}</p>
        </div>
      </div>

      {exportError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {exportError}
        </p>
      )}

      {!floorplanSvg || !viewBox ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Import a floorplan in the floorplan editor above.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={editorMode === "place" && activePhotoId === null ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setEditorMode((current) => {
                  setActivePhotoId(null);
                  return current === "place" ? "select" : "place";
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add blank marker
            </Button>
            <Button
              type="button"
              variant={editorMode === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditorMode("select");
                setActivePhotoId(null);
              }}
            >
              <MousePointer2 className="mr-2 h-4 w-4" />
              Select
            </Button>
          </div>

          <div
            ref={canvasRef}
            className={cn(
              "relative min-h-[280px] h-[min(480px,50vh)] max-h-[50vh] overflow-hidden rounded-2xl border border-border bg-white touch-none",
              canvasCursor,
              editorMode === "place" && "ring-2 ring-sky-200",
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={clearDragState}
            onPointerLeave={clearDragState}
          >
            {displaySvg && (
              <div
                ref={floorContainerRef}
                className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: displaySvg }}
              />
            )}
            {selectedMarker && handlePositions && (
              <div data-marker-handle className="pointer-events-none absolute inset-0 z-20 [&>button]:pointer-events-auto">
                <MarkerHandles
                  center={handlePositions.center}
                  tip={handlePositions.tip}
                  onMoveStart={() => {
                    selectMarker(selectedMarker.id, "body");
                    moveDragStartRef.current = null;
                  }}
                  onTipStart={() => {
                    selectMarker(selectedMarker.id, "arrow");
                  }}
                  onMoveDrag={handleMoveHandleDrag}
                  onTipDrag={handleTipHandleDrag}
                  onDragEnd={endHandleDrag}
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Photo log</Label>
              {activePhotoNumber != null && (
                <span className="text-xs font-medium text-sky-600">
                  Placing Photo {activePhotoNumber}
                </span>
              )}
            </div>
            {photoOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add photos to the photo log to place their markers.
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photoOptions.map((option) => {
                  const isActive = option.id === activePhotoId;
                  const isPlaced = placedPhotoIds.has(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isPlaced}
                      onClick={() => {
                        if (isPlaced) return;
                        setActivePhotoId(option.id);
                        setEditorMode("place");
                      }}
                      title={
                        isPlaced
                          ? `Photo ${option.number} · already placed`
                          : `Photo ${option.number} · UID ${option.uid}`
                      }
                      className={cn(
                        "relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-slate-100 transition-colors",
                        isPlaced
                          ? "cursor-not-allowed border-emerald-300"
                          : isActive
                            ? "border-sky-500 ring-2 ring-sky-300"
                            : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      {option.previewUrl ? (
                        <img
                          src={option.previewUrl}
                          alt={`Photo ${option.number}`}
                          className={cn(
                            "h-full w-full object-cover",
                            isPlaced && "opacity-50",
                          )}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No preview
                        </div>
                      )}
                      <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                        {option.number}
                      </span>
                      {isPlaced && (
                        <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-white p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full space-y-1 sm:w-auto sm:min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Selected marker</Label>
                <p className="text-sm font-medium">
                  {selectedMarker
                    ? `Marker ${markers.indexOf(selectedMarker) + 1}${
                        selectionFocus === "arrow"
                          ? " · direction"
                          : selectionFocus === "body"
                            ? " · position"
                            : ""
                      }`
                    : "None"}
                </p>
              </div>

              <div className="w-full space-y-1 sm:w-auto sm:min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Photo number</Label>
                <Select
                  value={selectedMarker?.photoId ?? "none"}
                  onValueChange={(value) => {
                    if (!selectedMarker) return;
                    updateMarker(selectedMarker.id, {
                      photoId: value === "none" ? null : value,
                    });
                  }}
                  disabled={!selectedMarker}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Choose photo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {photoOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {`Photo ${option.number} · UID ${option.uid}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={!selectedMarker}
                onClick={() => selectedMarker && removeMarker(selectedMarker.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete marker
              </Button>
            </div>

            {selectedMarker && viewBox && (
              <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Direction</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={359}
                        value={selectedAngle}
                        disabled={!selectedMarker}
                        className="h-8 w-16 text-center text-sm"
                        onChange={(e) => {
                          const raw = Number.parseInt(e.target.value, 10);
                          if (!Number.isFinite(raw) || !selectedMarker) return;
                          const angle = ((raw % 360) + 360) % 360;
                          applyAngleAndLength(selectedMarker.id, angle, selectedLength);
                          setSelectionFocus("arrow");
                        }}
                      />
                      <span className="text-xs text-muted-foreground">°</span>
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={359}
                    step={1}
                    value={[selectedAngle]}
                    disabled={!selectedMarker}
                    onValueChange={([angle]) => {
                      if (!selectedMarker) return;
                      applyAngleAndLength(selectedMarker.id, angle, selectedLength);
                      setSelectionFocus("arrow");
                    }}
                  />
                  <div className="flex flex-wrap gap-1">
                    {COMPASS_ANGLES.map(({ label, angle }) => (
                      <Button
                        key={label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 min-w-9 px-2 text-xs"
                        onClick={() => {
                          if (!selectedMarker) return;
                          applyAngleAndLength(selectedMarker.id, angle, selectedLength);
                          setSelectionFocus("arrow");
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Arrow length</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {selectedLength.toFixed(1)} units
                    </span>
                  </div>
                  <Slider
                    min={lengthBounds.min}
                    max={lengthBounds.max}
                    step={0.1}
                    value={[selectedLength]}
                    disabled={!selectedMarker}
                    onValueChange={([length]) => {
                      if (!selectedMarker) return;
                      applyAngleAndLength(selectedMarker.id, selectedAngle, length);
                      setSelectionFocus("arrow");
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
