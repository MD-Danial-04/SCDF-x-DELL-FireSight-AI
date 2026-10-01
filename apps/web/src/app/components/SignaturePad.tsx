import { useCallback, useEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useIsMobile } from "./ui/use-mobile";
import { cn } from "./ui/utils";

const INLINE_CANVAS_HEIGHT = 160;

interface SignatureCanvasProps {
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  fillContainer?: boolean;
  className?: string;
  /** Wider strokes for finger input on touch devices. */
  touchInput?: boolean;
}

function SignatureCanvas({
  value,
  onChange,
  height = INLINE_CANVAS_HEIGHT,
  fillContainer = false,
  className,
  touchInput = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);
  const valueRef = useRef(value);
  const lineWidth = touchInput ? 3.5 : 2.2;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const paintBackground = useCallback(
    (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    },
    []
  );

  const drawStoredValue = useCallback(
    (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dataUrl: string) => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        paintBackground(canvas, ctx);
        ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      };
      img.src = dataUrl;
    },
    [paintBackground]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth || canvas.offsetWidth || 320;
      const cssHeight = fillContainer
        ? canvas.parentElement?.clientHeight || height
        : height;

      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBackground(canvas, ctx);

      const stored = valueRef.current;
      if (stored) {
        drawStoredValue(canvas, ctx, stored);
      }
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    if (fillContainer && canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }
    return () => observer.disconnect();
  }, [drawStoredValue, fillContainer, height, paintBackground]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    paintBackground(canvas, ctx);
    if (value) {
      drawStoredValue(canvas, ctx, value);
    }
  }, [value, drawStoredValue, paintBackground]);

  const getPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const strokeTo = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const drawDot = (ctx: CanvasRenderingContext2D, point: { x: number; y: number }) => {
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = getPoint(event.clientX, event.clientY);
    if (!point) return;
    drawingRef.current = true;
    lastPointRef.current = point;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      drawDot(ctx, point);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const coalesced =
      typeof event.nativeEvent.getCoalescedEvents === "function"
        ? event.nativeEvent.getCoalescedEvents()
        : [event.nativeEvent];

    for (const nativeEvent of coalesced) {
      const point = getPoint(nativeEvent.clientX, nativeEvent.clientY);
      const lastPoint = lastPointRef.current;
      if (!point || !lastPoint) continue;
      strokeTo(ctx, lastPoint, point);
      lastPointRef.current = point;
      dirtyRef.current = true;
    }
  };

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore release errors.
    }
    if (dirtyRef.current) {
      dirtyRef.current = false;
      exportCanvas();
    }
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch") return;
    finishDrawing(event);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ height: fillContainer ? "100%" : height, touchAction: "none" }}
      className={cn(
        "block w-full rounded-md border border-gray-300 bg-white cursor-crosshair select-none touch-none",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrawing}
      onPointerCancel={finishDrawing}
      onPointerLeave={handlePointerLeave}
    />
  );
}

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  className?: string;
}

export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [prefersTouchInput, setPrefersTouchInput] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const sync = () => setPrefersTouchInput(coarse.matches);
    sync();
    coarse.addEventListener("change", sync);
    return () => coarse.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      setDraftValue(value);
    }
  }, [dialogOpen, value]);

  const useFullscreenPad = isMobile || prefersTouchInput;

  const handleOpenDialog = () => {
    setDraftValue(value);
    setDialogOpen(true);
  };

  const handleSaveDialog = () => {
    onChange(draftValue);
    setDialogOpen(false);
  };

  const handleClearDraft = () => {
    setDraftValue("");
  };

  if (useFullscreenPad) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="overflow-hidden rounded-md border border-gray-300 bg-white">
          {value ? (
            <img
              src={value}
              alt="Captured signature"
              className="block max-h-36 w-full object-contain bg-white p-2"
            />
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No signature yet. Tap below to sign with your finger.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="flex-1" onClick={handleOpenDialog}>
            <PenLine className="mr-2 h-4 w-4" />
            {value ? "Edit signature" : "Sign with finger"}
          </Button>
          {value ? (
            <Button type="button" variant="outline" onClick={() => onChange("")}>
              Clear
            </Button>
          ) : null}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            showCloseButton={false}
            className="top-0 left-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
          >
            <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-2 border-b border-border bg-background px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-left">
              <DialogTitle>Sign statement</DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogClose>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <p className="text-sm text-muted-foreground">
                Use your finger to sign in the box below. Your strokes are captured as you draw.
              </p>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-300 bg-white p-2 shadow-inner min-h-[50vh]">
                <SignatureCanvas
                  value={draftValue}
                  onChange={setDraftValue}
                  fillContainer
                  touchInput
                  className="min-h-0 flex-1 border-0"
                />
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:justify-between">
              <Button type="button" variant="outline" onClick={handleClearDraft}>
                Clear signature
              </Button>
              <Button type="button" onClick={handleSaveDialog}>
                Save signature
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <SignatureCanvas
        value={value}
        onChange={onChange}
        height={INLINE_CANVAS_HEIGHT}
        className="max-w-md"
      />
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
          Clear signature
        </Button>
      </div>
    </div>
  );
}
