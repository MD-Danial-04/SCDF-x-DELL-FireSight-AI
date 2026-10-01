import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  fitDocxPreviewToWidth,
  observeDocxPreviewFit,
  scheduleDocxPreviewFit,
  type FitDocxPreviewElements,
} from "../lib/fitDocxPreviewToViewport";
import { usePreviewPinchZoom } from "./usePreviewPinchZoom";

interface UseDocxPreviewFitWithZoomOptions {
  active: boolean;
  resetKey: unknown;
}

export function useDocxPreviewFitWithZoom(
  getElements: () => FitDocxPreviewElements | null,
  viewportRef: RefObject<HTMLDivElement | null>,
  { active, resetKey }: UseDocxPreviewFitWithZoomOptions,
) {
  const getZoomRef = useRef(() => 1);

  const refit = useCallback(() => {
    const elements = getElements();
    if (elements) fitDocxPreviewToWidth(elements, getZoomRef.current());
  }, [getElements]);

  const zoom = usePreviewPinchZoom(viewportRef, refit, {
    enabled: active,
    resetKey,
  });

  getZoomRef.current = zoom.getZoom;

  const scheduleFit = useCallback(() => {
    const elements = getElements();
    if (elements) scheduleDocxPreviewFit(elements, zoom.getZoom());
  }, [getElements, zoom.getZoom]);

  useEffect(() => {
    if (!active) return;
    const elements = getElements();
    if (!elements) return;
    return observeDocxPreviewFit(elements, zoom.getZoom);
  }, [active, getElements, resetKey, zoom.getZoom]);

  return { scheduleFit, ...zoom };
}
