import { snapEndpoints } from "./cleanup";
import { normalizeAngle } from "./matrix";
import type { FireSightObject, FireSightOpening, FireSightRoomScan } from "./firesight";
import type { Point2D, Segment2D } from "./types";

const STRAIGHTEN_THRESHOLD_RAD = (5 * Math.PI) / 180;
const CARDINAL_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function segmentAngle(seg: Segment2D): number {
  return Math.atan2(seg.end.z - seg.start.z, seg.end.x - seg.start.x);
}

function cardinalOffset(angle: number): number {
  let bestOffset = 0;
  let bestDist = Infinity;
  for (const cardinal of CARDINAL_ANGLES) {
    const diff = normalizeAngle(angle - cardinal);
    const dist = Math.abs(diff);
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = diff;
    }
  }
  return bestOffset;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function computeCentroid(segments: Segment2D[]): Point2D {
  const points: Point2D[] = [];
  for (const seg of segments) {
    points.push(seg.start, seg.end);
  }
  if (points.length === 0) return { x: 0, z: 0 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length,
  };
}

function rotatePoint(point: Point2D, center: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  return {
    x: center.x + dx * cos - dz * sin,
    z: center.z + dx * sin + dz * cos,
  };
}

export function computeStraightenRotation(segments: Segment2D[]): number | null {
  if (segments.length === 0) return null;
  const offsets = segments.map((seg) => cardinalOffset(segmentAngle(seg)));
  if (offsets.some((o) => Math.abs(o) > STRAIGHTEN_THRESHOLD_RAD)) {
    return null;
  }
  return -median(offsets);
}

export function straightenSegments(
  segments: Segment2D[],
  snapToleranceM: number,
): { segments: Segment2D[]; correctionRad: number | null } {
  const correction = computeStraightenRotation(segments);
  if (correction === null) {
    return { segments, correctionRad: null };
  }

  const centroid = computeCentroid(segments);
  const rotated = segments.map((seg) => ({
    ...seg,
    start: rotatePoint(seg.start, centroid, correction),
    end: rotatePoint(seg.end, centroid, correction),
  }));

  return {
    segments: snapEndpoints(rotated, snapToleranceM),
    correctionRad: correction,
  };
}

export function orthoRectangularize(segments: Segment2D[]): Segment2D[] {
  if (segments.length === 0) return segments;

  const points = segments.flatMap((seg) => [seg.start, seg.end]);
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z));
  const maxZ = Math.max(...points.map((p) => p.z));

  return segments.map((seg) => {
    const dx = Math.abs(seg.end.x - seg.start.x);
    const dz = Math.abs(seg.end.z - seg.start.z);
    const horizontal = dx >= dz;

    if (horizontal) {
      const z = (seg.start.z + seg.end.z) / 2;
      const snapZ = Math.abs(z - minZ) <= Math.abs(z - maxZ) ? minZ : maxZ;
      return {
        ...seg,
        start: { x: minX, z: snapZ },
        end: { x: maxX, z: snapZ },
      };
    }

    const x = (seg.start.x + seg.end.x) / 2;
    const snapX = Math.abs(x - minX) <= Math.abs(x - maxX) ? minX : maxX;
    return {
      ...seg,
      start: { x: snapX, z: minZ },
      end: { x: snapX, z: maxZ },
    };
  });
}

export function straightenFireSightScan(
  scan: FireSightRoomScan,
  snapToleranceM: number,
): { scan: FireSightRoomScan; correctionRad: number | null } {
  const segments: Segment2D[] = scan.walls.map((wall) => ({
    kind: "segment" as const,
    start: { x: wall.start.x, z: wall.start.y },
    end: { x: wall.end.x, z: wall.end.y },
    wallId: wall.id,
  }));

  const { segments: straightened, correctionRad } = straightenSegments(
    segments,
    snapToleranceM,
  );
  if (correctionRad === null) {
    return { scan, correctionRad: null };
  }

  const rectangular = orthoRectangularize(straightened);

  const walls = rectangular.map((seg, index) => ({
    ...scan.walls[index],
    start: { x: seg.start.x, y: seg.start.z },
    end: { x: seg.end.x, y: seg.end.z },
  }));

  const centroid = computeCentroid(segments);
  const correctionDeg = (correctionRad * 180) / Math.PI;
  const openings: FireSightOpening[] = (scan.openings ?? []).map((opening) => {
    const rotated = rotatePoint(
      { x: opening.position.x, z: opening.position.y },
      centroid,
      correctionRad,
    );
    return {
      ...opening,
      position: { x: rotated.x, y: rotated.z },
      rotationDegrees: opening.rotationDegrees + correctionDeg,
    };
  });

  const objects: FireSightObject[] = (scan.objects ?? []).map((object) => {
    const rotated = rotatePoint(
      { x: object.position.x, z: object.position.y },
      centroid,
      correctionRad,
    );
    return {
      ...object,
      position: { x: rotated.x, y: rotated.z },
      rotationDegrees: object.rotationDegrees + correctionDeg,
    };
  });

  return {
    scan: { ...scan, walls, openings, objects },
    correctionRad,
  };
}
