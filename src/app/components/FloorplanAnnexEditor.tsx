import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import {
  Grid3X3,
  Group,
  History,
  Loader2,
  Map,
  RotateCw,
  Search,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "./ui/utils";
import {
  createBlankFloorplan,
  getFloorplanElementMetrics,
  parseFloorplan,
  renderFloorplanSvg,
  type FloorplanAmendment,
  type FloorplanElementMetrics,
  type FloorplanGeneratedElement,
  type FloorplanLayer,
  type FloorplanPoint,
  type FloorplanShapeType,
  type FloorplanViewBox,
} from "../lib/floorplanEditor";
import { convertRoomPlanFile } from "../lib/importRoomPlanFloorplan";
import { svgStringToAnnexTemplatePngBlob } from "../lib/svgToAnnexPng";
import { FloorplanInspectorPanel } from "./FloorplanInspectorPanel";

const BLANK_FLOORPLAN = createBlankFloorplan();

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
      startPoint: { x: number; y: number };
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
    };

interface FloorplanAnnexEditorProps {
  enabled: boolean;
  incidentNo?: string;
  locationOfFire?: string;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
  onFloorplanSvgChange?: (svg: string | null) => void;
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

const ZOOM_IN_FACTOR = 0.88;
const ZOOM_OUT_FACTOR = 1.14;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function placeCaretAtEnd(element: HTMLElement) {
  if (!(element instanceof HTMLTextAreaElement)) return;
  const length = element.value.length;
  element.setSelectionRange(length, length);
}

function getTextEditSnapshot(node: SVGTextElement, canvas: HTMLDivElement, value: string): TextEditState {
  const textRect = node.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const computed = window.getComputedStyle(node);

  return {
    id: node.dataset.fsNodeId ?? "",
    value,
    rect: {
      left: textRect.left - canvasRect.left,
      top: textRect.top - canvasRect.top,
      width: textRect.width,
      height: textRect.height,
    },
    fontFamily: node.getAttribute("font-family") ?? computed.fontFamily ?? "Arial, sans-serif",
    fontSize: node.getAttribute("font-size") ?? computed.fontSize ?? "28",
    fontWeight: node.getAttribute("font-weight") ?? computed.fontWeight ?? "400",
    fontStyle: node.getAttribute("font-style") ?? computed.fontStyle ?? "normal",
    letterSpacing: computed.letterSpacing ?? "normal",
    color: node.getAttribute("fill") ?? computed.fill ?? "#0f172a",
  };
}

function getNodeHit(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-fs-node-id]");
}

function getScreenBounds(node: SVGGraphicsElement) {
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

function createDefaultElement(type: FloorplanShapeType, x: number, y: number): FloorplanGeneratedElement {
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

function getBoundsForGenerated(element: FloorplanGeneratedElement) {
  switch (element.type) {
    case "text": {
      const width = (element.textContent?.length ?? 6) * 16;
      return { width, height: 28, centerX: element.x, centerY: element.y - 14 };
    }
    case "rect":
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const textEditRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

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
    const canvasAmendments =
      textEditState
        ? {
            ...amendments,
            [textEditState.id]: {
              ...amendments[textEditState.id],
              hidden: true,
            },
          }
        : amendments;
    return renderFloorplanSvg({
      svgText,
      amendments: canvasAmendments,
      camera,
      selectedId,
      generatedElements,
    });
  }, [amendments, camera, generatedElements, selectedId, svgText, textEditState]);

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
  const selectedSize = generatedElement ? getBoundsForGenerated(generatedElement) : null;
  const nativeMetrics =
    selectedId && svgText && selectedLayer && !selectedLayer.isGenerated
      ? getFloorplanElementMetrics(svgText, selectedId)
      : null;
  const activeMetrics = generatedElement
    ? {
        tagName: generatedElement.type,
        width: selectedSize?.width ?? 0,
        height: selectedSize?.height ?? 0,
        centerX: selectedSize?.centerX ?? generatedElement.x,
        centerY: selectedSize?.centerY ?? generatedElement.y,
        x: generatedElement.x,
        y: generatedElement.y,
        x2: generatedElement.x2,
        y2: generatedElement.y2,
        radius: generatedElement.radius,
        radiusX: generatedElement.radiusX,
        radiusY: generatedElement.radiusY,
      }
    : nativeMetrics;
  const amendmentCount = Object.keys(amendments).length + generatedElements.length + groups.length;
  const isRectSelection = selectedLayer?.tagName === "rect";
  const isShapeSelection = Boolean(selectedLayer && !selectedLayer.isText);
  const containingGroup = selectedId ? groups.find((group) => group.memberIds.includes(selectedId)) ?? null : null;
  const selectedTextValue =
    selectedLayer?.isText
      ? textEditState?.id === selectedId
        ? textEditState.value
        : selectedAmendment.textContent ?? generatedElement?.textContent ?? selectedLayer.textContent ?? selectedLayer.label
      : null;

  useEffect(() => {
    if (!textEditState || !textEditRef.current) return;
    textEditRef.current.value = textEditState.value;
    textEditRef.current.style.height = "auto";
    textEditRef.current.style.height = `${textEditRef.current.scrollHeight}px`;
    textEditRef.current.focus();
    placeCaretAtEnd(textEditRef.current);
  }, [textEditState]);

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

    window.addEventListener("keydown", handleUndoShortcut);
    window.addEventListener("keydown", handleArrowNudge);
    window.addEventListener("keydown", handleGroupShortcut);
    window.addEventListener("keydown", handleDeleteShortcut);
    return () => {
      window.removeEventListener("keydown", handleUndoShortcut);
      window.removeEventListener("keydown", handleArrowNudge);
      window.removeEventListener("keydown", handleGroupShortcut);
      window.removeEventListener("keydown", handleDeleteShortcut);
    };
  }, [history.length, selectedId, amendments, generatedElements, groups, selectedGroupId, selectedIds, showGrid]);

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
    if (layerId !== textEditState?.id) {
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

  function loadFloorplan(rawSvg: string, nextFileName: string) {
    const parsed = parseFloorplan(rawSvg);
    setSvgText(parsed.svgText);
    setLayers(parsed.layers);
    setBaseViewBox(parsed.baseViewBox);
    setCamera(parsed.baseViewBox);
    setSingleSelection(parsed.layers[0]?.id ?? null);
    setSelectedGroupId(null);
    setGroups([]);
    setAmendments({});
    setGeneratedElements([]);
    setFileName(nextFileName);
    setUploadError(null);
    setInspectorOpen(false);
    setHistory([]);
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
      loadFloorplan(rawSvg, name);
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

  function getSvgPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: camera.x + ((clientX - rect.left) / rect.width) * camera.width,
      y: camera.y + ((clientY - rect.top) / rect.height) * camera.height,
    };
  }

  function applyZoom(factor: number, clientX?: number, clientY?: number) {
    const canvas = canvasRef.current;
    if (!canvas || !baseViewBox || !camera) return;
    const rect = canvas.getBoundingClientRect();
    const centerX = clientX ?? rect.left + rect.width / 2;
    const centerY = clientY ?? rect.top + rect.height / 2;
    const ratioX = clamp((centerX - rect.left) / rect.width, 0, 1);
    const ratioY = clamp((centerY - rect.top) / rect.height, 0, 1);

    setCamera((current) => {
      if (!current) return current;
      const minWidth = baseViewBox.width * 0.2;
      const maxWidth = baseViewBox.width * 2.5;
      const nextWidth = clamp(current.width * factor, minWidth, maxWidth);
      const nextHeight = (nextWidth / current.width) * current.height;
      const anchorX = current.x + ratioX * current.width;
      const anchorY = current.y + ratioY * current.height;
      return {
        x: anchorX - ratioX * nextWidth,
        y: anchorY - ratioY * nextHeight,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

  function resetCamera() {
    if (baseViewBox) setCamera(baseViewBox);
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

    const hit = getNodeHit(event.target);
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
    const hit = getNodeHit(event.target);
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
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (dragState.mode === "pan") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const deltaX = ((event.clientX - dragState.startX) / rect.width) * dragState.startCamera.width;
      const deltaY = ((event.clientY - dragState.startY) / rect.height) * dragState.startCamera.height;
      setCamera({
        ...dragState.startCamera,
        x: dragState.startCamera.x - deltaX,
        y: dragState.startCamera.y - deltaY,
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
      const nextWidth = Math.max(20, dragState.startSize.width + deltaX);
      const nextHeight = Math.max(20, dragState.startSize.height + deltaY);
      setAmendments((current) => {
        const next = { ...current };
        const currentEntry = { ...next[dragState.targetId] };
        switch (dragState.targetTag) {
          case "rect":
            currentEntry.width = nextWidth;
            currentEntry.height = nextHeight;
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
            currentEntry.scaleX = Math.max(0.2, nextWidth / Math.max(1, dragState.startSize.width));
            currentEntry.scaleY = Math.max(0.2, nextHeight / Math.max(1, dragState.startSize.height));
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
    setDragState(null);
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    applyZoom(event.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR, event.clientX, event.clientY);
  }

  function addElement(type: FloorplanShapeType) {
    if (!baseViewBox) return;
    captureHistory();
    const centerX = camera ? camera.x + camera.width / 2 : baseViewBox.x + baseViewBox.width / 2;
    const centerY = camera ? camera.y + camera.height / 2 : baseViewBox.y + baseViewBox.height / 2;
    const element = createDefaultElement(type, centerX, centerY);
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
  const selectedTextNode =
    selectedId && selectedLayer?.isText && canvasRef.current && textEditState?.id !== selectedId
      ? canvasRef.current.querySelector<SVGTextElement>(`[data-fs-node-id="${selectedId}"]`)
      : null;
  const selectedTextRect = selectedTextNode?.getBoundingClientRect() ?? null;
  const selectedTextStyle = selectedTextNode ? window.getComputedStyle(selectedTextNode) : null;
  const selectedTextFontSize =
    textEditState?.id === selectedId
      ? textEditState.fontSize
      : selectedTextNode?.getAttribute("font-size") ??
    selectedAmendment.fontSize ??
    (selectedTextStyle?.fontSize ? Number.parseFloat(selectedTextStyle.fontSize).toString() : null);
  const selectedTextFontFamily =
    textEditState?.id === selectedId
      ? textEditState.fontFamily
      : selectedTextNode?.getAttribute("font-family") ??
    selectedAmendment.fontFamily ??
    generatedElement?.fontFamily ??
    selectedTextStyle?.fontFamily ??
    "Arial, sans-serif";
  const selectedTextFontWeight =
    textEditState?.id === selectedId
      ? textEditState.fontWeight
      : selectedTextNode?.getAttribute("font-weight") ??
    selectedAmendment.fontWeight ??
    generatedElement?.fontWeight ??
    selectedTextStyle?.fontWeight ??
    "400";
  const selectedTextFontStyle =
    textEditState?.id === selectedId
      ? textEditState.fontStyle
      : selectedTextNode?.getAttribute("font-style") ??
    selectedAmendment.fontStyle ??
    generatedElement?.fontStyle ??
    selectedTextStyle?.fontStyle ??
    "normal";
  const selectedTextFill =
    textEditState?.id === selectedId
      ? textEditState.color
      : selectedTextNode?.getAttribute("fill") ??
    selectedAmendment.fill ??
    generatedElement?.fill ??
    selectedTextStyle?.fill ??
    "#0f172a";
  const selectedTranslationX = selectedId ? amendments[selectedId]?.translateX ?? 0 : 0;
  const selectedTranslationY = selectedId ? amendments[selectedId]?.translateY ?? 0 : 0;
  const textOverlayRect =
    textEditState?.id === selectedId
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
          left: textOverlayRect.left - 2,
          top: textOverlayRect.top - 2,
          width: Math.max(140, textOverlayRect.width + 12),
          height: Math.max(36, textOverlayRect.height + 8),
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
      startPoint: point,
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

      {uploadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {uploadError}
        </p>
      )}

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
              <Button type="button" variant="outline" size="sm" onClick={() => addElement("text")}>
                <Type className="h-4 w-4" />
                Text
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addElement("rect")}>
                Rectangle
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addElement("circle")}>
                Circle
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addElement("ellipse")}>
                Ellipse
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addElement("line")}>
                Line
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addElement("polyline")}>
                Polyline
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addElement("polygon")}>
                Polygon
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

          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onDoubleClick={handleCanvasDoubleClick}
              onPointerMove={handlePointerMove}
              onPointerUp={clearDragState}
              onPointerLeave={clearDragState}
              onWheel={handleWheel}
              onWheelCapture={handleWheel}
              className={cn(
                "relative flex-1 min-w-0 min-h-[280px] h-[min(480px,50vh)] max-h-[50vh] overflow-hidden rounded-2xl border border-border bg-white overscroll-contain touch-none",
                dragState?.mode === "pan" ? "cursor-grabbing" : "cursor-grab",
              )}
            >
            {showGrid && (
              <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[size:32px_32px]" />
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
                className="absolute z-40 pointer-events-auto"
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
                    resize: "none",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    fontFamily: selectedTextFontFamily,
                    fontSize: selectedTextFontSize ? `${selectedTextFontSize}px` : "28px",
                    fontWeight: selectedTextFontWeight,
                    fontStyle: selectedTextFontStyle,
                    lineHeight: selectedTextFontSize ? `${selectedTextFontSize}px` : "28px",
                    letterSpacing:
                      textEditState?.id === selectedId
                        ? textEditState.letterSpacing
                        : selectedTextStyle?.letterSpacing ?? "normal",
                    color: selectedTextFill,
                    transform: "none",
                    whiteSpace: "pre",
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateTextEditValue(event.target.value)}
                  onBlur={(event) => commitTextEdit(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      commitTextEdit(textEditState.value);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setTextEditState(null);
                    }
                  }}
                />
              </div>
            )}

            <div
              className={cn(
                "absolute inset-x-4 bottom-4 z-20 rounded-2xl border border-border bg-white/96 shadow-xl backdrop-blur transition-transform duration-200 lg:hidden",
                inspectorOpen && selectedLayer ? "translate-y-0" : "translate-y-[120%]"
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {selectedLayer && (
                <div className="max-h-[40vh] overflow-y-auto p-4">
                  <FloorplanInspectorPanel
                    selectedLayer={selectedLayer}
                    selectedAmendment={selectedAmendment}
                    selectedTextValue={selectedTextValue}
                    generatedElement={generatedElement}
                    isShapeSelection={isShapeSelection}
                    isRectSelection={isRectSelection}
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

          <aside className="hidden lg:flex lg:w-80 lg:shrink-0 flex-col rounded-2xl border border-border bg-white overflow-hidden">
            <div className="overflow-y-auto flex-1 max-h-[min(480px,50vh)] p-4">
              {selectedLayer ? (
                <FloorplanInspectorPanel
                  selectedLayer={selectedLayer}
                  selectedAmendment={selectedAmendment}
                  selectedTextValue={selectedTextValue}
                  generatedElement={generatedElement}
                  isShapeSelection={isShapeSelection}
                  isRectSelection={isRectSelection}
                  selectedGroup={selectedGroup}
                  updateSelectedAmendment={updateSelectedAmendment}
                  setGeneratedElements={setGeneratedElements}
                  updateGeneratedElementWithoutHistory={updateGeneratedElementWithoutHistory}
                  setSelectedGroupId={setSelectedGroupId}
                  removeGeneratedElement={removeGeneratedElement}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Select a layer to edit properties.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
