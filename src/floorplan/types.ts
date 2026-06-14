/** Apple RoomPlan JSON types (loose, keyed enums). */

export type TransformMatrix = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface SurfaceCurve {
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface RoomPlanSurface {
  identifier: string;
  parentIdentifier?: string | null;
  story?: number;
  transform: TransformMatrix;
  dimensions?: [number, number, number];
  polygonCorners?: [number, number, number][];
  curve?: SurfaceCurve | null;
  completedEdges?: unknown[];
  confidence?: Record<string, unknown>;
  category?: Record<string, unknown>;
}

export interface CapturedRoom {
  walls?: RoomPlanSurface[];
  openings?: RoomPlanSurface[];
  doors?: RoomPlanSurface[];
  windows?: RoomPlanSurface[];
  floors?: RoomPlanSurface[];
  objects?: unknown[];
  sections?: unknown[];
}

export interface CapturedStructure extends CapturedRoom {
  rooms?: CapturedRoom[];
}

export type RoomPlanInput = CapturedRoom | CapturedStructure;

export interface NormalizedScan {
  walls: RoomPlanSurface[];
  openings: RoomPlanSurface[];
}

export interface ConvertOptions {
  story?: number;
  snapToleranceM?: number;
  strokeWidthM?: number;
  paddingM?: number;
  includeOpeningGaps?: boolean;
  straighten?: boolean;
}

export const DEFAULT_CONVERT_OPTIONS: Required<ConvertOptions> = {
  story: 0,
  snapToleranceM: 0.05,
  strokeWidthM: 0.05,
  paddingM: 0.5,
  includeOpeningGaps: false,
  straighten: false,
};

/** 2D point in meters (world X and Z). */
export interface Point2D {
  x: number;
  z: number;
}

export interface Segment2D {
  kind: "segment";
  start: Point2D;
  end: Point2D;
  wallId: string;
}

export interface Arc2D {
  kind: "arc";
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  wallId: string;
}

export type WallPrimitive2D = Segment2D | Arc2D;

export interface OpeningSpan {
  openingId: string;
  wallId: string;
  t0: number;
  t1: number;
}
