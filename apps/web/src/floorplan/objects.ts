import type { FireSightObject } from "./firesight";
import { transformLocalToXZ } from "./matrix";
import type { Point2D, RoomPlanSurface, Segment2D } from "./types";

export const DEFAULT_OBJECT_FOOTPRINT_INSET_M = 0.02;
export const OBJECT_MIN_SIZE_M = 0.15;
const MAX_OVERLAP_RESOLUTION_ITERATIONS = 10;

export interface ObjectBox2D {
  id: string;
  center: Point2D;
  widthM: number;
  depthM: number;
  rotationDeg: number;
}

function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}

function cloneBox(box: ObjectBox2D): ObjectBox2D {
  return {
    ...box,
    center: { ...box.center },
  };
}

function getObbAxes(box: ObjectBox2D): Point2D[] {
  const rad = (box.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    { x: cos, z: sin },
    { x: -sin, z: cos },
  ];
}

function projectOntoAxis(
  points: Point2D[],
  axis: Point2D,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const projection = point.x * axis.x + point.z * axis.z;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function intervalOverlap(
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
): number {
  if (maxA <= minB || maxB <= minA) return 0;
  return Math.min(maxA, maxB) - Math.max(minA, minB);
}

export function deflateObjectBox(box: ObjectBox2D, insetM: number): ObjectBox2D {
  return {
    ...box,
    widthM: Math.max(OBJECT_MIN_SIZE_M, box.widthM - 2 * insetM),
    depthM: Math.max(OBJECT_MIN_SIZE_M, box.depthM - 2 * insetM),
  };
}

export function orientedBoxesOverlap(a: ObjectBox2D, b: ObjectBox2D): boolean {
  const cornersA = objectBoxCorners(a);
  const cornersB = objectBoxCorners(b);
  const axes = [...getObbAxes(a), ...getObbAxes(b)];

  for (const axis of axes) {
    const projA = projectOntoAxis(cornersA, axis);
    const projB = projectOntoAxis(cornersB, axis);
    if (intervalOverlap(projA.min, projA.max, projB.min, projB.max) <= 0) {
      return false;
    }
  }

  return true;
}

export function separationVector(
  a: ObjectBox2D,
  b: ObjectBox2D,
): Point2D | null {
  const cornersA = objectBoxCorners(a);
  const cornersB = objectBoxCorners(b);
  const axes = [...getObbAxes(a), ...getObbAxes(b)];

  let minOverlap = Infinity;
  let bestAxis: Point2D | null = null;

  for (const axis of axes) {
    const projA = projectOntoAxis(cornersA, axis);
    const projB = projectOntoAxis(cornersB, axis);
    const overlap = intervalOverlap(projA.min, projA.max, projB.min, projB.max);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      minOverlap = overlap;
      bestAxis = axis;
    }
  }

  if (!bestAxis) return null;

  const toB = {
    x: b.center.x - a.center.x,
    z: b.center.z - a.center.z,
  };
  const dot = toB.x * bestAxis.x + toB.z * bestAxis.z;
  const sign = dot >= 0 ? 1 : -1;

  return {
    x: bestAxis.x * minOverlap * sign,
    z: bestAxis.z * minOverlap * sign,
  };
}

export function resolveObjectBoxOverlaps(boxes: ObjectBox2D[]): ObjectBox2D[] {
  const resolved = boxes.map(cloneBox);

  for (let iteration = 0; iteration < MAX_OVERLAP_RESOLUTION_ITERATIONS; iteration++) {
    let moved = false;

    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        if (!orientedBoxesOverlap(resolved[i], resolved[j])) continue;

        const mtv = separationVector(resolved[i], resolved[j]);
        if (!mtv) continue;

        resolved[i].center.x -= mtv.x / 2;
        resolved[i].center.z -= mtv.z / 2;
        resolved[j].center.x += mtv.x / 2;
        resolved[j].center.z += mtv.z / 2;
        moved = true;
      }
    }

    if (!moved) break;
  }

  return resolved;
}

function wallSegmentToBox(segment: Segment2D, clearanceM: number): ObjectBox2D {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const length = Math.hypot(dx, dz) || OBJECT_MIN_SIZE_M;

  return {
    id: segment.wallId,
    center: {
      x: (segment.start.x + segment.end.x) / 2,
      z: (segment.start.z + segment.end.z) / 2,
    },
    widthM: length,
    depthM: Math.max(OBJECT_MIN_SIZE_M, clearanceM * 2),
    rotationDeg: (Math.atan2(dz, dx) * 180) / Math.PI,
  };
}

export function objectBoxIntersectsWallSegment(
  box: ObjectBox2D,
  segment: Segment2D,
  clearanceM: number,
): boolean {
  return orientedBoxesOverlap(box, wallSegmentToBox(segment, clearanceM));
}

export function pushObjectBoxOffWalls(
  box: ObjectBox2D,
  walls: Segment2D[],
  clearanceM: number,
): ObjectBox2D {
  const resolved = cloneBox(box);

  for (let iteration = 0; iteration < MAX_OVERLAP_RESOLUTION_ITERATIONS; iteration++) {
    let moved = false;

    for (const wall of walls) {
      const wallBox = wallSegmentToBox(wall, clearanceM);
      if (!orientedBoxesOverlap(resolved, wallBox)) continue;

      const mtv = separationVector(resolved, wallBox);
      if (!mtv) continue;

      resolved.center.x -= mtv.x;
      resolved.center.z -= mtv.z;
      moved = true;
    }

    if (!moved) break;
  }

  return resolved;
}

export function layoutObjectBoxes(
  boxes: ObjectBox2D[],
  wallSegments: Segment2D[],
  clearanceM: number,
): ObjectBox2D[] {
  if (boxes.length === 0) return [];

  let resolved = resolveObjectBoxOverlaps(boxes);

  for (let iteration = 0; iteration < MAX_OVERLAP_RESOLUTION_ITERATIONS; iteration++) {
    const afterWalls = resolved.map((box) =>
      pushObjectBoxOffWalls(box, wallSegments, clearanceM),
    );
    const afterObjects = resolveObjectBoxOverlaps(afterWalls);

    const unchanged = afterObjects.every(
      (box, index) =>
        Math.abs(box.center.x - resolved[index].center.x) < 1e-6 &&
        Math.abs(box.center.z - resolved[index].center.z) < 1e-6,
    );
    resolved = afterObjects;
    if (unchanged) break;
  }

  return resolved;
}

export function projectFireSightObject(obj: FireSightObject): ObjectBox2D {
  return {
    id: obj.id,
    center: { x: obj.position.x, z: obj.position.y },
    widthM: obj.width,
    depthM: obj.depth,
    rotationDeg: obj.rotationDegrees,
  };
}

export function projectRoomPlanObject(surface: RoomPlanSurface): ObjectBox2D {
  const [widthM, , depthM] = surface.dimensions!;
  const center = transformLocalToXZ(surface.transform, { x: 0, y: 0, z: 0 });
  const m = surface.transform;
  const rotationDeg = (Math.atan2(m[2], m[0]) * 180) / Math.PI;

  return {
    id: surface.identifier,
    center,
    widthM,
    depthM,
    rotationDeg,
  };
}

export function objectBoxCorners(box: ObjectBox2D): Point2D[] {
  const halfW = box.widthM / 2;
  const halfD = box.depthM / 2;
  const rad = (box.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localCorners = [
    { x: -halfW, z: -halfD },
    { x: halfW, z: -halfD },
    { x: halfW, z: halfD },
    { x: -halfW, z: halfD },
  ];

  return localCorners.map(({ x, z }) => ({
    x: box.center.x + x * cos - z * sin,
    z: box.center.z + x * sin + z * cos,
  }));
}

export function objectBoxToSvg(box: ObjectBox2D): string {
  const { center, widthM, depthM, rotationDeg } = box;
  const x = center.x - widthM / 2;
  const y = center.z - depthM / 2;
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(widthM)}" height="${fmt(depthM)}" fill="#ffffff" transform="rotate(${fmt(rotationDeg)}, ${fmt(center.x)}, ${fmt(center.z)})" />`;
}
