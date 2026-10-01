import { distance2D } from "./matrix";
import {
  arcLength,
  openingWidthM,
  pointOnSegment,
  projectPointOntoArc,
  projectPointOntoSegment,
  segmentLength,
  sliceArc,
  surfaceCenterXZ,
} from "./project";
import type {
  OpeningSpan,
  RoomPlanSurface,
  Segment2D,
  Arc2D,
  WallPrimitive2D,
} from "./types";

const NEAREST_WALL_THRESHOLD_M = 0.3;

export interface OpeningWarning {
  openingId: string;
  message: string;
}

function resolveWallId(
  opening: RoomPlanSurface,
  wallsById: Map<string, WallPrimitive2D>,
  wallList: WallPrimitive2D[],
): { wallId: string; warning?: string } {
  if (opening.parentIdentifier && wallsById.has(opening.parentIdentifier)) {
    return { wallId: opening.parentIdentifier };
  }

  const center = surfaceCenterXZ(opening);
  let bestId = "";
  let bestDist = Infinity;

  for (const wall of wallList) {
    const proj =
      wall.kind === "segment"
        ? projectPointOntoSegment(wall, center)
        : projectPointOntoArc(wall, center);
    if (proj.distance < bestDist) {
      bestDist = proj.distance;
      bestId = wall.wallId;
    }
  }

  if (!bestId || bestDist > NEAREST_WALL_THRESHOLD_M) {
    return {
      wallId: bestId,
      warning: `Opening ${opening.identifier} could not be matched to a wall (nearest ${bestDist.toFixed(2)} m)`,
    };
  }

  return {
    wallId: bestId,
    warning: opening.parentIdentifier
      ? `Opening ${opening.identifier} parent ${opening.parentIdentifier} not found; matched nearest wall`
      : undefined,
  };
}

function computeOpeningSpan(
  opening: RoomPlanSurface,
  wall: WallPrimitive2D,
): OpeningSpan | null {
  const width = openingWidthM(opening);
  if (width <= 0) return null;

  const center = surfaceCenterXZ(opening);
  const halfWidth = width / 2;

  if (wall.kind === "segment") {
    const len = segmentLength(wall);
    if (len < 1e-9) return null;
    const { t } = projectPointOntoSegment(wall, center);
    const halfT = halfWidth / len;
    return {
      openingId: opening.identifier,
      wallId: wall.wallId,
      t0: Math.max(0, t - halfT),
      t1: Math.min(1, t + halfT),
    };
  }

  const len = arcLength(wall);
  if (len < 1e-9) return null;
  const { t } = projectPointOntoArc(wall, center);
  const halfT = halfWidth / len;
  return {
    openingId: opening.identifier,
    wallId: wall.wallId,
    t0: Math.max(0, t - halfT),
    t1: Math.min(1, t + halfT),
  };
}

function mergeCutSpans(spans: OpeningSpan[]): { t0: number; t1: number }[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.t0 - b.t0);
  const merged: { t0: number; t1: number }[] = [];
  let current = { t0: sorted[0].t0, t1: sorted[0].t1 };

  for (let i = 1; i < sorted.length; i++) {
    const span = sorted[i];
    if (span.t0 <= current.t1 + 1e-9) {
      current.t1 = Math.max(current.t1, span.t1);
    } else {
      merged.push(current);
      current = { t0: span.t0, t1: span.t1 };
    }
  }
  merged.push(current);
  return merged;
}

function keepIntervals(cutSpans: { t0: number; t1: number }[]): { t0: number; t1: number }[] {
  const keep: { t0: number; t1: number }[] = [];
  let cursor = 0;

  for (const cut of cutSpans) {
    if (cut.t0 > cursor + 1e-9) {
      keep.push({ t0: cursor, t1: cut.t0 });
    }
    cursor = Math.max(cursor, cut.t1);
  }

  if (cursor < 1 - 1e-9) {
    keep.push({ t0: cursor, t1: 1 });
  }

  return keep;
}

function wallPiecesForKeepIntervals(
  wall: WallPrimitive2D,
  intervals: { t0: number; t1: number }[],
): WallPrimitive2D[] {
  const pieces: WallPrimitive2D[] = [];

  for (const interval of intervals) {
    if (interval.t1 - interval.t0 <= 1e-9) continue;

    if (wall.kind === "segment") {
      pieces.push({
        kind: "segment",
        start: pointOnSegment(wall, interval.t0),
        end: pointOnSegment(wall, interval.t1),
        wallId: wall.wallId,
      });
    } else {
      pieces.push(sliceArc(wall, interval.t0, interval.t1));
    }
  }

  return pieces;
}

export function applyOpeningGaps(
  walls: WallPrimitive2D[],
  openings: RoomPlanSurface[],
): { primitives: WallPrimitive2D[]; warnings: OpeningWarning[] } {
  const warnings: OpeningWarning[] = [];
  const wallsById = new Map(walls.map((w) => [w.wallId, w]));

  const spansByWall = new Map<string, OpeningSpan[]>();

  for (const opening of openings) {
    const { wallId, warning } = resolveWallId(opening, wallsById, walls);
    if (warning) warnings.push({ openingId: opening.identifier, message: warning });
    if (!wallId) continue;

    const wall = wallsById.get(wallId);
    if (!wall) continue;

    const span = computeOpeningSpan(opening, wall);
    if (!span || span.t1 <= span.t0) continue;

    const existing = spansByWall.get(wallId) ?? [];
    existing.push(span);
    spansByWall.set(wallId, existing);
  }

  const result: WallPrimitive2D[] = [];

  for (const wall of walls) {
    const spans = spansByWall.get(wall.wallId);
    if (!spans || spans.length === 0) {
      result.push(wall);
      continue;
    }

    spans.sort((a, b) => a.t0 - b.t0);

    const cutSpans = mergeCutSpans(spans);
    const keep = keepIntervals(cutSpans);
    result.push(...wallPiecesForKeepIntervals(wall, keep));
  }

  return { primitives: result, warnings };
}

/** Exported for tests. */
export function findNearestWallDistance(
  point: { x: number; z: number },
  walls: WallPrimitive2D[],
): number {
  let best = Infinity;
  for (const wall of walls) {
    const proj =
      wall.kind === "segment"
        ? projectPointOntoSegment(wall, point)
        : projectPointOntoArc(wall, point);
    best = Math.min(best, proj.distance);
  }
  return best;
}

export { NEAREST_WALL_THRESHOLD_M };
