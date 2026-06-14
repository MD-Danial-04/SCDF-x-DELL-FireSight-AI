/** Annex A slide dimensions (matches page-0.png and AnnexPageEditor). */
export const ANNEX_A_WIDTH = 719;
export const ANNEX_A_HEIGHT = 1058;
export const ANNEX_A_RENDER_SCALE = 2;

/**
 * Fixed floorplan slot on the Annex A template — centered on the page, sized to
 * sit in the main sketch area above the SKETCH/LEGEND footer row.
 */
export const ANNEX_A_FLOORPLAN_FRAME = {
  width: 580,
  height: 510,
  /** Nudge up from geometric page center to balance header vs footer chrome. */
  centerYOffset: -28,
} as const;

export interface SketchRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fixed frame rectangle in template coordinates (scaled for export). */
export function getAnnexAFloorplanFrameRect(scale = 1): SketchRect {
  const { width, height, centerYOffset } = ANNEX_A_FLOORPLAN_FRAME;
  return {
    x: ((ANNEX_A_WIDTH - width) / 2) * scale,
    y: ((ANNEX_A_HEIGHT - height) / 2 + centerYOffset) * scale,
    width: width * scale,
    height: height * scale,
  };
}

/** Uniformly scale floorplan content to fill the fixed frame (contain-fit). */
export function computeFloorplanFrameFillRect(
  contentWidth: number,
  contentHeight: number,
  scale = 1,
): SketchRect {
  const frame = getAnnexAFloorplanFrameRect(scale);
  if (contentWidth <= 0 || contentHeight <= 0) {
    return frame;
  }

  const fitScale = Math.min(frame.width / contentWidth, frame.height / contentHeight);
  const width = contentWidth * fitScale;
  const height = contentHeight * fitScale;
  return {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  };
}
