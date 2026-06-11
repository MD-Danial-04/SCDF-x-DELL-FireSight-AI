import { distance2D, transformLocalToXZ } from "./matrix";
import type {
  Point2D,
  RoomPlanSurface,
  Segment2D,
  Arc2D,
  WallPrimitive2D,
  SurfaceCurve,
} from "./types";

function projectRectCenterline(
  surface: RoomPlanSurface,
  wallId: string,
): Segment2D {
  const length = surface.dimensions?.[0] ?? 0;
  const half = length / 2;
  const start = transformLocalToXZ(surface.transform, {
    x: -half,
    y: 0,
    z: 0,
  });
  const end = transformLocalToXZ(surface.transform, { x: half, y: 0, z: 0 });
  return { kind: "segment", start, end, wallId };
}

function projectPolygonCenterline(
  surface: RoomPlanSurface,
  wallId: string,
): Segment2D {
  const corners = surface.polygonCorners!;
  const points = corners.map(([x, y, z]) =>
    transformLocalToXZ(surface.transform, { x, y, z }),
  );

  if (points.length === 2) {
    return { kind: "segment", start: points[0], end: points[1], wallId };
  }

  let maxDist = 0;
  let start = points[0];
  let end = points[1];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distance2D(points[i], points[j]);
      if (d > maxDist) {
        maxDist = d;
        start = points[i];
        end = points[j];
      }
    }
  }
  return { kind: "segment", start, end, wallId };
}

function projectCurveCenterline(
  surface: RoomPlanSurface,
  curve: SurfaceCurve,
  wallId: string,
): Arc2D {
  const centerLocal = {
    x: curve.radius * Math.cos((curve.startAngle + curve.endAngle) / 2),
    y: 0,
    z: curve.radius * Math.sin((curve.startAngle + curve.endAngle) / 2),
  };
  const center = transformLocalToXZ(surface.transform, centerLocal);

  const startWorld = transformLocalToXZ(surface.transform, {
    x: curve.radius * Math.cos(curve.startAngle),
    y: 0,
    z: curve.radius * Math.sin(curve.startAngle),
  });
  const endWorld = transformLocalToXZ(surface.transform, {
    x: curve.radius * Math.cos(curve.endAngle),
    y: 0,
    z: curve.radius * Math.sin(curve.endAngle),
  });

  const startAngle = Math.atan2(startWorld.z - center.z, startWorld.x - center.x);
  const endAngle = Math.atan2(endWorld.z - center.z, endWorld.x - center.x);

  return {
    kind: "arc",
    center,
    radius: curve.radius,
    startAngle,
    endAngle,
    wallId,
  };
}

export function projectWallTo2D(surface: RoomPlanSurface): WallPrimitive2D {
  const wallId = surface.identifier;

  if (surface.curve) {
    return projectCurveCenterline(surface, surface.curve, wallId);
  }

  if (surface.polygonCorners && surface.polygonCorners.length > 0) {
    return projectPolygonCenterline(surface, wallId);
  }

  return projectRectCenterline(surface, wallId);
}

export function projectAllWalls(walls: RoomPlanSurface[]): WallPrimitive2D[] {
  return walls.map(projectWallTo2D);
}

/** Center point of a surface in XZ (for opening placement). */
export function surfaceCenterXZ(surface: RoomPlanSurface): Point2D {
  return transformLocalToXZ(surface.transform, { x: 0, y: 0, z: 0 });
}

/** Opening width along the wall axis (meters). */
export function openingWidthM(surface: RoomPlanSurface): number {
  return surface.dimensions?.[0] ?? 0;
}

export function segmentLength(seg: Segment2D): number {
  return distance2D(seg.start, seg.end);
}

export function pointOnSegment(seg: Segment2D, t: number): Point2D {
  return {
    x: seg.start.x + (seg.end.x - seg.start.x) * t,
    z: seg.start.z + (seg.end.z - seg.start.z) * t,
  };
}

export function projectPointOntoSegment(
  seg: Segment2D,
  point: Point2D,
): { t: number; distance: number } {
  const dx = seg.end.x - seg.start.x;
  const dz = seg.end.z - seg.start.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-12) {
    return { t: 0, distance: distance2D(seg.start, point) };
  }
  let t = ((point.x - seg.start.x) * dx + (point.z - seg.start.z) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const proj = pointOnSegment(seg, t);
  return { t, distance: distance2D(proj, point) };
}

export function arcLength(arc: Arc2D): number {
  let sweep = arc.endAngle - arc.startAngle;
  while (sweep < 0) sweep += 2 * Math.PI;
  while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  return arc.radius * sweep;
}

export function pointOnArc(arc: Arc2D, t: number): Point2D {
  let sweep = arc.endAngle - arc.startAngle;
  while (sweep < 0) sweep += 2 * Math.PI;
  const angle = arc.startAngle + sweep * t;
  return {
    x: arc.center.x + arc.radius * Math.cos(angle),
    z: arc.center.z + arc.radius * Math.sin(angle),
  };
}

export function projectPointOntoArc(
  arc: Arc2D,
  point: Point2D,
): { t: number; distance: number } {
  const angle = Math.atan2(point.z - arc.center.z, point.x - arc.center.x);
  let relStart = angle - arc.startAngle;
  while (relStart < 0) relStart += 2 * Math.PI;
  let sweep = arc.endAngle - arc.startAngle;
  while (sweep < 0) sweep += 2 * Math.PI;

  let t: number;
  if (sweep < 1e-9) {
    t = 0;
  } else if (relStart <= sweep) {
    t = relStart / sweep;
  } else {
    const distStart = distance2D(point, pointOnArc(arc, 0));
    const distEnd = distance2D(point, pointOnArc(arc, 1));
    t = distStart <= distEnd ? 0 : 1;
  }

  const proj = pointOnArc(arc, t);
  return { t, distance: distance2D(proj, point) };
}

export function splitSegment(
  seg: Segment2D,
  t0: number,
  t1: number,
): Segment2D[] {
  const lo = Math.max(0, Math.min(t0, t1));
  const hi = Math.min(1, Math.max(t0, t1));
  const result: Segment2D[] = [];
  if (lo > 1e-9) {
    result.push({
      kind: "segment",
      start: seg.start,
      end: pointOnSegment(seg, lo),
      wallId: seg.wallId,
    });
  }
  if (hi < 1 - 1e-9) {
    result.push({
      kind: "segment",
      start: pointOnSegment(seg, hi),
      end: seg.end,
      wallId: seg.wallId,
    });
  }
  return result;
}

export function splitArc(arc: Arc2D, t0: number, t1: number): Arc2D[] {
  const lo = Math.max(0, Math.min(t0, t1));
  const hi = Math.min(1, Math.max(t0, t1));
  let sweep = arc.endAngle - arc.startAngle;
  while (sweep < 0) sweep += 2 * Math.PI;

  const result: Arc2D[] = [];
  if (lo > 1e-9) {
    result.push({
      kind: "arc",
      center: arc.center,
      radius: arc.radius,
      startAngle: arc.startAngle,
      endAngle: arc.startAngle + sweep * lo,
      wallId: arc.wallId,
    });
  }
  if (hi < 1 - 1e-9) {
    result.push({
      kind: "arc",
      center: arc.center,
      radius: arc.radius,
      startAngle: arc.startAngle + sweep * hi,
      endAngle: arc.endAngle,
      wallId: arc.wallId,
    });
  }
  return result;
}
