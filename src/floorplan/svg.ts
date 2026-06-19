import type { OpeningMarker } from "./openingMarkers";
import type { ObjectBox2D } from "./objects";
import { objectBoxCorners, objectBoxToSvg } from "./objects";
import { escapeSvgText } from "./roomLabel";
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

function collectMarkerPoints(markers: OpeningMarker[]): Point2D[] {
  return markers.flatMap((marker) => marker.points);
}

function collectObjectPoints(objects: ObjectBox2D[]): Point2D[] {
  return objects.flatMap((object) => objectBoxCorners(object));
}

export function computeBounds(
  primitives: WallPrimitive2D[],
  paddingM: number,
  openingMarkers: OpeningMarker[] = [],
  objects: ObjectBox2D[] = [],
): SvgBounds {
  const points = [
    ...collectPoints(primitives),
    ...collectMarkerPoints(openingMarkers),
    ...collectObjectPoints(objects),
  ];
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
  openingMarkers?: OpeningMarker[];
  openingStrokeWidthM?: number;
  roomLabel?: {
    text: string;
    center: Point2D;
    fontSizeM: number;
  };
  objects?: ObjectBox2D[];
}

export function buildSvg(
  primitives: WallPrimitive2D[],
  options: SvgOptions,
): string {
  const openingMarkers = options.openingMarkers ?? [];
  const objects = options.objects ?? [];
  const bounds = computeBounds(
    primitives,
    options.paddingM,
    openingMarkers,
    objects,
  );
  const { minX, minZ, width, height } = bounds;

  const wallShapes = primitives
    .map((p) => (p.kind === "segment" ? segmentToSvg(p) : arcToSvg(p)))
    .join("\n    ");

  const openingShapes = openingMarkers.map((marker) => marker.svg).join("\n    ");
  const openingStrokeWidth = fmt(options.openingStrokeWidthM ?? options.strokeWidthM);

  const layers = [
    `  <g data-layer="walls" fill="none" stroke="#000000" stroke-width="${fmt(options.strokeWidthM)}" stroke-linecap="square">`,
    `    ${wallShapes}`,
    `  </g>`,
  ];

  if (openingShapes) {
    layers.push(
      `  <g data-layer="openings" fill="none" stroke="#000000" stroke-width="${openingStrokeWidth}" stroke-linecap="round">`,
      `    ${openingShapes}`,
      `  </g>`,
    );
  }

  if (objects.length > 0) {
    const objectShapes = objects.map((object) => objectBoxToSvg(object)).join("\n    ");
    layers.push(
      `  <g data-layer="objects" fill="none" stroke="#000000" stroke-width="${fmt(options.strokeWidthM)}" stroke-linecap="square">`,
      `    ${objectShapes}`,
      `  </g>`,
    );
  }

  const roomLabel = options.roomLabel;
  if (roomLabel?.text) {
    layers.push(
      `  <g data-layer="labels" fill="#000000" stroke="none">`,
      `    <text x="${fmt(roomLabel.center.x)}" y="${fmt(roomLabel.center.z)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fmt(roomLabel.fontSizeM)}">${escapeSvgText(roomLabel.text)}</text>`,
      `  </g>`,
    );
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(minX)} ${fmt(minZ)} ${fmt(width)} ${fmt(height)}" width="${fmt(width)}" height="${fmt(height)}">`,
    `  <rect x="${fmt(minX)}" y="${fmt(minZ)}" width="${fmt(width)}" height="${fmt(height)}" fill="#ffffff" />`,
    ...layers,
    `</svg>`,
  ].join("\n");
}

export function normalizeSvgForSnapshot(svg: string): string {
  return svg.replace(/\d+\.\d+/g, (m) => Number(Number(m).toFixed(2)).toString());
}

export { distance2D as _distance2DForTests };
