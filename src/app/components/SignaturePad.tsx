import { useCallback, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

const CANVAS_HEIGHT = 160;

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  className?: string;
}

export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);
  const valueRef = useRef(value);

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

  // Size the backing store to the displayed size * devicePixelRatio so strokes
  // stay crisp and pointer coordinates map 1:1 to what the user touches.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth || canvas.offsetWidth || 320;
      const cssHeight = CANVAS_HEIGHT;

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
    return () => observer.disconnect();
  }, [drawStoredValue, paintBackground]);

  // Redraw when the value prop changes from outside (e.g. clearing).
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

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = getPoint(event);
    if (!point) return;
    drawingRef.current = true;
    lastPointRef.current = point;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; ignore unsupported environments.
    }

    // Draw a dot so a tap still leaves a visible mark.
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getPoint(event);
    const lastPoint = lastPointRef.current;
    if (!canvas || !ctx || !point || !lastPoint) return;

    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    dirtyRef.current = true;
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

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    paintBackground(canvas, ctx);
    dirtyRef.current = false;
    onChange("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <canvas
        ref={canvasRef}
        style={{ height: CANVAS_HEIGHT, touchAction: "none" }}
        className="block w-full max-w-md rounded-md border border-gray-300 bg-white cursor-crosshair select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
        onPointerLeave={finishDrawing}
      />
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Clear signature
        </Button>
      </div>
    </div>
  );
}
