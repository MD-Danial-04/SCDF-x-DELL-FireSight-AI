import { distance2D } from "./matrix";
import {
  arcLength,
  openingWidthM,
  projectPointOntoArc,
  projectPointOntoSegment,
  segmentLength,
  splitArc,
  splitSegment,
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

    let pieces: WallPrimitive2D[] = [wall];
    for (const span of spans) {
      const next: WallPrimitive2D[] = [];
      for (const piece of pieces) {
        if (piece.kind === "segment") {
          next.push(...splitSegment(piece, span.t0, span.t1));
        } else {
          next.push(...splitArc(piece, span.t0, span.t1));
        }
      }
      pieces = next;
    }
    result.push(...pieces);
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
