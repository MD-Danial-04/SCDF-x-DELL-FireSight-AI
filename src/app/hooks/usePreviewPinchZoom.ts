import { useCallback, useEffect, useRef, type RefObject } from "react";

const DEFAULT_MIN_ZOOM = 1;
const DEFAULT_MAX_ZOOM = 3;

interface UsePreviewPinchZoomOptions {
  enabled?: boolean;
  minZoom?: number;
  maxZoom?: number;
  /** When this value changes the zoom resets to the minimum. */
  resetKey?: unknown;
}

function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const [a, b] = [touches[0]!, touches[1]!];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Pinch-to-zoom (touch) and ctrl/meta + wheel (trackpad pinch) for preview panels.
 * Returns a stable getter for the current zoom multiplier.
 */
export function usePreviewPinchZoom(
  viewportRef: RefObject<HTMLElement | null>,
  onZoomChange: () => void,
  {
    enabled = true,
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
    resetKey,
  }: UsePreviewPinchZoomOptions = {},
) {
  const zoomRef = useRef(minZoom);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const getZoom = useCallback(() => zoomRef.current, []);

  const applyZoom = useCallback(
    (next: number) => {
      const clamped = Math.min(maxZoom, Math.max(minZoom, next));
      if (clamped === zoomRef.current) return;
      zoomRef.current = clamped;
      onZoomChangeRef.current();
    },
    [minZoom, maxZoom],
  );

  useEffect(() => {
    zoomRef.current = minZoom;
    onZoomChangeRef.current();
  }, [minZoom, resetKey]);

  useEffect(() => {
    if (!enabled) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = -event.deltaY * 0.01;
      applyZoom(zoomRef.current * (1 + delta));
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinchStartRef.current = {
          dist: getTouchDistance(event.touches),
          zoom: zoomRef.current,
        };
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && pinchStartRef.current) {
        event.preventDefault();
        const dist = getTouchDistance(event.touches);
        const { dist: startDist, zoom: startZoom } = pinchStartRef.current;
        if (startDist > 0) {
          applyZoom(startZoom * (dist / startDist));
        }
      }
    };

    const clearPinch = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchStartRef.current = null;
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", clearPinch);
    viewport.addEventListener("touchcancel", clearPinch);

    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", clearPinch);
      viewport.removeEventListener("touchcancel", clearPinch);
    };
  }, [applyZoom, enabled, viewportRef]);

  const resetZoom = useCallback(() => {
    applyZoom(minZoom);
  }, [applyZoom, minZoom]);

  return { getZoom, resetZoom };
}
