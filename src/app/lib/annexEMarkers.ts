export interface AnnexEMarker {
  id: string;
  cx: number;
  cy: number;
  tipX: number;
  tipY: number;
  /** Stable reference to a photo-log entry id; number/UID are derived from the live log. */
  photoId: string | null;
}

/** Marker enriched with the resolved photo number for rendering. */
export interface RenderMarker extends AnnexEMarker {
  photoNumber?: number | null;
}

export interface AnnexEViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ANNEX_E_MARKER_COLOR = "#38bdf8";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MarkerScale {
  radius: number;
  strokeWidth: number;
  fontSize: number;
  arrowHeadLength: number;
  arrowHeadWidth: number;
  defaultArrowLength: number;
  hitRadius: number;
  tipHitRadius: number;
  arrowLineHitThreshold: number;
}

export function computeMarkerScale(viewBox: AnnexEViewBox): MarkerScale {
  const minDim = Math.min(viewBox.width, viewBox.height);
  return {
    radius: minDim * 0.032,
    strokeWidth: minDim * 0.004,
    fontSize: minDim * 0.032,
    arrowHeadLength: minDim * 0.025,
    arrowHeadWidth: minDim * 0.014,
    defaultArrowLength: minDim * 0.12,
    hitRadius: minDim * 0.05,
    tipHitRadius: minDim * 0.038,
    arrowLineHitThreshold: minDim * 0.018,
  };
}

export interface ArrowGeometry {
  lineStartX: number;
  lineStartY: number;
  lineEndX: number;
  lineEndY: number;
  headPoints: string;
}

export function getArrowShaftLength(arrow: ArrowGeometry): number {
  return Math.hypot(arrow.lineEndX - arrow.lineStartX, arrow.lineEndY - arrow.lineStartY);
}

export function buildArrowGeometry(
  cx: number,
  cy: number,
  tipX: number,
  tipY: number,
  radius: number,
  headLength: number,
  headWidth: number,
): ArrowGeometry {
  const dx = tipX - cx;
  const dy = tipY - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    const lineStartX = cx + radius;
    const lineStartY = cy;
    return {
      lineStartX,
      lineStartY,
      lineEndX: lineStartX,
      lineEndY: lineStartY,
      headPoints: "",
    };
  }

  const ux = dx / len;
  const uy = dy / len;
  const outwardLen = Math.max(0, len - radius);
  const lineStartX = cx + ux * radius;
  const lineStartY = cy + uy * radius;

  if (outwardLen < 1e-6) {
    return {
      lineStartX,
      lineStartY,
      lineEndX: lineStartX,
      lineEndY: lineStartY,
      headPoints: "",
    };
  }

  const desiredMinShaftLen = Math.max(headLength * 0.2, headWidth * 0.5);
  const minShaftLen = Math.min(desiredMinShaftLen, outwardLen * 0.4);
  const effectiveHeadLength = Math.min(headLength, Math.max(0, outwardLen - minShaftLen));
  const headScale = headLength > 0 ? effectiveHeadLength / headLength : 0;
  const effectiveHeadWidth = headWidth * headScale;
  const backX = tipX - ux * effectiveHeadLength;
  const backY = tipY - uy * effectiveHeadLength;
  const px = -uy;
  const py = ux;

  return {
    lineStartX,
    lineStartY,
    lineEndX: backX,
    lineEndY: backY,
    headPoints:
      effectiveHeadLength > 0
        ? `${tipX},${tipY} ${backX + px * effectiveHeadWidth},${backY + py * effectiveHeadWidth} ${backX - px * effectiveHeadWidth},${backY - py * effectiveHeadWidth}`
        : "",
  };
}

export function getMarkerLength(marker: Pick<AnnexEMarker, "cx" | "cy" | "tipX" | "tipY">): number {
  return Math.hypot(marker.tipX - marker.cx, marker.tipY - marker.cy);
}

/** 0 = right, increases clockwise on screen (SVG y-down). */
export function getMarkerAngleDeg(marker: Pick<AnnexEMarker, "cx" | "cy" | "tipX" | "tipY">): number {
  const angleRad = Math.atan2(marker.tipY - marker.cy, marker.tipX - marker.cx);
  const deg = (angleRad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function setMarkerTipFromAngleLength(
  marker: Pick<AnnexEMarker, "cx" | "cy">,
  angleDeg: number,
  length: number,
): { tipX: number; tipY: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    tipX: marker.cx + length * Math.cos(angleRad),
    tipY: marker.cy + length * Math.sin(angleRad),
  };
}

export function getMarkerLengthBounds(viewBox: AnnexEViewBox): { min: number; max: number } {
  const scale = computeMarkerScale(viewBox);
  const minDim = Math.min(viewBox.width, viewBox.height);
  return {
    min: scale.radius + scale.arrowHeadLength * 1.2,
    max: minDim * 0.4,
  };
}

export function clampMarkerTip(
  marker: Pick<AnnexEMarker, "cx" | "cy">,
  tipX: number,
  tipY: number,
  viewBox: AnnexEViewBox,
): { tipX: number; tipY: number } {
  const bounds = getMarkerLengthBounds(viewBox);
  const length = getMarkerLength({ cx: marker.cx, cy: marker.cy, tipX, tipY });
  const clampedLength = Math.min(bounds.max, Math.max(bounds.min, length));
  const angleDeg = getMarkerAngleDeg({ cx: marker.cx, cy: marker.cy, tipX, tipY });
  return setMarkerTipFromAngleLength(marker, angleDeg, clampedLength);
}

export function createDefaultMarker(
  cx: number,
  cy: number,
  viewBox: AnnexEViewBox,
): AnnexEMarker {
  const { defaultArrowLength } = computeMarkerScale(viewBox);
  return {
    id: `marker-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    cx,
    cy,
    tipX: cx + defaultArrowLength,
    tipY: cy,
    photoId: null,
  };
}

export function buildMarkersSvgFragment(
  markers: RenderMarker[],
  viewBox: AnnexEViewBox,
): string {
  if (markers.length === 0) return "";

  const scale = computeMarkerScale(viewBox);
  const parts = markers.map((marker) => {
    const arrow = buildArrowGeometry(
      marker.cx,
      marker.cy,
      marker.tipX,
      marker.tipY,
      scale.radius,
      scale.arrowHeadLength,
      scale.arrowHeadWidth,
    );
    const label = marker.photoNumber != null ? String(marker.photoNumber) : "?";

    return [
      `<g data-annex-e-marker="${escapeXml(marker.id)}">`,
      `<circle cx="${marker.cx}" cy="${marker.cy}" r="${scale.radius}" fill="none" stroke="${ANNEX_E_MARKER_COLOR}" stroke-width="${scale.strokeWidth}" />`,
      `<line x1="${arrow.lineStartX}" y1="${arrow.lineStartY}" x2="${arrow.lineEndX}" y2="${arrow.lineEndY}" stroke="${ANNEX_E_MARKER_COLOR}" stroke-width="${scale.strokeWidth}" stroke-linecap="round" />`,
      arrow.headPoints
        ? `<polygon points="${arrow.headPoints}" fill="${ANNEX_E_MARKER_COLOR}" stroke="none" />`
        : "",
      `<text x="${marker.cx}" y="${marker.cy}" fill="${ANNEX_E_MARKER_COLOR}" font-family="Arial, sans-serif" font-size="${scale.fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`,
      `</g>`,
    ].join("");
  });

  return `<g data-annex-e-markers="true">${parts.join("")}</g>`;
}

export function injectMarkersIntoSvg(floorplanSvg: string, fragment: string): string {
  if (!fragment) return floorplanSvg;
  const closingIndex = floorplanSvg.lastIndexOf("</svg>");
  if (closingIndex === -1) return floorplanSvg;
  return `${floorplanSvg.slice(0, closingIndex)}${fragment}${floorplanSvg.slice(closingIndex)}`;
}

export function buildAnnotatedFloorplanSvg(
  floorplanSvg: string,
  markers: RenderMarker[],
  viewBox: AnnexEViewBox,
): string {
  const fragment = buildMarkersSvgFragment(markers, viewBox);
  return injectMarkersIntoSvg(floorplanSvg, fragment);
}

export function parseViewBoxFromSvg(svg: string): AnnexEViewBox | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/i);
  if (!match) return null;
  const parts = match[1].trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

export function extractSvgInnerContent(svg: string): string {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return match?.[1]?.replace(/<g data-annex-e-markers="true">[\s\S]*?<\/g>/g, "") ?? "";
}

function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export type MarkerHitPart = "body" | "arrow";

export interface MarkerHitResult {
  marker: AnnexEMarker;
  hit: MarkerHitPart;
}

/** Distance from a point to the arrow line segment (from circle edge to tip). */
export function distanceToArrowSegment(
  point: { x: number; y: number },
  marker: AnnexEMarker,
  scale: MarkerScale,
): number {
  const arrow = buildArrowGeometry(
    marker.cx,
    marker.cy,
    marker.tipX,
    marker.tipY,
    scale.radius,
    scale.arrowHeadLength,
    scale.arrowHeadWidth,
  );
  return distancePointToSegment(
    point.x,
    point.y,
    arrow.lineStartX,
    arrow.lineStartY,
    arrow.lineEndX,
    arrow.lineEndY,
  );
}

export function findMarkerHitAtPoint(
  point: { x: number; y: number },
  markers: AnnexEMarker[],
  viewBox: AnnexEViewBox,
): MarkerHitResult | null {
  const scale = computeMarkerScale(viewBox);

  for (let index = markers.length - 1; index >= 0; index -= 1) {
    const marker = markers[index];

    const tipDistance = Math.hypot(point.x - marker.tipX, point.y - marker.tipY);
    if (tipDistance <= scale.tipHitRadius) {
      return { marker, hit: "arrow" };
    }

    const arrowDistance = distanceToArrowSegment(point, marker, scale);
    if (arrowDistance <= scale.arrowLineHitThreshold) {
      return { marker, hit: "arrow" };
    }

    const centerDistance = Math.hypot(point.x - marker.cx, point.y - marker.cy);
    if (centerDistance <= scale.hitRadius) {
      return { marker, hit: "body" };
    }
  }

  return null;
}
