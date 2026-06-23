import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Brush, Eraser, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "./ui/utils";
import {
  ANNEX_G_FIELD_BOXES,
  ANNEX_G_TEMPLATE_HEIGHT,
  ANNEX_G_TEMPLATE_WIDTH,
  buildAnnexGBaseTemplateCanvas,
  drawAnnexGFieldValues,
  type AnnexGBurnChartFields,
} from "../lib/annexGBurnChartTemplate";
import { ANNEX_G_PAGE_INDEX } from "../lib/annexHeaderOverlay";
import { getDefaultPagePreviewUrl } from "../lib/annexImageAssets";

const DEFAULT_SHADE = "rgba(128, 128, 128, 0.78)";

type ToolMode = "paint" | "erase";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  mode: ToolMode;
  points: Point[];
  size: number;
}

interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnnexGBurnChartEditorProps {
  enabled: boolean;
  incidentNo?: string;
  locationOfFire?: string;
  nameOfVictim?: string;
  nricFinNumber?: string;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load Annex G source image"));
    img.src = url;
  });
}

function encodeCanvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to encode Annex G export"));
      },
      "image/png",
    );
  });
}

function computeContainFitRect(
  contentWidth: number,
  contentHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): FitRect {
  const scale = Math.min(canvasWidth / contentWidth, canvasHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
) {
  const strokeScale = Math.min(width, height);

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    ctx.save();
    ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.mode === "erase" ? "rgba(0,0,0,1)" : DEFAULT_SHADE;
    ctx.fillStyle = stroke.mode === "erase" ? "rgba(0,0,0,1)" : DEFAULT_SHADE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size * strokeScale;

    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      ctx.beginPath();
      ctx.arc(
        point.x * width,
        point.y * height,
        (stroke.size * strokeScale) / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    for (let index = 1; index < stroke.points.length; index += 1) {
      ctx.lineTo(stroke.points[index].x * width, stroke.points[index].y * height);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function buildCompositeCanvas(
  baseTemplate: HTMLCanvasElement,
  fields: AnnexGBurnChartFields,
  strokes: Stroke[],
) {
  const composite = document.createElement("canvas");
  composite.width = ANNEX_G_TEMPLATE_WIDTH;
  composite.height = ANNEX_G_TEMPLATE_HEIGHT;
  const ctx = composite.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(baseTemplate, 0, 0);
  drawAnnexGFieldValues(ctx, composite.width, composite.height, fields);
  drawStrokes(ctx, strokes, composite.width, composite.height);

  return composite;
}

export function AnnexGBurnChartEditor({
  enabled,
  incidentNo = "",
  locationOfFire = "",
  nameOfVictim = "",
  nricFinNumber = "",
  onOverrideChange,
}: AnnexGBurnChartEditorProps) {
  const sourceUrl = getDefaultPagePreviewUrl(ANNEX_G_PAGE_INDEX);
  const [tool, setTool] = useState<ToolMode>("paint");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [fields, setFields] = useState<AnnexGBurnChartFields>({
    incidentNo,
    locationOfFire,
    nameOfVictim,
    nricFinNumber,
  });
  const [baseTemplateUrl, setBaseTemplateUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseTemplateRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const fitRectRef = useRef<FitRect | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  strokesRef.current = strokes;

  useEffect(() => {
    setFields({
      incidentNo,
      locationOfFire,
      nameOfVictim,
      nricFinNumber,
    });
  }, [incidentNo, locationOfFire, nameOfVictim, nricFinNumber]);

  useEffect(() => {
    if (!sourceUrl) {
      setError("Annex G source image is missing.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void loadImage(sourceUrl)
      .then((sourceImage) => {
        if (cancelled) return;
        const baseTemplate = buildAnnexGBaseTemplateCanvas(sourceImage);
        if (!baseTemplate) throw new Error("Canvas not supported");
        baseTemplateRef.current = baseTemplate;
        setBaseTemplateUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(baseTemplateToBlob(baseTemplate));
        });
        setIsLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to prepare Annex G template.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (baseTemplateUrl) URL.revokeObjectURL(baseTemplateUrl);
    };
  }, [baseTemplateUrl]);

  const schedulePaintRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;

      const wrapper = wrapperRef.current;
      const canvas = canvasRef.current;
      if (!wrapper || !canvas) return;

      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const fit = computeContainFitRect(ANNEX_G_TEMPLATE_WIDTH, ANNEX_G_TEMPLATE_HEIGHT, width, height);
      fitRectRef.current = fit;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const previewStrokes = activeStrokeRef.current
        ? [...strokesRef.current, activeStrokeRef.current]
        : strokesRef.current;

      ctx.save();
      ctx.translate(fit.x, fit.y);
      ctx.scale(fit.width, fit.height);
      drawStrokes(ctx, previewStrokes, 1, 1);
      ctx.restore();
    });
  }, []);

  useEffect(() => {
    schedulePaintRender();
  }, [schedulePaintRender, strokes, tool]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => schedulePaintRender());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [schedulePaintRender]);

  useEffect(() => {
    if (!enabled || !baseTemplateRef.current) {
      onOverrideChange(ANNEX_G_PAGE_INDEX, null);
      return;
    }

    let cancelled = false;
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => {
      const baseTemplate = baseTemplateRef.current;
      if (!baseTemplate) return;

      const composite = buildCompositeCanvas(baseTemplate, fields, strokesRef.current);
      if (!composite) {
        setError("Canvas not supported");
        return;
      }

      void encodeCanvasPng(composite)
        .then((blob) => {
          if (!cancelled) onOverrideChange(ANNEX_G_PAGE_INDEX, blob);
        })
        .catch((exportError) => {
          if (!cancelled) {
            setError(exportError instanceof Error ? exportError.message : "Unable to export Annex G.");
          }
        });
    }, 120);

    return () => {
      cancelled = true;
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, [enabled, fields, onOverrideChange, strokes]);

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

      if (strokesRef.current.length === 0) return;
      event.preventDefault();
      setStrokes((current) => current.slice(0, -1));
    }

    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, []);

  function updateField(key: keyof AnnexGBurnChartFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function clientPointToNormalized(event: ReactPointerEvent<HTMLCanvasElement>): Point | null {
    const fit = fitRectRef.current;
    const canvas = canvasRef.current;
    if (!fit || !canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    if (x < fit.x || y < fit.y || x > fit.x + fit.width || y > fit.y + fit.height) return null;

    return {
      x: (x - fit.x) / fit.width,
      y: (y - fit.y) / fit.height,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!enabled || isLoading) return;
    const point = clientPointToNormalized(event);
    if (!point) return;

    activeStrokeRef.current = {
      id: `stroke-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      mode: tool,
      size: tool === "paint" ? 0.028 : 0.032,
      points: [point],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    schedulePaintRender();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return;
    const point = clientPointToNormalized(event);
    if (!point) return;
    activeStrokeRef.current = {
      ...activeStrokeRef.current,
      points: [...activeStrokeRef.current.points, point],
    };
    schedulePaintRender();
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((current) => [...current, stroke]);
  }

  const fieldInputs = useMemo(
    () =>
      (Object.keys(ANNEX_G_FIELD_BOXES) as Array<keyof AnnexGBurnChartFields>).map((key) => {
        const box = ANNEX_G_FIELD_BOXES[key];
        return {
          key,
          box,
          value: fields[key],
        };
      }),
    [fields],
  );

  return (
    <div className="space-y-4 rounded-xl border border-border bg-slate-50/70 p-4">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-foreground">Annex G burn-chart editor</p>
        <Badge
          variant={enabled ? "secondary" : "outline"}
          className={enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
        >
          {enabled ? "Included in report" : "Select Annex G to attach"}
        </Badge>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={tool === "paint" ? "default" : "outline"} size="sm" onClick={() => setTool("paint")}>
          <Brush className="mr-2 h-4 w-4" />
          Paint
        </Button>
        <Button type="button" variant={tool === "erase" ? "default" : "outline"} size="sm" onClick={() => setTool("erase")}>
          <Eraser className="mr-2 h-4 w-4" />
          Erase
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={strokes.length === 0} onClick={() => setStrokes((current) => current.slice(0, -1))}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Undo
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={strokes.length === 0} onClick={() => setStrokes([])}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>

      <div
        ref={wrapperRef}
        className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-white"
        style={{
          aspectRatio: `${ANNEX_G_TEMPLATE_WIDTH} / ${ANNEX_G_TEMPLATE_HEIGHT}`,
          containerType: "size",
        }}
      >
        {baseTemplateUrl && (
          <img
            src={baseTemplateUrl}
            alt="Annex G template"
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}

        {fieldInputs.map(({ key, box, value }) => (
          <Input
            key={key}
            value={value}
            onChange={(event) => updateField(key, event.target.value)}
            className="absolute h-auto border-0 bg-transparent px-1 py-0 text-black shadow-none focus-visible:ring-0"
            style={{
              left: `${(box.x / ANNEX_G_TEMPLATE_WIDTH) * 100}%`,
              top: `${(box.y / ANNEX_G_TEMPLATE_HEIGHT) * 100}%`,
              width: `${(box.width / ANNEX_G_TEMPLATE_WIDTH) * 100}%`,
              height: `${(box.height / ANNEX_G_TEMPLATE_HEIGHT) * 100}%`,
              fontSize: `${(box.fontSize / ANNEX_G_TEMPLATE_WIDTH) * 100}cqw`,
            }}
          />
        ))}

        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full touch-none",
            enabled ? "cursor-crosshair" : "cursor-not-allowed opacity-80",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

function baseTemplateToBlob(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL("image/png");
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}
