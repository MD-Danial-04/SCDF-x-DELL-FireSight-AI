import { distance2D } from "./matrix";
import { segmentLength } from "./project";
import type { Point2D, Segment2D, Arc2D, WallPrimitive2D } from "./types";

const COLLINEAR_ANGLE_RAD = (1 * Math.PI) / 180;

function segmentAngle(seg: Segment2D): number {
  return Math.atan2(seg.end.z - seg.start.z, seg.end.x - seg.start.x);
}

function anglesClose(a: number, b: number): boolean {
  let diff = Math.abs(a - b);
  while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
  return diff < COLLINEAR_ANGLE_RAD;
}

function snapPoint(point: Point2D, canonical: Point2D[]): Point2D {
  for (const c of canonical) {
    if (distance2D(point, c) < 1e-12) return c;
  }
  canonical.push(point);
  return point;
}

function snapEndpoints(
  segments: Segment2D[],
  tolerance: number,
): Segment2D[] {
  const canonical: Point2D[] = [];

  const snapOrMerge = (p: Point2D): Point2D => {
    for (const c of canonical) {
      if (distance2D(p, c) <= tolerance) return c;
    }
    canonical.push({ x: p.x, z: p.z });
    return canonical[canonical.length - 1];
  };

  return segments.map((seg) => ({
    ...seg,
    start: snapOrMerge(seg.start),
    end: snapOrMerge(seg.end),
  }));
}

function mergeCollinearSegments(segments: Segment2D[]): Segment2D[] {
  if (segments.length === 0) return [];

  const used = new Set<number>();
  const result: Segment2D[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    let current = segments[i];
    used.add(i);

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const other = segments[j];
        if (current.wallId !== other.wallId) continue;

        const angleA = segmentAngle(current);
        const angleB = segmentAngle(other);
        if (!anglesClose(angleA, angleB)) continue;

        const connects =
          distance2D(current.end, other.start) < 1e-6 ||
          distance2D(current.end, other.end) < 1e-6 ||
          distance2D(current.start, other.start) < 1e-6 ||
          distance2D(current.start, other.end) < 1e-6;

        if (!connects) continue;

        const points = [current.start, current.end, other.start, other.end];
        let maxDist = 0;
        let start = points[0];
        let end = points[1];
        for (let a = 0; a < points.length; a++) {
          for (let b = a + 1; b < points.length; b++) {
            const d = distance2D(points[a], points[b]);
            if (d > maxDist) {
              maxDist = d;
              start = points[a];
              end = points[b];
            }
          }
        }

        current = { kind: "segment", start, end, wallId: current.wallId };
        used.add(j);
        changed = true;
      }
    }

    if (segmentLength(current) > 1e-6) {
      result.push(current);
    }
  }

  return result;
}

function dedupeSegments(segments: Segment2D[]): Segment2D[] {
  const seen = new Set<string>();
  const result: Segment2D[] = [];

  for (const seg of segments) {
    if (segmentLength(seg) < 1e-6) continue;
    const key = [
      seg.wallId,
      seg.start.x.toFixed(4),
      seg.start.z.toFixed(4),
      seg.end.x.toFixed(4),
      seg.end.z.toFixed(4),
    ].join("|");
    const revKey = [
      seg.wallId,
      seg.end.x.toFixed(4),
      seg.end.z.toFixed(4),
      seg.start.x.toFixed(4),
      seg.start.z.toFixed(4),
    ].join("|");
    if (seen.has(key) || seen.has(revKey)) continue;
    seen.add(key);
    result.push(seg);
  }

  return result;
}

export function cleanupPrimitives(
  primitives: WallPrimitive2D[],
  snapToleranceM: number,
): WallPrimitive2D[] {
  const segments = primitives.filter(
    (p): p is Segment2D => p.kind === "segment",
  );
  const arcs = primitives.filter((p): p is Arc2D => p.kind === "arc");

  let cleaned = snapEndpoints(segments, snapToleranceM);
  cleaned = mergeCollinearSegments(cleaned);
  cleaned = dedupeSegments(cleaned);

  return [...cleaned, ...arcs];
}

export { snapPoint };
