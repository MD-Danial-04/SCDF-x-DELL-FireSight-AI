import type { Point2D, Segment2D } from "./types";

export function computeRoomCenter(walls: Segment2D[]): Point2D {
  const points = walls.flatMap((wall) => [wall.start, wall.end]);
  if (points.length === 0) return { x: 0, z: 0 };

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z));
  const maxZ = Math.max(...points.map((p) => p.z));

  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
  };
}

export function roomLabelFontSizeM(walls: Segment2D[]): number {
  const points = walls.flatMap((wall) => [wall.start, wall.end]);
  if (points.length === 0) return 0.25;

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z));
  const maxZ = Math.max(...points.map((p) => p.z));

  const span = Math.min(maxX - minX, maxZ - minZ);
  return Math.max(0.18, Math.min(0.35, span * 0.08));
}

export function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
