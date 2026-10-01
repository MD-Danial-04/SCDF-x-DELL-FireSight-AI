/** Supplied section slide dimensions, normalized to a 720 x 1040 page. */
export const ANNEX_A_WIDTH = 720;
export const ANNEX_A_HEIGHT = 1040;
export const ANNEX_A_RENDER_SCALE = 2;

/**
 * Main sketch frame shared by Sections 1, 2, 3, and 5.
 */
export const ANNEX_A_FLOORPLAN_FRAME = {
  width: 658,
  height: 892,
  centerYOffset: 24,
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
