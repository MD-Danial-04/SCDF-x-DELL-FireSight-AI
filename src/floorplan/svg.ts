import { distance2D } from "./matrix";
import { pointOnArc } from "./project";
import type { Arc2D, Point2D, Segment2D, WallPrimitive2D } from "./types";

export interface SvgBounds {
  minX: number;
  minZ: number;
  width: number;
  height: number;
}

function collectPoints(primitives: WallPrimitive2D[]): Point2D[] {
  const points: Point2D[] = [];
  for (const p of primitives) {
    if (p.kind === "segment") {
      points.push(p.start, p.end);
    } else {
      points.push(
        pointOnArc(p, 0),
        pointOnArc(p, 1),
        {
          x: p.center.x + p.radius * Math.cos(p.startAngle),
          z: p.center.z + p.radius * Math.sin(p.startAngle),
        },
        {
          x: p.center.x + p.radius * Math.cos(p.endAngle),
          z: p.center.z + p.radius * Math.sin(p.endAngle),
        },
      );
    }
  }
  return points;
}

export function computeBounds(
  primitives: WallPrimitive2D[],
  paddingM: number,
): SvgBounds {
  const points = collectPoints(primitives);
  if (points.length === 0) {
    return { minX: -paddingM, minZ: -paddingM, width: paddingM * 2, height: paddingM * 2 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  return {
    minX: minX - paddingM,
    minZ: minZ - paddingM,
    width: maxX - minX + paddingM * 2,
    height: maxZ - minZ + paddingM * 2,
  };
}

function arcSweepPositive(arc: Arc2D): number {
  let sweep = arc.endAngle - arc.startAngle;
  while (sweep < 0) sweep += 2 * Math.PI;
  while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  return sweep;
}

function segmentToSvg(seg: Segment2D): string {
  return `<line x1="${fmt(seg.start.x)}" y1="${fmt(seg.start.z)}" x2="${fmt(seg.end.x)}" y2="${fmt(seg.end.z)}" />`;
}

function arcToSvg(arc: Arc2D): string {
  const start = pointOnArc(arc, 0);
  const end = pointOnArc(arc, 1);
  const sweep = arcSweepPositive(arc);
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `<path d="M ${fmt(start.x)} ${fmt(start.z)} A ${fmt(arc.radius)} ${fmt(arc.radius)} 0 ${largeArc} 1 ${fmt(end.x)} ${fmt(end.z)}" />`;
}

function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}

export interface SvgOptions {
  strokeWidthM: number;
  paddingM: number;
}

export function buildSvg(
  primitives: WallPrimitive2D[],
  options: SvgOptions,
): string {
  const bounds = computeBounds(primitives, options.paddingM);
  const { minX, minZ, width, height } = bounds;

  const shapes = primitives
    .map((p) => (p.kind === "segment" ? segmentToSvg(p) : arcToSvg(p)))
    .join("\n    ");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(minX)} ${fmt(minZ)} ${fmt(width)} ${fmt(height)}" width="${fmt(width)}" height="${fmt(height)}">`,
    `  <rect x="${fmt(minX)}" y="${fmt(minZ)}" width="${fmt(width)}" height="${fmt(height)}" fill="#ffffff" />`,
    `  <g fill="none" stroke="#000000" stroke-width="${fmt(options.strokeWidthM)}" stroke-linecap="square">`,
    `    ${shapes}`,
    `  </g>`,
    `</svg>`,
  ].join("\n");
}

export function normalizeSvgForSnapshot(svg: string): string {
  return svg.replace(/\d+\.\d+/g, (m) => Number(Number(m).toFixed(2)).toString());
}

export { distance2D as _distance2DForTests };
