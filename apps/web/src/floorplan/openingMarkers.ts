import { distance2D } from "./matrix";
import {
  pointOnSegment,
  projectPointOntoSegment,
  segmentLength,
} from "./project";
import type { FireSightOpening } from "./firesight";
import type { Point2D, Segment2D, WallPrimitive2D } from "./types";

export const MARKER_STROKE_WIDTH_M = 0.03;
const WINDOW_DETACH_M = 0.05;
const WINDOW_FRAME_DEPTH_M = 0.12;
const WINDOW_DIVIDER_LEN_M = 0.04;
const WINDOW_TARGET_PANE_M = 0.45;
const WINDOW_WALL_GAP_M = 0.05;
const WINDOW_MERGE_TOLERANCE_M = 0.06;

export interface OpeningMarker {
  svg: string;
  points: Point2D[];
}

function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}

function lineSvg(a: Point2D, b: Point2D): string {
  return `<line x1="${fmt(a.x)}" y1="${fmt(a.z)}" x2="${fmt(b.x)}" y2="${fmt(b.z)}" />`;
}

function computeCentroid(walls: Segment2D[]): Point2D {
  const points: Point2D[] = [];
  for (const wall of walls) {
    points.push(wall.start, wall.end);
  }
  if (points.length === 0) return { x: 0, z: 0 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length,
  };
}

function findNearestWall(
  point: Point2D,
  walls: WallPrimitive2D[],
): Segment2D | null {
  let best: Segment2D | null = null;
  let bestDist = Infinity;

  for (const wall of walls) {
    if (wall.kind !== "segment") continue;
    const proj = projectPointOntoSegment(wall, point);
    if (proj.distance < bestDist) {
      bestDist = proj.distance;
      best = wall;
    }
  }

  return best;
}

function interiorNormal(seg: Segment2D, centroid: Point2D): Point2D {
  const mid = {
    x: (seg.start.x + seg.end.x) / 2,
    z: (seg.start.z + seg.end.z) / 2,
  };
  const wallAngle = Math.atan2(seg.end.z - seg.start.z, seg.end.x - seg.start.x);
  const n1 = {
    x: Math.cos(wallAngle + Math.PI / 2),
    z: Math.sin(wallAngle + Math.PI / 2),
  };
  const toCentroid = { x: centroid.x - mid.x, z: centroid.z - mid.z };
  const dot = n1.x * toCentroid.x + n1.z * toCentroid.z;
  return dot >= 0 ? n1 : { x: -n1.x, z: -n1.z };
}

function openingCenter(opening: FireSightOpening): Point2D {
  return { x: opening.position.x, z: opening.position.y };
}

function jambPointsOnWall(
  opening: FireSightOpening,
  wall: Segment2D,
): { jambA: Point2D; jambB: Point2D } | null {
  const width = opening.width;
  if (width <= 0) return null;

  const center = openingCenter(opening);
  const len = segmentLength(wall);
  if (len < 1e-9) return null;

  const { t } = projectPointOntoSegment(wall, center);
  const halfT = width / 2 / len;
  const t0 = Math.max(0, t - halfT);
  const t1 = Math.min(1, t + halfT);

  return {
    jambA: pointOnSegment(wall, t0),
    jambB: pointOnSegment(wall, t1),
  };
}

function openingSpanOnWall(
  opening: FireSightOpening,
  wall: Segment2D,
): { t0: number; t1: number } | null {
  const width = opening.width;
  if (width <= 0) return null;

  const len = segmentLength(wall);
  if (len < 1e-9) return null;

  const { t } = projectPointOntoSegment(wall, openingCenter(opening));
  const halfT = width / 2 / len;
  return {
    t0: Math.max(0, t - halfT),
    t1: Math.min(1, t + halfT),
  };
}

function unitVector(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return { x: 1, z: 0 };
  return { x: dx / len, z: dz / len };
}

function quarterArcMidpoint(
  center: Point2D,
  start: Point2D,
  end: Point2D,
  radius: number,
  sweep: 0 | 1,
): Point2D {
  const startAngle = Math.atan2(start.z - center.z, start.x - center.x);
  const endAngle = Math.atan2(end.z - center.z, end.x - center.x);

  let delta = endAngle - startAngle;
  if (sweep === 1) {
    while (delta <= 0) delta += 2 * Math.PI;
    while (delta > Math.PI / 2 + 1e-6) delta -= 2 * Math.PI;
  } else {
    while (delta >= 0) delta -= 2 * Math.PI;
    while (delta < -Math.PI / 2 - 1e-6) delta += 2 * Math.PI;
  }

  const midAngle = startAngle + delta / 2;
  return {
    x: center.x + Math.cos(midAngle) * radius,
    z: center.z + Math.sin(midAngle) * radius,
  };
}

function doorSwingMarker(
  opening: FireSightOpening,
  walls: WallPrimitive2D[],
): OpeningMarker | null {
  const center = openingCenter(opening);
  const wall = findNearestWall(center, walls);
  if (!wall) return null;

  const jambs = jambPointsOnWall(opening, wall);
  if (!jambs) return null;

  const { jambA, jambB } = jambs;
  const hinge = jambA;
  const width = opening.width;
  const segments = walls.filter((w): w is Segment2D => w.kind === "segment");
  const centroid = computeCentroid(segments);
  const normal = interiorNormal(wall, centroid);
  const wallDir = unitVector(jambA, jambB);

  const leafEnd = {
    x: hinge.x + normal.x * width,
    z: hinge.z + normal.z * width,
  };

  const expectedMidLen = Math.hypot(normal.x + wallDir.x, normal.z + wallDir.z);
  const expectedMid = {
    x: hinge.x + ((normal.x + wallDir.x) / expectedMidLen) * width * Math.SQRT1_2,
    z: hinge.z + ((normal.z + wallDir.z) / expectedMidLen) * width * Math.SQRT1_2,
  };

  const mid0 = quarterArcMidpoint(hinge, leafEnd, jambB, width, 0);
  const mid1 = quarterArcMidpoint(hinge, leafEnd, jambB, width, 1);
  const sweep: 0 | 1 =
    distance2D(mid0, expectedMid) <= distance2D(mid1, expectedMid) ? 0 : 1;

  const leaf = lineSvg(hinge, leafEnd);
  const arc = `<path d="M ${fmt(leafEnd.x)} ${fmt(leafEnd.z)} A ${fmt(width)} ${fmt(width)} 0 0 ${sweep} ${fmt(jambB.x)} ${fmt(jambB.z)}" />`;

  return {
    svg: `${leaf}\n    ${arc}`,
    points: [hinge, jambB, leafEnd],
  };
}

function wallPerpendicular(seg: Segment2D): Point2D {
  const wallAngle = Math.atan2(seg.end.z - seg.start.z, seg.end.x - seg.start.x);
  return {
    x: Math.cos(wallAngle + Math.PI / 2),
    z: Math.sin(wallAngle + Math.PI / 2),
  };
}

function bandLine(
  jambA: Point2D,
  jambB: Point2D,
  perp: Point2D,
  offset: number,
): { start: Point2D; end: Point2D } {
  return {
    start: {
      x: jambA.x + perp.x * offset,
      z: jambA.z + perp.z * offset,
    },
    end: {
      x: jambB.x + perp.x * offset,
      z: jambB.z + perp.z * offset,
    },
  };
}

function pointAlong(
  origin: Point2D,
  direction: Point2D,
  distance: number,
): Point2D {
  return {
    x: origin.x + direction.x * distance,
    z: origin.z + direction.z * distance,
  };
}

function filledRectSvg(
  center: Point2D,
  wallDir: Point2D,
  perp: Point2D,
  lengthAlongWall: number,
  depthPerp: number,
): string {
  const halfL = lengthAlongWall / 2;
  const halfD = depthPerp / 2;
  const corners = [
    pointAlong(pointAlong(center, wallDir, -halfL), perp, -halfD),
    pointAlong(pointAlong(center, wallDir, halfL), perp, -halfD),
    pointAlong(pointAlong(center, wallDir, halfL), perp, halfD),
    pointAlong(pointAlong(center, wallDir, -halfL), perp, halfD),
  ];
  const points = corners.map((p) => `${fmt(p.x)},${fmt(p.z)}`).join(" ");
  return `<polygon points="${points}" fill="#000000" stroke="none" />`;
}

function windowBarMarker(
  wall: Segment2D,
  jambA: Point2D,
  jambB: Point2D,
  centroid: Point2D,
): OpeningMarker | null {
  const wallDir = unitVector(jambA, jambB);
  const perp = wallPerpendicular(wall);
  const stubHalf = WINDOW_FRAME_DEPTH_M / 2;

  const jambStubAStart = pointAlong(jambA, perp, -stubHalf);
  const jambStubAEnd = pointAlong(jambA, perp, stubHalf);
  const jambStubBStart = pointAlong(jambB, perp, -stubHalf);
  const jambStubBEnd = pointAlong(jambB, perp, stubHalf);

  const innerStart = pointAlong(jambA, wallDir, WINDOW_DETACH_M);
  const innerEnd = pointAlong(jambB, wallDir, -WINDOW_DETACH_M);
  const innerLen = Math.hypot(
    innerEnd.x - innerStart.x,
    innerEnd.z - innerStart.z,
  );
  if (innerLen < 0.1) return null;

  const interior = interiorNormal(wall, centroid);
  const normal = { x: -interior.x, z: -interior.z };
  const nearOffset = WINDOW_WALL_GAP_M;
  const farOffset = WINDOW_WALL_GAP_M + WINDOW_FRAME_DEPTH_M;
  const dividerOffset = WINDOW_WALL_GAP_M + WINDOW_FRAME_DEPTH_M / 2;

  const nearFrame = bandLine(innerStart, innerEnd, normal, nearOffset);
  const farFrame = bandLine(innerStart, innerEnd, normal, farOffset);

  const paneCount = Math.max(2, Math.round(innerLen / WINDOW_TARGET_PANE_M));
  const dividerCount = paneCount - 1;
  const paneLen =
    (innerLen - dividerCount * WINDOW_DIVIDER_LEN_M) / paneCount;

  const shapes = [
    lineSvg(jambStubAStart, jambStubAEnd),
    lineSvg(jambStubBStart, jambStubBEnd),
    lineSvg(nearFrame.start, nearFrame.end),
    lineSvg(farFrame.start, farFrame.end),
  ];
  const points: Point2D[] = [
    jambStubAStart,
    jambStubAEnd,
    jambStubBStart,
    jambStubBEnd,
    nearFrame.start,
    nearFrame.end,
    farFrame.start,
    farFrame.end,
  ];

  let offset = paneLen;
  for (let i = 0; i < dividerCount; i++) {
    const baseCenter = pointAlong(
      innerStart,
      wallDir,
      offset + WINDOW_DIVIDER_LEN_M / 2,
    );
    const dividerCenter = pointAlong(baseCenter, normal, dividerOffset);
    shapes.push(
      filledRectSvg(
        dividerCenter,
        wallDir,
        normal,
        WINDOW_DIVIDER_LEN_M,
        WINDOW_FRAME_DEPTH_M,
      ),
    );
    points.push(dividerCenter);
    offset += paneLen + WINDOW_DIVIDER_LEN_M;
  }

  return {
    svg: shapes.join("\n    "),
    points,
  };
}

function passThroughMarker(
  opening: FireSightOpening,
  walls: WallPrimitive2D[],
): OpeningMarker | null {
  const center = openingCenter(opening);
  const wall = findNearestWall(center, walls);
  if (!wall) return null;

  const jambs = jambPointsOnWall(opening, wall);
  if (!jambs) return null;

  const { jambA, jambB } = jambs;
  return {
    svg: lineSvg(jambA, jambB),
    points: [jambA, jambB],
  };
}

function buildWindowMarkers(
  windows: FireSightOpening[],
  walls: WallPrimitive2D[],
  centroid: Point2D,
): OpeningMarker[] {
  const byWall = new Map<Segment2D, { t0: number; t1: number }[]>();

  for (const opening of windows) {
    const wall = findNearestWall(openingCenter(opening), walls);
    if (!wall) continue;
    const span = openingSpanOnWall(opening, wall);
    if (!span) continue;
    const list = byWall.get(wall) ?? [];
    list.push(span);
    byWall.set(wall, list);
  }

  const markers: OpeningMarker[] = [];

  for (const [wall, spans] of byWall) {
    const len = segmentLength(wall);
    const mergeTolT = len > 1e-9 ? WINDOW_MERGE_TOLERANCE_M / len : 0;
    spans.sort((a, b) => a.t0 - b.t0);

    const merged: { t0: number; t1: number }[] = [];
    for (const span of spans) {
      const last = merged[merged.length - 1];
      if (last && span.t0 - last.t1 <= mergeTolT) {
        last.t1 = Math.max(last.t1, span.t1);
      } else {
        merged.push({ ...span });
      }
    }

    for (const span of merged) {
      const marker = windowBarMarker(
        wall,
        pointOnSegment(wall, span.t0),
        pointOnSegment(wall, span.t1),
        centroid,
      );
      if (marker) markers.push(marker);
    }
  }

  return markers;
}

export function buildFireSightOpeningMarkers(
  openings: FireSightOpening[],
  walls: WallPrimitive2D[],
): OpeningMarker[] {
  const markers: OpeningMarker[] = [];
  const segments = walls.filter((w): w is Segment2D => w.kind === "segment");
  const centroid = computeCentroid(segments);

  const windows = openings.filter((o) => (o.kind ?? "opening") === "window");
  markers.push(...buildWindowMarkers(windows, walls, centroid));

  for (const opening of openings) {
    const kind = opening.kind ?? "opening";
    let marker: OpeningMarker | null = null;

    if (kind === "door") {
      marker = doorSwingMarker(opening, walls);
    } else if (kind === "window") {
      continue;
    } else {
      marker = passThroughMarker(opening, walls);
    }

    if (marker) markers.push(marker);
  }

  return markers;
}

export {
  computeCentroid as _computeCentroidForTests,
  findNearestWall as _findNearestWallForTests,
};
