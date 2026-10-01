import type { Point2D, TransformMatrix } from "./types";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Column-major 4x4 transform (RoomPlan / simd convention). */
export function transformPoint(matrix: TransformMatrix, local: Vec3): Vec3 {
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15] =
    matrix;

  return {
    x: m0 * local.x + m4 * local.y + m8 * local.z + m12,
    y: m1 * local.x + m5 * local.y + m9 * local.z + m13,
    z: m2 * local.x + m6 * local.y + m10 * local.z + m14,
  };
}

export function projectToXZ(point: Vec3): Point2D {
  return { x: point.x, z: point.z };
}

export function transformLocalToXZ(
  matrix: TransformMatrix,
  local: Vec3,
): Point2D {
  return projectToXZ(transformPoint(matrix, local));
}

export function distance2D(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function lerp2D(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a <= -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}
