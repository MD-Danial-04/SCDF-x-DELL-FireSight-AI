import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import {
  Box,
  FileStack,
  FolderOpen,
  Grid3X3,
  Group,
  History,
  Loader2,
  Map,
  MousePointer2,
  RotateCw,
  Save,
  Search,
  Slash,
  Trash2,
  Type,
  Ungroup,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "./ui/utils";
import {
  createBlankFloorplan,
  createDefaultObjectBox,
  extractImportedObjectBoxElements,
  FLOORPLAN_LINE_STYLE_OPTIONS,
  getFloorplanElementMetrics,
  getStrokeDasharrayForLineStyle,
  inferObjectBoxDefaults,
  isFloorplanBackgroundElement,
  applyObjectBoxLayout,
  inferTextFontSize,
  OBJECT_BOX_SHAPE_OPTIONS,
  parseFloorplan,
  renderFloorplanSvg,
  resolveTextOverlayFontSize,
  type FloorplanAmendment,
  type FloorplanElementMetrics,
  type FloorplanGeneratedElement,
  type FloorplanLineStyle,
  type FloorplanLayer,
  type FloorplanPoint,
  type FloorplanShapeType,
  type FloorplanViewBox,
  type ObjectBoxShape,
} from "../lib/floorplanEditor";
import { convertRoomPlanFile } from "../lib/importRoomPlanFloorplan";
import { svgStringToAnnexTemplatePngBlob } from "../lib/svgToAnnexPng";
import {
  createDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  updateDraft,
  FLOORPLAN_DRAFT_PAYLOAD_VERSION,
  type FloorplanDraftPayload,
  type FloorplanDraftSummary,
} from "../lib/floorplanDrafts";
import { FloorplanInspectorPanel } from "./FloorplanInspectorPanel";
import { clientToSvg, computeSvgViewportMapping } from "../lib/svgViewport";
import { SHARED_FLOORPLAN_PNG_LIBRARY } from "../constants/floorplanPngLibrary";

const BLANK_FLOORPLAN = createBlankFloorplan();

type EditorMode = "select" | "placeObjectBox" | "placeText" | "placeLine";

interface LineDraft {
  start: FloorplanPoint;
  end: FloorplanPoint;
}

type DragState =
  | {
      mode: "pan";
      pointerId: number;
      startX: number;
      startY: number;
      startCamera: FloorplanViewBox;
    }
  | {
      mode: "move-layer";
      pointerId: number;
      targetIds: string[];
      startPoint: { x: number; y: number };
      startTranslations: Record<string, { x: number; y: number }>;
    }
  | {
      mode: "resize-layer";
      pointerId: number;
      targetId: string;
      targetTag: string;
      targetIsGenerated: boolean;
      startScaleX: number;
      startScaleY: number;
      startPoint: { x: number; y: number };
      startClientX: number;
      startClientY: number;
      startMetrics: FloorplanElementMetrics;
      startSize: { width: number; height: number };
    }
  | {
      mode: "rotate-layer";
      pointerId: number;
      startAngle: number;
      center: { x: number; y: number };
      startRotation: number;
      targetId: string;
    }
  | {
      mode: "draw-line";
      pointerId: number;
      startPoint: FloorplanPoint;
    };

interface FloorplanAnnexEditorProps {
  enabled: boolean;
  incidentNo?: string;
  locationOfFire?: string;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
  onFloorplanSvgChange?: (svg: string | null) => void;
  initialDraftState?: FloorplanDraftPayload | null;
  onDraftStateChange?: (payload: FloorplanDraftPayload) => void;
}

interface FloorplanGroup {
  id: string;
  name: string;
  memberIds: string[];
}

interface FloorplanHistoryEntry {
  amendments: Record<string, FloorplanAmendment>;
  generatedElements: FloorplanGeneratedElement[];
  groups: FloorplanGroup[];
  selectedId: string | null;
  selectedIds: string[];
  selectedGroupId: string | null;
  showGrid: boolean;
}

interface TextEditState {
  id: string;
  value: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: string;
  color: string;
}

interface PngLibraryItem {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
}

const ZOOM_IN_FACTOR = 0.88;
const ZOOM_OUT_FACTOR = 1.14;
const FLOORPLAN_PNG_LIBRARY_STORAGE_KEY = "firesight-floorplan-png-library";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function placeCaretAtEnd(element: HTMLElement) {
  if (!(element instanceof HTMLTextAreaElement)) return;
  const length = element.value.length;
  element.setSelectionRange(length, length);
}

function getTextEditSnapshot(node: SVGTextElement, canvas: HTMLDivElement, value: string): TextEditState {
  const bounds = getScreenBounds(node);
  const canvasRect = canvas.getBoundingClientRect();
  const computed = window.getComputedStyle(node);

  return {
    id: node.dataset.fsNodeId ?? "",
    value,
    rect: {
      left: bounds.left - canvasRect.left,
      top: bounds.top - canvasRect.top,
      width: bounds.width,
      height: bounds.height,
    },
    fontFamily: computed.fontFamily || node.getAttribute("font-family") || "Arial, sans-serif",
    fontSize: resolveTextOverlayFontSize(node.getAttribute("font-size"), computed.fontSize),
    fontWeight: computed.fontWeight || node.getAttribute("font-weight") || "400",
    fontStyle: computed.fontStyle || node.getAttribute("font-style") || "normal",
    letterSpacing: computed.letterSpacing || "normal",
    color: computed.fill || node.getAttribute("fill") || "#0f172a",
  };
}

function getNodeHit(target: EventTarget | null, viewBox?: FloorplanViewBox | null) {
  if (!(target instanceof Element)) return null;
  if (target.closest('[data-fs-background="true"]')) return null;
  const hit = target.closest("[data-fs-node-id]");
  if (!hit) return null;
  if (viewBox && isFloorplanBackgroundElement(hit, viewBox)) return null;
  return hit;
}

function getScreenBounds(node: SVGGraphicsElement) {
  if (node.tagName.toLowerCase() === "line") {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      centerClientX: rect.left + rect.width / 2,
      centerClientY: rect.top + rect.height / 2,
    };
  }

  const box = node.getBBox();
  const matrix = node.getScreenCTM();
  if (!matrix) {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      centerClientX: rect.left + rect.width / 2,
      centerClientY: rect.top + rect.height / 2,
    };
  }

  const corners = [
    new DOMPoint(box.x, box.y).matrixTransform(matrix),
    new DOMPoint(box.x + box.width, box.y).matrixTransform(matrix),
    new DOMPoint(box.x, box.y + box.height).matrixTransform(matrix),
    new DOMPoint(box.x + box.width, box.y + box.height).matrixTransform(matrix),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    centerClientX: left + (right - left) / 2,
    centerClientY: top + (bottom - top) / 2,
  };
}

function scalePoints(points: FloorplanPoint[], width?: number, height?: number) {
  if (points.length === 0) return points;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const currentWidth = maxX - minX || 1;
  const currentHeight = maxY - minY || 1;
  const scaleX = width ? width / currentWidth : 1;
  const scaleY = height ? height / currentHeight : 1;

  return points.map((point) => ({
    x: minX + (point.x - minX) * scaleX,
    y: minY + (point.y - minY) * scaleY,
  }));
}

function createDefaultElement(
  type: FloorplanShapeType,
  x: number,
  y: number,
  viewBox: FloorplanViewBox,
  svgText: string,
): FloorplanGeneratedElement {
  const id = `generated-${type}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  switch (type) {
    case "text":
      return {
        id,
        type,
        label: "New text",
        textContent: "New label",
        fontFamily: "Arial, sans-serif",
        fontWeight: "400",
        fontStyle: "normal",
        fill: "#0f172a",
        fontSize: inferTextFontSize(viewBox, svgText),
        x,
        y,
      };
    case "rect":
      return {
        id,
        type,
        label: "New rectangle",
        fill: "#ffffff",
        stroke: "#0f172a",
        strokeWidth: 4,
        x: x - 90,
        y: y - 60,
        width: 180,
        height: 120,
      };
    case "circle":
      return { id, type, label: "New circle", fill: "#ffffff", stroke: "#0f172a", strokeWidth: 4, x, y, radius: 48 };
    case "ellipse":
      return {
        id,
        type,
        label: "New ellipse",
        fill: "#ffffff",
        stroke: "#0f172a",
        strokeWidth: 4,
        x,
        y,
        radiusX: 90,
        radiusY: 54,
      };
    case "line":
      return { id, type, label: "New line", stroke: "#0f172a", strokeWidth: 4, x: x - 90, y, x2: x + 90, y2: y };
    case "polyline":
      return {
        id,
        type,
        label: "New polyline",
        fill: "#ffffff",
        stroke: "#0f172a",
        strokeWidth: 4,
        x,
        y,
        points: [
          { x: x - 90, y: y + 20 },
          { x: x - 20, y: y - 30 },
          { x: x + 40, y: y + 10 },
          { x: x + 110, y: y - 40 },
        ],
      };
    case "polygon":
      return {
        id,
        type,
        label: "New polygon",
        fill: "#ffffff",
        stroke: "#0f172a",
        strokeWidth: 4,
        x,
        y,
        points: [
          { x, y: y - 70 },
          { x: x + 70, y },
          { x, y: y + 70 },
          { x: x - 70, y },
        ],
      };
  }
}

function createLineElement(
  start: FloorplanPoint,
  end: FloorplanPoint,
  strokeWidth: number,
  lineStyle: FloorplanLineStyle,
): FloorplanGeneratedElement {
  return {
    id: `generated-line-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    type: "line",
    label: "New line",
    stroke: "#0f172a",
    strokeWidth,
    x: start.x,
    y: start.y,
    x2: end.x,
    y2: end.y,
    lineStyle,
  };
}

function getBoundsForGenerated(element: FloorplanGeneratedElement) {
  switch (element.type) {
    case "text": {
      const width = (element.textContent?.length ?? 6) * 16;
      return { width, height: 28, centerX: element.x, centerY: element.y - 14 };
    }
    case "image":
    case "rect":
    case "objectBox":
      return {
        width: element.width ?? 180,
        height: element.height ?? 120,
        centerX: element.x + (element.width ?? 180) / 2,
        centerY: element.y + (element.height ?? 120) / 2,
      };
    case "circle": {
      const radius = element.radius ?? 48;
      return { width: radius * 2, height: radius * 2, centerX: element.x, centerY: element.y };
    }
    case "ellipse": {
      const rx = element.radiusX ?? 90;
      const ry = element.radiusY ?? 54;
      return { width: rx * 2, height: ry * 2, centerX: element.x, centerY: element.y };
    }
    case "line":
      return {
        width: Math.abs((element.x2 ?? element.x + 180) - element.x),
        height: Math.abs((element.y2 ?? element.y) - element.y),
        centerX: (element.x + (element.x2 ?? element.x + 180)) / 2,
        centerY: (element.y + (element.y2 ?? element.y)) / 2,
      };
    case "polyline":
    case "polygon": {
      const points = element.points ?? [];
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        width: maxX - minX,
        height: maxY - minY,
        centerX: minX + (maxX - minX) / 2,
        centerY: minY + (maxY - minY) / 2,
      };
    }
  }
}

export function FloorplanAnnexEditor({
  enabled,
  incidentNo,
  locationOfFire,
  onOverrideChange,
  onFloorplanSvgChange,
  initialDraftState = null,
  onDraftStateChange,
}: FloorplanAnnexEditorProps) {
  const [svgText, setSvgText] = useState(BLANK_FLOORPLAN.svgText);
  const [layers, setLayers] = useState<FloorplanLayer[]>(BLANK_FLOORPLAN.layers);
  const [baseViewBox, setBaseViewBox] = useState<FloorplanViewBox>(BLANK_FLOORPLAN.baseViewBox);
  const [camera, setCamera] = useState<FloorplanViewBox>(BLANK_FLOORPLAN.baseViewBox);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<FloorplanGroup[]>([]);
  const [amendments, setAmendments] = useState<Record<string, FloorplanAmendment>>({});
  const [generatedElements, setGeneratedElements] = useState<FloorplanGeneratedElement[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [history, setHistory] = useState<FloorplanHistoryEntry[]>([]);
  const [textEditState, setTextEditState] = useState<TextEditState | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [objectBoxShape, setObjectBoxShape] = useState<ObjectBoxShape>("rect");
  const [lineStyle, setLineStyle] = useState<FloorplanLineStyle>("solid");
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null);
  const [pngLibrary, setPngLibrary] = useState<PngLibraryItem[]>([]);
  const [draftsDialogOpen, setDraftsDialogOpen] = useState(false);
  const [drafts, setDrafts] = useState<FloorplanDraftSummary[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [draftNameInput, setDraftNameInput] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [loadedDraftName, setLoadedDraftName] = useState<string | null>(null);
  const [pendingLoadDraftId, setPendingLoadDraftId] = useState<string | null>(null);
  const [pendingDeleteDraftId, setPendingDeleteDraftId] = useState<string | null>(null);
  const floorplanHydratedRef = useRef(false);
  const floorplanEmitReadyRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const textEditRef = useRef<HTMLTextAreaElement>(null);
  const textEditCommittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const libraryImageInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  const trimmedIncidentNo = incidentNo?.trim() ?? "";
  const draftsEnabled = trimmedIncidentNo.length > 0;

  const layerOptions = useMemo(
    () => [
      ...layers.map(
        (layer) =>
          ({
            ...layer,
            label:
              layer.isText
                ? amendments[layer.id]?.textContent ?? layer.textContent ?? layer.label
                : amendments[layer.id]?.label ?? layer.label,
            textContent: layer.isText ? amendments[layer.id]?.textContent ?? layer.textContent : layer.textContent,
          }) satisfies FloorplanLayer
      ),
      ...generatedElements.map(
        (element) =>
          ({
            id: element.id,
            label: element.type === "text" ? element.textContent || element.label : element.label,
            tagName: element.type,
            isText: element.type === "text",
            textContent: element.textContent,
            isGenerated: true,
          }) satisfies FloorplanLayer
      ),
    ],
    [amendments, generatedElements, layers]
  );

  const canvasSvg = useMemo(() => {
    if (!svgText || !camera) return null;
    const canvasAmendments = textEditState
      ? {
          ...amendments,
          [textEditState.id]: {
            ...amendments[textEditState.id],
            textContent: textEditState.value,
          },
        }
      : amendments;
    return renderFloorplanSvg({
      svgText,
      amendments: canvasAmendments,
      camera,
      selectedId,
      generatedElements: lineDraft
        ? [
            ...generatedElements,
            createLineElement(
              lineDraft.start,
              lineDraft.end,
              Math.max(2, inferObjectBoxDefaults(baseViewBox ?? camera, svgText).strokeWidth),
              lineStyle,
            ),
          ]
        : generatedElements,
    });
  }, [amendments, baseViewBox, camera, generatedElements, lineDraft, lineStyle, selectedId, svgText, textEditState?.id, textEditState?.value]);

  const exportSvg = useMemo(() => {
    if (!svgText || !baseViewBox) return null;
    return renderFloorplanSvg({
      svgText,
      amendments,
      camera: baseViewBox,
      selectedId: null,
      generatedElements,
    });
  }, [amendments, baseViewBox, generatedElements, svgText]);

  const selectedLayer = layerOptions.find((layer) => layer.id === selectedId) ?? null;
  const selectedAmendment = selectedId ? amendments[selectedId] ?? {} : {};
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const generatedElement = selectedLayer?.isGenerated
    ? generatedElements.find((element) => element.id === selectedLayer.id) ?? null
    : null;
  const effectiveGeneratedElement = generatedElement?.type === "image"
    ? {
        ...generatedElement,
        width: selectedAmendment.width ?? generatedElement.width,
        height: selectedAmendment.height ?? generatedElement.height,
        radius: selectedAmendment.radius ?? generatedElement.radius,
        radiusX: selectedAmendment.radiusX ?? generatedElement.radiusX,
        radiusY: selectedAmendment.radiusY ?? generatedElement.radiusY,
        x2: selectedAmendment.x2 ?? generatedElement.x2,
        y2: selectedAmendment.y2 ?? generatedElement.y2,
        rotation: selectedAmendment.rotation ?? generatedElement.rotation,
      }
    : generatedElement;
  const selectedSize = effectiveGeneratedElement ? getBoundsForGenerated(effectiveGeneratedElement) : null;
  const nativeMetrics =
    selectedId && svgText && selectedLayer && !selectedLayer.isGenerated
      ? getFloorplanElementMetrics(svgText, selectedId)
      : null;
  const effectiveNativeMetrics = nativeMetrics
    ? {
        ...nativeMetrics,
        width:
          (selectedAmendment.width ?? nativeMetrics.width) * (selectedAmendment.scaleX ?? 1),
        height:
          (selectedAmendment.height ?? nativeMetrics.height) * (selectedAmendment.scaleY ?? 1),
        radius: selectedAmendment.radius ?? nativeMetrics.radius,
        radiusX: selectedAmendment.radiusX ?? nativeMetrics.radiusX,
        radiusY: selectedAmendment.radiusY ?? nativeMetrics.radiusY,
        x2: selectedAmendment.x2 ?? nativeMetrics.x2,
        y2: selectedAmendment.y2 ?? nativeMetrics.y2,
      }
    : null;
  const activeMetrics = effectiveGeneratedElement
    ? {
        tagName: effectiveGeneratedElement.type,
        width: selectedSize?.width ?? 0,
        height: selectedSize?.height ?? 0,
        centerX: selectedSize?.centerX ?? effectiveGeneratedElement.x,
        centerY: selectedSize?.centerY ?? effectiveGeneratedElement.y,
        x: effectiveGeneratedElement.x,
        y: effectiveGeneratedElement.y,
        x2: effectiveGeneratedElement.x2,
        y2: effectiveGeneratedElement.y2,
        radius: effectiveGeneratedElement.radius,
        radiusX: effectiveGeneratedElement.radiusX,
        radiusY: effectiveGeneratedElement.radiusY,
      }
    : effectiveNativeMetrics;
  const amendmentCount = Object.keys(amendments).length + generatedElements.length + groups.length;
  const gridStyle = useMemo(() => {
    if (!showGrid || !camera || !baseViewBox || !canvasRef.current) return undefined;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return undefined;

    const mapping = computeSvgViewportMapping(rect, camera);
    const worldGridSize = Math.max(baseViewBox.width, baseViewBox.height) / 20;
    const pixelGridSize = Math.max(12, worldGridSize * mapping.scale);
    const offsetX = -((camera.x % worldGridSize) * mapping.scale);
    const offsetY = -((camera.y % worldGridSize) * mapping.scale);

    return {
      backgroundImage:
        "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
      backgroundSize: `${pixelGridSize}px ${pixelGridSize}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    } as const;
  }, [showGrid, camera, baseViewBox]);
  const isRectSelection = selectedLayer?.tagName === "rect";
  const isObjectBoxSelection = selectedLayer?.tagName === "objectBox";
  const isShapeSelection = Boolean(selectedLayer && !selectedLayer.isText);
  const containingGroup = selectedId ? groups.find((group) => group.memberIds.includes(selectedId)) ?? null : null;
  const selectedTextValue =
    selectedLayer?.isText
      ? textEditState?.id === selectedId
        ? textEditState.value
        : selectedAmendment.textContent ?? generatedElement?.textContent ?? selectedLayer.textContent ?? selectedLayer.label
      : null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FLOORPLAN_PNG_LIBRARY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setPngLibrary(
        parsed.filter(
          (entry): entry is PngLibraryItem =>
            entry &&
            typeof entry.id === "string" &&
            typeof entry.name === "string" &&
            typeof entry.dataUrl === "string" &&
            typeof entry.width === "number" &&
            typeof entry.height === "number",
        ),
      );
    } catch {
      window.localStorage.removeItem(FLOORPLAN_PNG_LIBRARY_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FLOORPLAN_PNG_LIBRARY_STORAGE_KEY, JSON.stringify(pngLibrary));
  }, [pngLibrary]);

  useEffect(() => {
    if (floorplanHydratedRef.current || !initialDraftState) return;
    floorplanHydratedRef.current = true;
    applyDraft(initialDraftState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraftState]);

  useEffect(() => {
    if (!onDraftStateChange) return;
    if (!floorplanEmitReadyRef.current) {
      floorplanEmitReadyRef.current = true;
      return;
    }
    onDraftStateChange(buildDraftPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, amendments, generatedElements, groups, baseViewBox, fileName, onDraftStateChange]);

  useEffect(() => {
    if (!textEditState || !textEditRef.current) return;
    textEditRef.current.focus();
    placeCaretAtEnd(textEditRef.current);
  }, [textEditState?.id]);

  useEffect(() => {
    if (!textEditState || !textEditRef.current) return;
    textEditRef.current.style.height = "auto";
    textEditRef.current.style.height = `${textEditRef.current.scrollHeight}px`;
  }, [textEditState?.value]);

  useEffect(() => {
    if (editorMode !== "placeLine" && lineDraft) {
      setLineDraft(null);
    }
  }, [editorMode, lineDraft]);

  function captureHistory() {
    setHistory((current) => [
      ...current,
      {
        amendments: JSON.parse(JSON.stringify(amendments)),
        generatedElements: JSON.parse(JSON.stringify(generatedElements)),
        groups: JSON.parse(JSON.stringify(groups)),
        selectedId,
        selectedIds: [...selectedIds],
        selectedGroupId,
        showGrid,
      },
    ]);
  }

  function undoLastChange() {
    setHistory((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      setAmendments(previous.amendments);
      setGeneratedElements(previous.generatedElements);
      setGroups(previous.groups);
      setSelectedId(previous.selectedId);
      setSelectedIds(previous.selectedIds);
      setSelectedGroupId(previous.selectedGroupId);
      setShowGrid(previous.showGrid);
      return current.slice(0, -1);
    });
  }

  useEffect(() => {
    function handleUndoShortcut(event: KeyboardEvent) {
      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      if (!isUndo) return;

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      undoLastChange();
    }

    function handleArrowNudge(event: KeyboardEvent) {
      if (!selectedId) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const step = event.shiftKey ? 10 : 2;
      let deltaX = 0;
      let deltaY = 0;

      switch (event.key) {
        case "ArrowLeft":
          deltaX = -step;
          break;
        case "ArrowRight":
          deltaX = step;
          break;
        case "ArrowUp":
          deltaY = -step;
          break;
        case "ArrowDown":
          deltaY = step;
          break;
        default:
          return;
      }

      event.preventDefault();
      captureHistory();
      const targetIds = groups.find((group) => group.memberIds.includes(selectedId))?.memberIds ?? [selectedId];
      setAmendments((current) => {
        const next = { ...current };
        for (const id of targetIds) {
          next[id] = {
            ...next[id],
            translateX: (next[id]?.translateX ?? 0) + deltaX,
            translateY: (next[id]?.translateY ?? 0) + deltaY,
          };
        }
        return next;
      });
    }

    function handleGroupShortcut(event: KeyboardEvent) {
      const isGroup = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g" && !event.shiftKey;
      if (!isGroup) return;

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (selectedIds.length < 2) return;
      event.preventDefault();
      createGroupFromSelection();
    }

    function handleDeleteShortcut(event: KeyboardEvent) {
      const isDelete = event.key === "Delete" || event.key === "Backspace";
      if (!isDelete) return;

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (!selectedId && selectedIds.length === 0) return;
      event.preventDefault();
      deleteSelectedNodes();
    }

    function handleEscapeShortcut(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (lineDraft) {
        event.preventDefault();
        setLineDraft(null);
        setEditorMode("select");
      }
    }

    window.addEventListener("keydown", handleUndoShortcut);
    window.addEventListener("keydown", handleArrowNudge);
    window.addEventListener("keydown", handleGroupShortcut);
    window.addEventListener("keydown", handleDeleteShortcut);
    window.addEventListener("keydown", handleEscapeShortcut);
    return () => {
      window.removeEventListener("keydown", handleUndoShortcut);
      window.removeEventListener("keydown", handleArrowNudge);
      window.removeEventListener("keydown", handleGroupShortcut);
      window.removeEventListener("keydown", handleDeleteShortcut);
      window.removeEventListener("keydown", handleEscapeShortcut);
    };
  }, [history.length, selectedId, amendments, generatedElements, groups, lineDraft, selectedGroupId, selectedIds, showGrid]);

  useEffect(() => {
    onFloorplanSvgChange?.(exportSvg);
  }, [exportSvg, onFloorplanSvgChange]);

  useEffect(() => {
    if (!exportSvg || !enabled) {
      onOverrideChange(0, null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const blob = await svgStringToAnnexTemplatePngBlob(exportSvg, {
          incidentNo,
          locationOfFire,
        });
        if (!cancelled) onOverrideChange(0, blob);
      } catch (error) {
        if (!cancelled) {
          setUploadError(error instanceof Error ? error.message : "Unable to prepare the floorplan image.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exportSvg, enabled, incidentNo, locationOfFire, onOverrideChange]);

  function setSingleSelection(layerId: string | null) {
    if (textEditState && layerId !== textEditState.id) {
      commitTextEdit(textEditState.value);
    }
    setSelectedId(layerId);
    setSelectedIds(layerId ? [layerId] : []);
    setSelectedGroupId(layerId ? groups.find((group) => group.memberIds.includes(layerId))?.id ?? null : null);
    if (textEditState && layerId !== textEditState.id) {
      setTextEditState(null);
    }
  }

  function updateGeneratedElementWithoutHistory(
    elementId: string,
    updater: (element: FloorplanGeneratedElement) => FloorplanGeneratedElement
  ) {
    setGeneratedElements((current) => current.map((element) => (element.id === elementId ? updater(element) : element)));
  }

  function startTextEdit(layerId: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const node = canvas.querySelector<SVGTextElement>(`[data-fs-node-id="${layerId}"]`);
    const layer = layerOptions.find((entry) => entry.id === layerId);
    if (!node || !layer?.isText) return;

    const value = amendments[layerId]?.textContent ?? layer.textContent ?? "";
    setSingleSelection(layerId);
    setInspectorOpen(true);
    setTextEditState(getTextEditSnapshot(node, canvas, value));
  }

  function commitTextEdit(nextValue: string) {
    if (!textEditState) return;
    updateSelectedAmendment({ textContent: nextValue });
    if (generatedElement?.id === textEditState.id) {
      updateGeneratedElementWithoutHistory(textEditState.id, (element) => ({ ...element, textContent: nextValue }));
    }
    setTextEditState(null);
  }

  function finishTextEdit(nextValue: string) {
    textEditCommittingRef.current = true;
    commitTextEdit(nextValue);
    window.setTimeout(() => {
      textEditCommittingRef.current = false;
    }, 0);
  }

  function deleteSelectedNodes() {
    const targetIds = selectedId
      ? groups.find((group) => group.memberIds.includes(selectedId))?.memberIds ??
        (selectedIds.length > 0 ? selectedIds : [selectedId])
      : selectedIds;
    if (targetIds.length === 0) return;

    captureHistory();
    const generatedIds = new Set(generatedElements.map((element) => element.id));
    const removeIds = targetIds.filter((id) => generatedIds.has(id));
    const hideIds = targetIds.filter((id) => !generatedIds.has(id));

    if (removeIds.length > 0) {
      setGeneratedElements((current) => current.filter((element) => !removeIds.includes(element.id)));
    }

    setAmendments((current) => {
      const next = { ...current };
      for (const id of removeIds) {
        delete next[id];
      }
      for (const id of hideIds) {
        next[id] = {
          ...next[id],
          hidden: true,
        };
      }
      return next;
    });

    setGroups((current) =>
      current
        .map((group) => ({
          ...group,
          memberIds: group.memberIds.filter((id) => !targetIds.includes(id)),
        }))
        .filter((group) => group.memberIds.length > 0)
    );
    setSelectedGroupId(null);
    setSingleSelection(null);
    setInspectorOpen(false);
  }

  function loadFloorplan(
    rawSvg: string,
    nextFileName: string,
    options?: { convertImportedObjectRects?: boolean },
  ) {
    const normalized = options?.convertImportedObjectRects
      ? extractImportedObjectBoxElements(rawSvg)
      : { svgText: rawSvg, generatedElements: [] };
    const parsed = parseFloorplan(normalized.svgText);
    setSvgText(parsed.svgText);
    setLayers(parsed.layers);
    setBaseViewBox(parsed.baseViewBox);
    setCamera(parsed.baseViewBox);
    setSingleSelection(normalized.generatedElements[0]?.id ?? parsed.layers[0]?.id ?? null);
    setSelectedGroupId(null);
    setGroups([]);
    setAmendments({});
    setGeneratedElements(normalized.generatedElements);
    setFileName(nextFileName);
    setUploadError(null);
    setInspectorOpen(false);
    setHistory([]);
    requestAnimationFrame(() => {
      fitCameraToBounds(parsed.baseViewBox, 1.05);
    });
  }

  function buildDraftPayload(): FloorplanDraftPayload {
    return {
      version: FLOORPLAN_DRAFT_PAYLOAD_VERSION,
      svgText,
      baseViewBox,
      amendments,
      generatedElements,
      groups,
      fileName,
    };
  }

  function applyDraft(payload: FloorplanDraftPayload) {
    const parsed = parseFloorplan(payload.svgText);
    const viewBox = parsed.baseViewBox ?? payload.baseViewBox;
    setSvgText(parsed.svgText);
    setLayers(parsed.layers);
    setBaseViewBox(viewBox);
    setCamera(viewBox);
    setAmendments(payload.amendments ?? {});
    setGeneratedElements(payload.generatedElements ?? []);
    setGroups(payload.groups ?? []);
    setSelectedGroupId(null);
    setSingleSelection(null);
    setInspectorOpen(false);
    setHistory([]);
    setFileName(payload.fileName ?? "");
    setUploadError(null);
    requestAnimationFrame(() => {
      fitCameraToBounds(viewBox, 1.05);
    });
  }

  async function generateDraftThumbnail(): Promise<string | null> {
    if (!exportSvg) return null;
    try {
      const blob = new Blob([exportSvg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      try {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const maxDimension = 240;
            const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
            const width = ratio >= 1 ? maxDimension : Math.round(maxDimension * ratio);
            const height = ratio >= 1 ? Math.round(maxDimension / ratio) : maxDimension;
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
        return dataUrl;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      return null;
    }
  }

  async function refreshDrafts() {
    if (!draftsEnabled) {
      setDrafts([]);
      return;
    }
    setDraftsLoading(true);
    setDraftsError(null);
    try {
      const list = await listDrafts(trimmedIncidentNo);
      setDrafts(list);
    } catch (error) {
      setDraftsError(error instanceof Error ? error.message : "Unable to load drafts.");
    } finally {
      setDraftsLoading(false);
    }
  }

  function handleOpenDraftsDialog() {
    setDraftsDialogOpen(true);
    void refreshDrafts();
  }

  async function handleSaveNewDraft() {
    if (!draftsEnabled || savingDraft) return;
    const name = draftNameInput.trim();
    if (!name) {
      toast.warning("Enter a name for the draft.");
      return;
    }
    setSavingDraft(true);
    try {
      const payload = buildDraftPayload();
      const thumbnail = await generateDraftThumbnail();
      const created = await createDraft(trimmedIncidentNo, name, payload, thumbnail);
      setLoadedDraftId(created.id);
      setLoadedDraftName(created.name);
      setDraftNameInput("");
      toast.success(`Saved draft "${created.name}".`);
      await refreshDrafts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleOverwriteDraft() {
    if (!loadedDraftId || savingDraft) return;
    setSavingDraft(true);
    try {
      const payload = buildDraftPayload();
      const thumbnail = await generateDraftThumbnail();
      const updated = await updateDraft(loadedDraftId, payload, { thumbnail });
      setLoadedDraftName(updated.name);
      toast.success(`Updated draft "${updated.name}".`);
      await refreshDrafts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function performLoadDraft(id: string) {
    try {
      const draft = await getDraft(id);
      applyDraft(draft.payload);
      setLoadedDraftId(draft.id);
      setLoadedDraftName(draft.name);
      setDraftsDialogOpen(false);
      toast.success(`Loaded draft "${draft.name}".`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load draft.");
    }
  }

  function handleRequestLoadDraft(id: string) {
    setPendingLoadDraftId(id);
  }

  async function handleConfirmLoadDraft() {
    const id = pendingLoadDraftId;
    setPendingLoadDraftId(null);
    if (id) await performLoadDraft(id);
  }

  async function performDeleteDraft(id: string) {
    try {
      await deleteDraft(id);
      if (loadedDraftId === id) {
        setLoadedDraftId(null);
        setLoadedDraftName(null);
      }
      toast.success("Draft deleted.");
      await refreshDrafts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete draft.");
    }
  }

  async function handleConfirmDeleteDraft() {
    const id = pendingDeleteDraftId;
    setPendingDeleteDraftId(null);
    if (id) await performDeleteDraft(id);
  }

  function isJsonFile(file: File) {
    return file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
  }

  async function processImportFile(file: File) {
    setImporting(true);
    setUploadError(null);
    try {
      const jsonImport = isJsonFile(file);
      let rawSvg: string;
      let warnings: string[] = [];
      if (jsonImport) {
        ({ svg: rawSvg, warnings } = await convertRoomPlanFile(file));
      } else {
        rawSvg = await file.text();
      }
      const name = jsonImport ? file.name.replace(/\.json$/i, ".svg") : file.name;
      loadFloorplan(rawSvg, name, { convertImportedObjectRects: jsonImport });
      toast.success(
        jsonImport ? "Layout plan generated from RoomPlan scan" : "SVG layout plan loaded",
      );
      for (const warning of warnings) {
        toast.warning(warning);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to import layout plan.";
      setUploadError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  function findImageContentBounds(data: Uint8ClampedArray, width: number, height: number) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const alpha = data[index + 3];
        const isTransparent = alpha <= 8;
        const isNearWhite = red >= 245 && green >= 245 && blue >= 245;

        if (isTransparent || isNearWhite) continue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX < minX || maxY < minY) return null;
    return {
      minX,
      minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  async function normalizeImageSource(source: string) {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
          return;
        }

        context.drawImage(image, 0, 0);
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
        const bounds = findImageContentBounds(data, width, height);
        if (!bounds) {
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
          return;
        }
        resolve({
          width: bounds.width,
          height: bounds.height,
        });
      };
      image.onerror = () => reject(new Error("Unable to load the selected PNG."));
      image.src = source;
    });

    const trimmedDataUrl = await new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(source);
          return;
        }

        context.drawImage(image, 0, 0);
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
        const bounds = findImageContentBounds(data, width, height);
        if (!bounds) {
          resolve(source);
          return;
        }
        const trimmedCanvas = document.createElement("canvas");
        trimmedCanvas.width = bounds.width;
        trimmedCanvas.height = bounds.height;
        const trimmedContext = trimmedCanvas.getContext("2d");
        if (!trimmedContext) {
          resolve(source);
          return;
        }

        trimmedContext.drawImage(
          canvas,
          bounds.minX,
          bounds.minY,
          bounds.width,
          bounds.height,
          0,
          0,
          bounds.width,
          bounds.height,
        );

        resolve(trimmedCanvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("Unable to load the selected PNG."));
      image.src = source;
    });

    return { dataUrl: trimmedDataUrl, dimensions };
  }

  async function readImageFile(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Unable to read the selected image."));
      };
      reader.onerror = () => reject(new Error("Unable to read the selected image."));
      reader.readAsDataURL(file);
    });

    return normalizeImageSource(dataUrl);
  }

  function placePngElement(asset: { name: string; dataUrl: string; width: number; height: number }) {
    if (!baseViewBox || !camera) return;
    const aspectRatio = asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
    const viewportScale = Math.max(getViewportScale() ?? 1, 0.0001);
    const minVisibleWidth = 96 / viewportScale;
    const minVisibleHeight = 96 / viewportScale;
    const maxWidth = camera.width * 0.18;
    const maxHeight = camera.height * 0.22;
    let width = Math.max(camera.width * 0.08, minVisibleWidth);
    let height = width / Math.max(aspectRatio, 0.01);

    if (height < minVisibleHeight) {
      height = minVisibleHeight;
      width = height * Math.max(aspectRatio, 0.01);
    }

    if (width > maxWidth) {
      width = maxWidth;
      height = width / Math.max(aspectRatio, 0.01);
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * Math.max(aspectRatio, 0.01);
    }

    const centerX = camera.x + camera.width / 2;
    const centerY = camera.y + camera.height / 2;
    const marginX = Math.max(camera.width * 0.04, width / 2);
    const marginY = Math.max(camera.height * 0.04, height / 2);
    const clampedCenterX = Math.min(
      camera.x + camera.width - marginX,
      Math.max(camera.x + marginX, centerX),
    );
    const clampedCenterY = Math.min(
      camera.y + camera.height - marginY,
      Math.max(camera.y + marginY, centerY),
    );
    const imageElement: FloorplanGeneratedElement = {
      id: `generated-image-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      type: "image",
      label: asset.name.replace(/\.[^.]+$/, "") || "Uploaded PNG",
      imageHref: asset.dataUrl,
      x: clampedCenterX - width / 2,
      y: clampedCenterY - height / 2,
      width,
      height,
    };

    captureHistory();
    setGeneratedElements((current) => [...current, imageElement]);
    setSingleSelection(imageElement.id);
    setInspectorOpen(true);
    fitCameraToBounds(
      {
        x: imageElement.x,
        y: imageElement.y,
        width,
        height,
      },
      1.5,
    );
    toast.success("PNG element added to the floorplan.");
  }

  async function handleImageUpload(file: File) {
    setUploadError(null);
    try {
      const { dataUrl, dimensions } = await readImageFile(file);
      placePngElement({
        name: file.name,
        dataUrl,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to place the selected PNG.";
      setUploadError(message);
      toast.error(message);
    }
  }

  function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (fileName || layers.length > 0 || generatedElements.length > 0) {
      pendingFileRef.current = file;
      setReplaceDialogOpen(true);
      return;
    }

    void processImportFile(file);
  }

  function handleImageImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
      const message = "Please upload a PNG file for floorplan elements.";
      setUploadError(message);
      toast.error(message);
      return;
    }
    void handleImageUpload(file);
  }

  async function handleLibraryImageImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
      const message = "Please upload a PNG file for the library.";
      setUploadError(message);
      toast.error(message);
      return;
    }

    setUploadError(null);
    try {
      const { dataUrl, dimensions } = await readImageFile(file);
      const item: PngLibraryItem = {
        id: `library-png-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        name: file.name.replace(/\.[^.]+$/, "") || "PNG element",
        dataUrl,
        width: dimensions.width,
        height: dimensions.height,
        createdAt: Date.now(),
      };
      setPngLibrary((current) => [item, ...current]);
      toast.success("PNG saved to the floorplan library.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save the PNG to the library.";
      setUploadError(message);
      toast.error(message);
    }
  }

  async function placeLibraryImage(item: PngLibraryItem) {
    setUploadError(null);
    try {
      const normalized = await normalizeImageSource(item.dataUrl);
      placePngElement({
        name: item.name,
        dataUrl: normalized.dataUrl,
        width: normalized.dimensions.width,
        height: normalized.dimensions.height,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to place the selected PNG.";
      setUploadError(message);
      toast.error(message);
    }
  }

  function removeLibraryImage(itemId: string) {
    setPngLibrary((current) => current.filter((item) => item.id !== itemId));
    toast.success("PNG removed from the floorplan library.");
  }

  function handleConfirmReplace() {
    const file = pendingFileRef.current;
    pendingFileRef.current = null;
    setReplaceDialogOpen(false);
    if (file) void processImportFile(file);
  }

  function handleCancelReplace() {
    pendingFileRef.current = null;
    setReplaceDialogOpen(false);
  }

  function getFloorplanSvg(): SVGSVGElement | null {
    return canvasRef.current?.querySelector("svg") ?? null;
  }

  function getViewportScale(): number | null {
    const ctm = getFloorplanSvg()?.getScreenCTM();
    if (ctm) return ctm.a;

    const canvas = canvasRef.current;
    if (!canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return computeSvgViewportMapping(rect, camera).scale;
  }

  function getSvgPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas || !camera) return null;

    const svg = getFloorplanSvg();
    const ctm = svg?.getScreenCTM();
    if (svg && ctm) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const svgPoint = point.matrixTransform(ctm.inverse());
      return { x: svgPoint.x, y: svgPoint.y };
    }

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return clientToSvg(clientX, clientY, computeSvgViewportMapping(rect, camera), camera);
  }

  function applyZoom(factor: number, clientX?: number, clientY?: number) {
    const canvas = canvasRef.current;
    if (!canvas || !baseViewBox || !camera) return;
    const rect = canvas.getBoundingClientRect();
    const centerX = clientX ?? rect.left + rect.width / 2;
    const centerY = clientY ?? rect.top + rect.height / 2;
    const anchor = getSvgPoint(centerX, centerY);
    if (!anchor) return;

    setCamera((current) => {
      if (!current) return current;
      const minWidth = baseViewBox.width * 0.03;
      const maxWidth = baseViewBox.width * 6;
      const nextWidth = clamp(current.width * factor, minWidth, maxWidth);
      const nextHeight = (nextWidth / current.width) * current.height;
      const ratioX = (anchor.x - current.x) / current.width;
      const ratioY = (anchor.y - current.y) / current.height;
      return {
        x: anchor.x - ratioX * nextWidth,
        y: anchor.y - ratioY * nextHeight,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

  function fitCameraToBounds(bounds: { x: number; y: number; width: number; height: number }, padding = 1.3) {
    const canvas = canvasRef.current;
    const viewportAspect =
      canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0
        ? canvas.clientWidth / canvas.clientHeight
        : camera
          ? camera.width / Math.max(camera.height, 0.0001)
          : 1;

    const paddedWidth = Math.max(bounds.width * padding, 1);
    const paddedHeight = Math.max(bounds.height * padding, 1);
    let nextWidth = paddedWidth;
    let nextHeight = paddedHeight;

    if (paddedWidth / paddedHeight > viewportAspect) {
      nextHeight = paddedWidth / Math.max(viewportAspect, 0.0001);
    } else {
      nextWidth = paddedHeight * viewportAspect;
    }

    setCamera({
      x: bounds.x + bounds.width / 2 - nextWidth / 2,
      y: bounds.y + bounds.height / 2 - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
    });
  }

  function resetCamera() {
    if (baseViewBox) {
      setCamera(baseViewBox);
      requestAnimationFrame(() => {
        fitCameraToBounds(baseViewBox, 1.05);
      });
    }
  }

  function runObjectBoxLayout(
    nextGeneratedElements: FloorplanGeneratedElement[],
    nextAmendments: Record<string, FloorplanAmendment>,
  ) {
    if (!baseViewBox) {
      return {
        generatedElements: nextGeneratedElements,
        amendments: nextAmendments,
        unresolved: false,
      };
    }

    const layout = applyObjectBoxLayout({
      svgText,
      generatedElements: nextGeneratedElements,
      amendments: nextAmendments,
      viewBox: baseViewBox,
    });
    if (layout.unresolved) {
      toast.warning("Some object boxes could not be fully separated.");
    }
    return layout;
  }

  function updateSelectedAmendment(patch: FloorplanAmendment) {
    if (!selectedId) return;
    captureHistory();
    setAmendments((current) => ({
      ...current,
      [selectedId]: {
        ...current[selectedId],
        ...patch,
      },
    }));
  }

  function updateGeneratedElement(updater: (element: FloorplanGeneratedElement) => FloorplanGeneratedElement) {
    if (!generatedElement) return;
    captureHistory();
    setGeneratedElements((current) =>
      current.map((element) => (element.id === generatedElement.id ? updater(element) : element))
    );
  }

  function createGroupFromSelection() {
    const uniqueIds = Array.from(new Set(selectedIds));
    if (uniqueIds.length < 2) return;
    captureHistory();
    const nextGroup: FloorplanGroup = {
      id: `group-${Date.now()}`,
      name: `Group ${groups.length + 1}`,
      memberIds: uniqueIds,
    };
    setGroups((current) => [...current, nextGroup]);
    setSelectedGroupId(nextGroup.id);
  }

  function ungroupSelectedGroup() {
    if (!selectedGroupId) return;
    captureHistory();
    setGroups((current) => current.filter((group) => group.id !== selectedGroupId));
    setSelectedGroupId(null);
  }

  function getActiveMoveIds(layerId: string) {
    const owningGroup = groups.find((group) => group.memberIds.includes(layerId));
    if (owningGroup) return owningGroup.memberIds;
    return selectedIds.includes(layerId) && selectedIds.length > 1 ? selectedIds : [layerId];
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !camera) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let shouldCapturePointer = true;

    const hit = getNodeHit(event.target, baseViewBox);

    if (editorMode === "placeLine") {
      const point = getSvgPoint(event.clientX, event.clientY);
      if (!point || !baseViewBox) return;

      if (!lineDraft) {
        setLineDraft({ start: point, end: point });
        setSingleSelection(null);
        setSelectedGroupId(null);
        setInspectorOpen(false);
        return;
      }

      const distance = Math.hypot(point.x - lineDraft.start.x, point.y - lineDraft.start.y);
      if (distance < 1) return;

      captureHistory();
      const strokeWidth = Math.max(2, inferObjectBoxDefaults(baseViewBox, svgText).strokeWidth);
      const element = createLineElement(lineDraft.start, point, strokeWidth, lineStyle);
      setGeneratedElements((current) => [...current, element]);
      setLineDraft(null);
      setSingleSelection(element.id);
      setSelectedGroupId(null);
      setInspectorOpen(true);
      return;
    }

    if (editorMode === "placeObjectBox") {
      if (!hit || (baseViewBox && isFloorplanBackgroundElement(hit, baseViewBox))) {
        const point = getSvgPoint(event.clientX, event.clientY);
        if (!point || !baseViewBox) return;
        captureHistory();
        const element = createDefaultObjectBox(point.x, point.y, baseViewBox, svgText, objectBoxShape);
        const layout = runObjectBoxLayout([...generatedElements, element], amendments);
        setGeneratedElements(layout.generatedElements);
        setAmendments(layout.amendments);
        setSingleSelection(element.id);
        setSelectedGroupId(null);
        setInspectorOpen(true);
        return;
      }
    }

    if (editorMode === "placeText") {
      if (!hit || (baseViewBox && isFloorplanBackgroundElement(hit, baseViewBox))) {
        const point = getSvgPoint(event.clientX, event.clientY);
        if (!point || !baseViewBox) return;
        captureHistory();
        const element = createDefaultElement("text", point.x, point.y, baseViewBox, svgText);
        setGeneratedElements((current) => [...current, element]);
        setSingleSelection(element.id);
        setSelectedGroupId(null);
        setInspectorOpen(true);
        return;
      }
    }

    if (hit) {
      const layerId = hit.getAttribute("data-fs-node-id");
      if (!layerId) return;
      const layer = layerOptions.find((entry) => entry.id === layerId) ?? null;

      if (layer?.isText && event.detail >= 2) {
        event.preventDefault();
        event.stopPropagation();
        startTextEdit(layerId);
        return;
      }

      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        setSelectedIds((current) => {
          const next = current.includes(layerId)
            ? current.filter((id) => id !== layerId)
            : [...current, layerId];
          setSelectedId(next[next.length - 1] ?? layerId);
          return next;
        });
      } else {
        setSingleSelection(layerId);
      }
      setInspectorOpen(true);

      if (layer?.isText) {
        shouldCapturePointer = false;
      }

      const point = getSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      const targetIds = getActiveMoveIds(layerId);
      const startTranslations = Object.fromEntries(
        targetIds.map((id) => [id, { x: amendments[id]?.translateX ?? 0, y: amendments[id]?.translateY ?? 0 }])
      );
      captureHistory();
      setDragState({
        mode: "move-layer",
        pointerId: event.pointerId,
        targetIds,
        startPoint: point,
        startTranslations,
      });
    } else {
      if (!(event.shiftKey || event.ctrlKey || event.metaKey)) {
        setSingleSelection(null);
        setSelectedGroupId(null);
      }
      setDragState({
        mode: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCamera: camera,
      });
    }
    if (shouldCapturePointer) {
      canvas.setPointerCapture(event.pointerId);
    }
  }

  function handleCanvasDoubleClick(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const hit = getNodeHit(event.target, baseViewBox);
    if (!hit) return;
    const layerId = hit.getAttribute("data-fs-node-id");
    if (!layerId) return;
    const layer = layerOptions.find((entry) => entry.id === layerId);
    if (!layer?.isText) return;
    startTextEdit(layerId);
  }

  function updateTextEditValue(nextValue: string) {
    setTextEditState((current) => (current ? { ...current, value: nextValue } : current));
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (editorMode === "placeLine" && lineDraft && !dragState) {
      const point = getSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      setLineDraft((current) => (current ? { ...current, end: point } : current));
      return;
    }

    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (dragState.mode === "pan") {
      const startPoint = getSvgPoint(dragState.startX, dragState.startY);
      const currentPoint = getSvgPoint(event.clientX, event.clientY);
      if (!startPoint || !currentPoint) return;
      setCamera({
        ...dragState.startCamera,
        x: dragState.startCamera.x - (currentPoint.x - startPoint.x),
        y: dragState.startCamera.y - (currentPoint.y - startPoint.y),
      });
      return;
    }

    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;

    if (dragState.mode === "move-layer") {
      const deltaX = point.x - dragState.startPoint.x;
      const deltaY = point.y - dragState.startPoint.y;
      setAmendments((current) => {
        const next = { ...current };
        for (const id of dragState.targetIds) {
          next[id] = {
            ...next[id],
            translateX: dragState.startTranslations[id].x + deltaX,
            translateY: dragState.startTranslations[id].y + deltaY,
          };
        }
        return next;
      });
      return;
    }

    if (dragState.mode === "resize-layer") {
      const deltaX = point.x - dragState.startPoint.x;
      const deltaY = point.y - dragState.startPoint.y;
      const objectBoxDefaults =
        dragState.targetTag === "objectBox" && baseViewBox
          ? inferObjectBoxDefaults(baseViewBox, svgText)
          : null;
      const imageMinWidth = baseViewBox
        ? Math.max(baseViewBox.width * 0.01, dragState.startSize.width * 0.1)
        : Math.max(0.25, dragState.startSize.width * 0.1);
      const imageMinHeight = baseViewBox
        ? Math.max(baseViewBox.height * 0.01, dragState.startSize.height * 0.1)
        : Math.max(0.25, dragState.startSize.height * 0.1);
      const minWidth =
        dragState.targetTag === "image"
          ? imageMinWidth
          : objectBoxDefaults
            ? objectBoxDefaults.width * 0.15
            : 20;
      const minHeight =
        dragState.targetTag === "image"
          ? imageMinHeight
          : objectBoxDefaults
            ? objectBoxDefaults.height * 0.15
            : 20;
      let nextWidth = Math.max(minWidth, dragState.startSize.width + deltaX);
      let nextHeight = Math.max(minHeight, dragState.startSize.height + deltaY);

      if (dragState.targetTag === "image") {
        const startAspectRatio = dragState.startSize.width / Math.max(1, dragState.startSize.height);
        const viewportScale = Math.max(getViewportScale() ?? 1, 0.0001);
        const startScreenWidth = Math.max(12, dragState.startSize.width * viewportScale);
        const startScreenHeight = Math.max(12, dragState.startSize.height * viewportScale);
        const deltaClientX = event.clientX - dragState.startClientX;
        const deltaClientY = event.clientY - dragState.startClientY;
        const scaleFromWidth = (startScreenWidth + deltaClientX) / startScreenWidth;
        const scaleFromHeight = (startScreenHeight + deltaClientY) / startScreenHeight;
        const widthDominant =
          Math.abs(deltaClientX / startScreenWidth) >= Math.abs(deltaClientY / startScreenHeight);
        const scale = Math.max(0.1, widthDominant ? scaleFromWidth : scaleFromHeight);
        nextWidth = Math.max(minWidth, dragState.startSize.width * scale);
        nextHeight = Math.max(minHeight, nextWidth / Math.max(0.01, startAspectRatio));
      }

      setAmendments((current) => {
        const next = { ...current };
        const currentEntry = { ...next[dragState.targetId] };
        const useScaleResize =
          !dragState.targetIsGenerated &&
          (dragState.targetTag === "rect" ||
            dragState.targetTag === "path" ||
            dragState.targetTag === "polyline" ||
            dragState.targetTag === "polygon");

        if (useScaleResize) {
          currentEntry.scaleX = Math.max(
            0.1,
            dragState.startScaleX * (nextWidth / Math.max(1, dragState.startSize.width)),
          );
          currentEntry.scaleY = Math.max(
            0.1,
            dragState.startScaleY * (nextHeight / Math.max(1, dragState.startSize.height)),
          );
          delete currentEntry.width;
          delete currentEntry.height;
          next[dragState.targetId] = currentEntry;
          return next;
        }

        switch (dragState.targetTag) {
          case "image":
          case "rect":
          case "objectBox":
            currentEntry.width = nextWidth;
            currentEntry.height = nextHeight;
            delete currentEntry.scaleX;
            delete currentEntry.scaleY;
            break;
          case "circle":
            currentEntry.radius = Math.max(10, Math.max(nextWidth, nextHeight) / 2);
            break;
          case "ellipse":
            currentEntry.radiusX = Math.max(10, nextWidth / 2);
            currentEntry.radiusY = Math.max(10, nextHeight / 2);
            break;
          case "line":
            currentEntry.x2 = (dragState.startMetrics.x2 ?? dragState.startMetrics.centerX) + deltaX;
            currentEntry.y2 = (dragState.startMetrics.y2 ?? dragState.startMetrics.centerY) + deltaY;
            break;
          case "polyline":
          case "polygon":
            currentEntry.width = nextWidth;
            currentEntry.height = nextHeight;
            break;
          case "path":
            currentEntry.scaleX = Math.max(
              0.2,
              dragState.startScaleX * (nextWidth / Math.max(1, dragState.startSize.width)),
            );
            currentEntry.scaleY = Math.max(
              0.2,
              dragState.startScaleY * (nextHeight / Math.max(1, dragState.startSize.height)),
            );
            break;
        }
        next[dragState.targetId] = currentEntry;
        return next;
      });
      return;
    }

    if (dragState.mode === "rotate-layer") {
      const angle = Math.atan2(point.y - dragState.center.y, point.x - dragState.center.x);
      const nextRotation = dragState.startRotation + ((angle - dragState.startAngle) * 180) / Math.PI;
      setAmendments((current) => ({
        ...current,
        [dragState.targetId]: {
          ...current[dragState.targetId],
          rotation: Number(nextRotation.toFixed(1)),
        },
      }));
    }
  }

  function clearDragState(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const finishedDrag = dragState;
    setDragState(null);
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }

    if (finishedDrag.mode !== "move-layer" || !baseViewBox) return;

    const generatedObjectBoxIds = new Set(
      generatedElements.filter((element) => element.type === "objectBox").map((element) => element.id),
    );
    if (!finishedDrag.targetIds.some((id) => generatedObjectBoxIds.has(id))) return;

    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;

    const deltaX = point.x - finishedDrag.startPoint.x;
    const deltaY = point.y - finishedDrag.startPoint.y;
    const nextAmendments = { ...amendments };
    for (const id of finishedDrag.targetIds) {
      nextAmendments[id] = {
        ...nextAmendments[id],
        translateX: finishedDrag.startTranslations[id].x + deltaX,
        translateY: finishedDrag.startTranslations[id].y + deltaY,
      };
    }

    const layout = runObjectBoxLayout(generatedElements, nextAmendments);
    setAmendments(layout.amendments);
    setGeneratedElements(layout.generatedElements);
  }

  function applyCanvasWheel(deltaX: number, deltaY: number, clientX: number, clientY: number, isZoomGesture: boolean) {
    if (isZoomGesture) {
      applyZoom(deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR, clientX, clientY);
      return;
    }

    const scale = getViewportScale();
    if (!camera || !scale) return;

    setCamera({
      ...camera,
      x: camera.x + deltaX / scale,
      y: camera.y + deltaY / scale,
    });
  }

  function canInspectorConsumeWheel(element: HTMLDivElement, deltaX: number, deltaY: number) {
    const dominantAxis = Math.abs(deltaY) >= Math.abs(deltaX) ? "y" : "x";

    if (dominantAxis === "y") {
      if (element.scrollHeight <= element.clientHeight + 1) return false;
      if (deltaY < 0) return element.scrollTop > 1;
      if (deltaY > 0) {
        return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
      }
      return false;
    }

    if (element.scrollWidth <= element.clientWidth + 1) return false;
    if (deltaX < 0) return element.scrollLeft > 1;
    if (deltaX > 0) {
      return element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    }
    return false;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    applyCanvasWheel(event.deltaX, event.deltaY, event.clientX, event.clientY, event.ctrlKey);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (inspectorRef.current?.contains(event.target as Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      applyCanvasWheel(event.deltaX, event.deltaY, event.clientX, event.clientY, event.ctrlKey);
    };

    canvas.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleNativeWheel);
    };
  }, [camera, baseViewBox]);

  useEffect(() => {
    const inspector = inspectorRef.current;
    if (!inspector) return;

    const handleInspectorWheel = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        applyCanvasWheel(event.deltaX, event.deltaY, event.clientX, event.clientY, true);
        return;
      }

      if (canInspectorConsumeWheel(inspector, event.deltaX, event.deltaY)) {
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyCanvasWheel(event.deltaX, event.deltaY, event.clientX, event.clientY, false);
    };

    inspector.addEventListener("wheel", handleInspectorWheel, { passive: false });
    return () => {
      inspector.removeEventListener("wheel", handleInspectorWheel);
    };
  }, [inspectorOpen, camera, baseViewBox]);

  function addElement(type: FloorplanShapeType) {
    if (!baseViewBox) return;
    captureHistory();
    const centerX = camera ? camera.x + camera.width / 2 : baseViewBox.x + baseViewBox.width / 2;
    const centerY = camera ? camera.y + camera.height / 2 : baseViewBox.y + baseViewBox.height / 2;
    const element = createDefaultElement(type, centerX, centerY, baseViewBox, svgText);
    setGeneratedElements((current) => [...current, element]);
    setSingleSelection(element.id);
    setSelectedGroupId(null);
    setInspectorOpen(true);
  }

  function removeGeneratedElement() {
    if (!generatedElement) return;
    captureHistory();
    setGeneratedElements((current) => current.filter((element) => element.id !== generatedElement.id));
    setAmendments((current) => {
      const next = { ...current };
      delete next[generatedElement.id];
      return next;
    });
    setGroups((current) =>
      current
        .map((group) => ({
          ...group,
          memberIds: group.memberIds.filter((id) => id !== generatedElement.id),
        }))
        .filter((group) => group.memberIds.length > 0)
    );
    if (selectedGroupId && selectedGroup?.memberIds.includes(generatedElement.id)) {
      setSelectedGroupId(null);
    }
    const fallbackId = layerOptions.find((layer) => layer.id !== generatedElement.id)?.id ?? null;
    setSingleSelection(fallbackId);
    setInspectorOpen(false);
  }

  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const defaultTextFontSize =
    baseViewBox && svgText ? String(inferTextFontSize(baseViewBox, svgText)) : "15";
  const selectedTextNode =
    selectedId && selectedLayer?.isText && canvasRef.current
      ? canvasRef.current.querySelector<SVGTextElement>(`[data-fs-node-id="${selectedId}"]`)
      : null;
  const selectedTextRect = selectedTextNode?.getBoundingClientRect() ?? null;
  const selectedTextStyle = selectedTextNode ? window.getComputedStyle(selectedTextNode) : null;
  const selectedTextFontSize =
    textEditState?.id === selectedId
      ? textEditState.fontSize
      : selectedTextStyle
        ? resolveTextOverlayFontSize(
            selectedTextNode?.getAttribute("font-size") ?? selectedAmendment.fontSize,
            selectedTextStyle.fontSize,
          )
        : selectedAmendment.fontSize ?? generatedElement?.fontSize?.toString() ?? defaultTextFontSize;
  const selectedTextFontFamily =
    textEditState?.id === selectedId
      ? textEditState.fontFamily
      : selectedTextStyle?.fontFamily ??
        selectedAmendment.fontFamily ??
        generatedElement?.fontFamily ??
        "Arial, sans-serif";
  const selectedTextFontWeight =
    textEditState?.id === selectedId
      ? textEditState.fontWeight
      : selectedTextStyle?.fontWeight ??
        selectedAmendment.fontWeight ??
        generatedElement?.fontWeight ??
        "400";
  const selectedTextFontStyle =
    textEditState?.id === selectedId
      ? textEditState.fontStyle
      : selectedTextStyle?.fontStyle ??
        selectedAmendment.fontStyle ??
        generatedElement?.fontStyle ??
        "normal";
  const selectedTextFill =
    textEditState?.id === selectedId
      ? textEditState.color
      : selectedTextStyle?.fill ??
        selectedAmendment.fill ??
        generatedElement?.fill ??
        "#0f172a";
  const selectedTranslationX = selectedId ? amendments[selectedId]?.translateX ?? 0 : 0;
  const selectedTranslationY = selectedId ? amendments[selectedId]?.translateY ?? 0 : 0;
  const textOverlayRect =
    textEditState?.id === selectedId && textEditState.rect
      ? textEditState.rect
      : selectedTextRect && canvasRect
        ? {
            left: selectedTextRect.left - canvasRect.left,
            top: selectedTextRect.top - canvasRect.top,
            width: selectedTextRect.width,
            height: selectedTextRect.height,
          }
        : null;
  const textEditorRect =
    textOverlayRect
      ? {
          left: textOverlayRect.left,
          top: textOverlayRect.top,
          width: Math.max(textOverlayRect.width + 4, 24),
          height: Math.max(textOverlayRect.height + 4, 20),
        }
      : null;
  const selectedNodeBounds =
    selectedId && canvasRef.current
      ? (() => {
          const node = canvasRef.current.querySelector<SVGGraphicsElement>(`[data-fs-node-id="${selectedId}"]`);
          return node ? getScreenBounds(node) : null;
        })()
      : null;
  const overlayRect =
    selectedNodeBounds && canvasRect
      ? {
          left: selectedNodeBounds.left - canvasRect.left - 4,
          top: selectedNodeBounds.top - canvasRect.top - 4,
          width: selectedNodeBounds.width + 8,
          height: selectedNodeBounds.height + 8,
          centerX: selectedNodeBounds.left - canvasRect.left + selectedNodeBounds.width / 2,
          centerClientX: selectedNodeBounds.centerClientX,
          centerClientY: selectedNodeBounds.centerClientY,
        }
      : null;

  function beginResizeHandle(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!selectedId || !activeMetrics) return;
    event.preventDefault();
    event.stopPropagation();
    captureHistory();
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDragState({
      mode: "resize-layer",
      pointerId: event.pointerId,
      targetId: selectedId,
      targetTag: activeMetrics.tagName,
      targetIsGenerated: Boolean(selectedLayer?.isGenerated),
      startScaleX: selectedAmendment.scaleX ?? 1,
      startScaleY: selectedAmendment.scaleY ?? 1,
      startPoint: point,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startMetrics: JSON.parse(JSON.stringify(activeMetrics)),
      startSize: { width: activeMetrics.width, height: activeMetrics.height },
    });
    canvas.setPointerCapture(event.pointerId);
  }

  function beginRotateHandle(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!selectedId || !activeMetrics) return;
    event.preventDefault();
    event.stopPropagation();
    captureHistory();
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    const centerPoint =
      overlayRect ? getSvgPoint(overlayRect.centerClientX, overlayRect.centerClientY) : null;
    const center = centerPoint ?? {
      x: activeMetrics.centerX + selectedTranslationX,
      y: activeMetrics.centerY + selectedTranslationY,
    };
    const startAngle = Math.atan2(point.y - center.y, point.x - center.x);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDragState({
      mode: "rotate-layer",
      pointerId: event.pointerId,
      startAngle,
      center,
      startRotation: amendments[selectedId]?.rotation ?? generatedElement?.rotation ?? 0,
      targetId: selectedId,
    });
    canvas.setPointerCapture(event.pointerId);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-primary" />
            <p className="font-semibold text-foreground">Floorplan editor (Annex A &amp; E)</p>
            <Badge
              variant={enabled ? "secondary" : "outline"}
              className={enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
            >
              {enabled ? "Included in report" : "Select Annex A to attach"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Draw on the canvas or import Apple RoomPlan JSON (.json) or SVG (.svg).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            id="floorplan-layout-upload"
            type="file"
            accept=".json,.svg,application/json,image/svg+xml"
            className="hidden"
            onChange={handleImportChange}
          />
          <input
            ref={imageInputRef}
            id="floorplan-image-upload"
            type="file"
            accept=".png,image/png"
            className="hidden"
            onChange={handleImageImportChange}
          />
          <input
            ref={libraryImageInputRef}
            id="floorplan-library-image-upload"
            type="file"
            accept=".png,image/png"
            className="hidden"
            onChange={handleLibraryImageImportChange}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import layout plan
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => imageInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload PNG element
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => libraryImageInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Add PNG to my library
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenDraftsDialog}
            disabled={!draftsEnabled}
            title={
              draftsEnabled
                ? "Save or load floorplan drafts for this incident"
                : "Set an incident number to use drafts"
            }
          >
            <FileStack className="mr-2 h-4 w-4" />
            Drafts
            {loadedDraftName ? (
              <Badge variant="secondary" className="ml-2 max-w-[140px] truncate">
                {loadedDraftName}
              </Badge>
            ) : null}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={replaceDialogOpen}
        onOpenChange={(open) => {
          setReplaceDialogOpen(open);
          if (!open) pendingFileRef.current = null;
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current floorplan?</AlertDialogTitle>
            <AlertDialogDescription>
              Unsaved edits will be lost. Import the new layout plan anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplace}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={draftsDialogOpen} onOpenChange={setDraftsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Floorplan drafts</DialogTitle>
            <DialogDescription>
              Drafts for incident <span className="font-medium text-foreground">{trimmedIncidentNo || "—"}</span>.
              {loadedDraftName ? ` Currently editing "${loadedDraftName}".` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border bg-slate-50/70 p-3">
              <Label htmlFor="floorplan-draft-name" className="text-sm font-medium">
                Save current canvas as a new draft
              </Label>
              <div className="flex gap-2">
                <Input
                  id="floorplan-draft-name"
                  value={draftNameInput}
                  placeholder="Draft name"
                  disabled={savingDraft}
                  onChange={(event) => setDraftNameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveNewDraft();
                    }
                  }}
                />
                <Button type="button" onClick={() => void handleSaveNewDraft()} disabled={savingDraft}>
                  {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save as new
                </Button>
              </div>
              {loadedDraftId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleOverwriteDraft()}
                  disabled={savingDraft}
                >
                  {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Overwrite "{loadedDraftName}"
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Saved drafts</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void refreshDrafts()}
                  disabled={draftsLoading}
                >
                  {draftsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh
                </Button>
              </div>

              {draftsError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {draftsError}
                </p>
              ) : null}

              {draftsLoading && drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading drafts…</p>
              ) : drafts.length === 0 && !draftsError ? (
                <p className="text-sm text-muted-foreground">
                  No drafts saved for this incident yet.
                </p>
              ) : (
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-border bg-white p-2",
                        draft.id === loadedDraftId ? "border-primary/50 ring-1 ring-primary/30" : "",
                      )}
                    >
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {draft.thumbnail ? (
                          <img src={draft.thumbnail} alt={draft.name} className="max-h-full max-w-full object-contain" />
                        ) : (
                          <Map className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground" title={draft.name}>
                          {draft.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {new Date(draft.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRequestLoadDraft(draft.id)}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Load
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-red-600 hover:text-red-700"
                        onClick={() => setPendingDeleteDraftId(draft.id)}
                        title={`Delete ${draft.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraftsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingLoadDraftId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLoadDraftId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Unsaved edits on the current canvas will be lost. Load the selected draft anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmLoadDraft()}>Load draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteDraftId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteDraftId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleConfirmDeleteDraft()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {uploadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {uploadError}
        </p>
      )}

      <div className="rounded-2xl border border-border bg-slate-50/70 px-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="png-libraries" className="border-b-0">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-4 text-left">
                <div>
                  <p className="font-medium text-foreground">PNG element libraries</p>
                  <p className="text-sm text-muted-foreground">
                    Shared PNGs are developer-managed for all users. Personal PNGs are stored in this browser only.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{SHARED_FLOORPLAN_PNG_LIBRARY.length} shared</Badge>
                  <Badge variant="outline">{pngLibrary.length} personal</Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Shared library</p>
                    <p className="text-xs text-muted-foreground">Developer-managed only</p>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Developers add shared PNGs in [src/app/constants/floorplanPngLibrary.ts](/C:/Users/lawyu/SCDF-x-DELL-FireSight-AI/src/app/constants/floorplanPngLibrary.ts) and store the PNG files under `src/assets/floorplan-library/`.
                  </p>
                  {SHARED_FLOORPLAN_PNG_LIBRARY.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {SHARED_FLOORPLAN_PNG_LIBRARY.map((item) => (
                        <div
                          key={item.id}
                          className="group flex w-[160px] flex-col rounded-xl border border-border bg-white p-3 shadow-sm"
                        >
                          <button
                            type="button"
                            className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            onClick={() => placeLibraryImage(item)}
                            title={`Place ${item.name}`}
                          >
                            <img src={item.dataUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                          </button>
                          <button
                            type="button"
                            className="mt-2 min-w-0 text-left text-sm font-medium text-foreground hover:text-primary"
                            onClick={() => placeLibraryImage(item)}
                            title={item.name}
                          >
                            <span className="block truncate">{item.name}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No shared PNG elements yet. Add them to the repo so every user gets the same library.
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">My library</p>
                    <p className="text-xs text-muted-foreground">User-managed in this browser</p>
                  </div>
                  {pngLibrary.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {pngLibrary.map((item) => (
                        <div
                          key={item.id}
                          className="group flex w-[160px] flex-col rounded-xl border border-border bg-white p-3 shadow-sm"
                        >
                          <button
                            type="button"
                            className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            onClick={() => placeLibraryImage(item)}
                            title={`Place ${item.name}`}
                          >
                            <img src={item.dataUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                          </button>
                          <div className="mt-2 flex items-start justify-between gap-2">
                            <button
                              type="button"
                              className="min-w-0 text-left text-sm font-medium text-foreground hover:text-primary"
                              onClick={() => placeLibraryImage(item)}
                              title={item.name}
                            >
                              <span className="block truncate">{item.name}</span>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => removeLibraryImage(item.id)}
                              title={`Remove ${item.name}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No personal PNG elements yet. Use <span className="font-medium">Add PNG to my library</span> to save some here.
                    </p>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedId ?? undefined}
              onValueChange={(value) => {
                setSingleSelection(value);
                setInspectorOpen(true);
              }}
            >
              <SelectTrigger className="w-[260px] bg-white">
                <SelectValue placeholder="Select layer" />
              </SelectTrigger>
              <SelectContent>
                {layerOptions.map((layer) => (
                  <SelectItem key={layer.id} value={layer.id}>
                    {layer.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedGroupId ?? "none"}
              onValueChange={(value) => setSelectedGroupId(value === "none" ? null : value)}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="outline">{amendmentCount} edits</Badge>
            <Badge variant="outline">{selectedIds.length} selected</Badge>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                captureHistory();
                setShowGrid((current) => !current);
              }}
            >
              <Grid3X3 className="h-4 w-4" />
              {showGrid ? "Grid off" : "Grid on"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled>
              <Group className="h-4 w-4" />
              Shift-click multi-select
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={createGroupFromSelection} disabled={selectedIds.length < 2}>
              <Group className="h-4 w-4" />
              Group selection
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={ungroupSelectedGroup} disabled={!selectedGroupId}>
              <Ungroup className="h-4 w-4" />
              Ungroup
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={undoLastChange} disabled={history.length === 0}>
              <History className="h-4 w-4" />
              Undo
            </Button>

            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant={editorMode === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setEditorMode("select")}
              >
                <MousePointer2 className="h-4 w-4" />
                Select
              </Button>
              <Select value={objectBoxShape} onValueChange={(value) => setObjectBoxShape(value as ObjectBoxShape)}>
                <SelectTrigger className="w-[140px] bg-white">
                  <SelectValue placeholder="Shape" />
                </SelectTrigger>
                <SelectContent>
                  {OBJECT_BOX_SHAPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={editorMode === "placeObjectBox" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setEditorMode((current) => (current === "placeObjectBox" ? "select" : "placeObjectBox"))
                }
              >
                <Box className="h-4 w-4" />
                Object box
              </Button>
              <Select value={lineStyle} onValueChange={(value) => setLineStyle(value as FloorplanLineStyle)}>
                <SelectTrigger className="w-[150px] bg-white">
                  <SelectValue placeholder="Line style" />
                </SelectTrigger>
                <SelectContent>
                  {FLOORPLAN_LINE_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={editorMode === "placeLine" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setLineDraft(null);
                  setEditorMode((current) => (current === "placeLine" ? "select" : "placeLine"));
                }}
              >
                <Slash className="h-4 w-4" />
                Line
              </Button>
              <Button
                type="button"
                variant={editorMode === "placeText" ? "default" : "outline"}
                size="sm"
                onClick={() => setEditorMode((current) => (current === "placeText" ? "select" : "placeText"))}
              >
                <Type className="h-4 w-4" />
                Text
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyZoom(ZOOM_IN_FACTOR)}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyZoom(ZOOM_OUT_FACTOR)}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetCamera}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {editorMode === "placeLine" && (
            <p className="text-sm text-muted-foreground">
              {lineDraft
                ? "Click again to set the end of the line. Press Esc to cancel."
                : "Click once to set the start of the line, then click again to set the end."}
            </p>
          )}

          <div className="flex flex-col gap-4">
            <div
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onDoubleClick={handleCanvasDoubleClick}
              onPointerMove={handlePointerMove}
              onPointerUp={clearDragState}
              onPointerLeave={clearDragState}
              onWheel={handleWheel}
              className={cn(
                "relative flex-1 min-w-0 min-h-[280px] h-[min(480px,50vh)] max-h-[50vh] overflow-hidden rounded-2xl border border-border bg-white overscroll-contain touch-none",
                editorMode === "placeObjectBox" || editorMode === "placeText" || editorMode === "placeLine"
                  ? "cursor-crosshair"
                  : dragState?.mode === "pan"
                    ? "cursor-grabbing"
                    : "cursor-grab",
                (editorMode === "placeObjectBox" || editorMode === "placeText" || editorMode === "placeLine") && "ring-2 ring-sky-200",
              )}
            >
            {showGrid && (
              <div
                className="pointer-events-none absolute inset-0 z-0"
                style={gridStyle}
              />
            )}
            {canvasSvg && (
              <div
                className="relative z-10 h-full w-full"
                dangerouslySetInnerHTML={{ __html: canvasSvg }}
              />
            )}
            {overlayRect && activeMetrics && selectedId && (
              <>
                <div
                  className="pointer-events-none absolute z-20 border-2 border-sky-500"
                  style={{
                    left: overlayRect.left,
                    top: overlayRect.top,
                    width: overlayRect.width,
                    height: overlayRect.height,
                  }}
                />
                <button
                  type="button"
                  className="absolute z-30 h-4 w-4 rounded-full border-2 border-sky-500 bg-white"
                  style={{
                    left: overlayRect.left + overlayRect.width - 8,
                    top: overlayRect.top + overlayRect.height - 8,
                  }}
                  onPointerDown={beginResizeHandle}
                  aria-label="Resize shape"
                />
                <button
                  type="button"
                  className="absolute z-30 flex h-8 w-8 items-center justify-center rounded-full border-2 border-sky-500 bg-white"
                  style={{
                    left: overlayRect.centerX - 16,
                    top: overlayRect.top - 42,
                  }}
                  onPointerDown={beginRotateHandle}
                  aria-label="Rotate shape"
                >
                  <RotateCw className="h-4 w-4 text-sky-600" />
                </button>
              </>
            )}
            {textEditState && selectedLayer?.isText && textEditorRect && (
              <div
                className="absolute z-40 pointer-events-auto bg-transparent"
                style={{
                  left: textEditorRect.left,
                  top: textEditorRect.top,
                  width: textEditorRect.width,
                  height: textEditorRect.height,
                  minWidth: textEditorRect.width,
                  minHeight: textEditorRect.height,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <textarea
                  ref={textEditRef}
                  value={textEditState.value}
                  rows={1}
                  wrap="off"
                  className="block h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 shadow-none outline-none"
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "100%",
                    margin: 0,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    fontFamily: selectedTextFontFamily,
                    fontSize: selectedTextFontSize ? `${selectedTextFontSize}px` : `${defaultTextFontSize}px`,
                    fontWeight: selectedTextFontWeight,
                    fontStyle: selectedTextFontStyle,
                    lineHeight: selectedTextFontSize ? `${selectedTextFontSize}px` : `${defaultTextFontSize}px`,
                    letterSpacing:
                      textEditState?.id === selectedId
                        ? textEditState.letterSpacing
                        : selectedTextStyle?.letterSpacing ?? "normal",
                    color: "transparent",
                    caretColor: selectedTextFill,
                    transform: "none",
                    whiteSpace: "pre",
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateTextEditValue(event.target.value)}
                  onBlur={(event) => {
                    if (textEditCommittingRef.current) return;
                    commitTextEdit(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      finishTextEdit(textEditState.value);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      finishTextEdit(textEditState.value);
                    }
                  }}
                />
              </div>
            )}

            {inspectorOpen && selectedLayer && (
              <div
                ref={inspectorRef}
                className="absolute bottom-3 right-3 z-30 w-[min(18rem,calc(100%-1.5rem))] max-h-[min(20rem,40vh)] overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-white/96 p-3 shadow-lg backdrop-blur"
                data-fs-wheel-scope="inspector"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <FloorplanInspectorPanel
                  selectedLayer={selectedLayer}
                  selectedAmendment={selectedAmendment}
                  selectedTextValue={selectedTextValue}
                  generatedElement={generatedElement}
                  defaultTextFontSize={defaultTextFontSize}
                  isShapeSelection={isShapeSelection}
                  isRectSelection={isRectSelection}
                  isObjectBoxSelection={isObjectBoxSelection}
                  selectedGroup={selectedGroup}
                  showCloseButton
                  onClose={() => setInspectorOpen(false)}
                  updateSelectedAmendment={updateSelectedAmendment}
                  setGeneratedElements={setGeneratedElements}
                  updateGeneratedElementWithoutHistory={updateGeneratedElementWithoutHistory}
                  setSelectedGroupId={setSelectedGroupId}
                  removeGeneratedElement={removeGeneratedElement}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
