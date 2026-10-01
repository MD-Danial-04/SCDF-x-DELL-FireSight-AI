import type { RefObject } from "react";
import { Loader2 } from "lucide-react";

interface DocxPreviewSurfaceProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  scalerRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  isRendering: boolean;
  error?: string | null;
}

/**
 * Shared docx-preview render surface used by the statement and PRR/Fire report
 * previews so they stay visually identical: an error banner, a spinner loading
 * state, and the 3-layer viewport/scaler/host scaled by the fit helpers.
 */
export function DocxPreviewSurface({
  viewportRef,
  scalerRef,
  hostRef,
  isRendering,
  error,
}: DocxPreviewSurfaceProps) {
  return (
    <>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {isRendering && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Rendering preview…
        </p>
      )}

      <div
        ref={viewportRef}
        className="docx-preview-viewport overflow-auto border rounded-xl bg-muted/40 p-3 h-[min(70vh,720px)]"
      >
        <div ref={scalerRef} className="docx-preview-scaler mx-auto">
          <div ref={hostRef} className="docx-preview-host bg-white" />
        </div>
      </div>
    </>
  );
}
