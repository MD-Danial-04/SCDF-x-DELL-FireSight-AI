import type { RoomPlanSurface, Segment2D } from "./types";

export interface FireSightPoint {
  x: number;
  y: number;
}

export interface FireSightWall {
  id: string;
  start: FireSightPoint;
  end: FireSightPoint;
}

export interface FireSightOpening {
  id: string;
  kind?: "door" | "window" | "opening";
  position: FireSightPoint;
  width: number;
  height?: number;
  rotationDegrees: number;
}

export interface FireSightObject {
  id: string;
  position: FireSightPoint;
  width: number;
  depth: number;
  rotationDegrees: number;
}

export interface FireSightRoomMeta {
  name?: string;
}

export interface FireSightRoomScan {
  schemaVersion?: string;
  room?: FireSightRoomMeta;
  walls: FireSightWall[];
  openings?: FireSightOpening[];
  objects?: FireSightObject[];
}

export function isFireSightRoomScan(input: unknown): input is FireSightRoomScan {
  if (!input || typeof input !== "object") return false;
  const doc = input as Record<string, unknown>;
  if (doc.schemaVersion === "firesight-room-scan/v1") return true;
  const wall = Array.isArray(doc.walls) ? doc.walls[0] : null;
  return (
    !!wall &&
    typeof wall === "object" &&
    "start" in wall &&
    "end" in wall &&
    !("transform" in wall)
  );
}

export function projectFireSightWall(wall: FireSightWall): Segment2D {
  return {
    kind: "segment",
    start: { x: wall.start.x, z: wall.start.y },
    end: { x: wall.end.x, z: wall.end.y },
    wallId: wall.id,
  };
}

export function projectFireSightWalls(walls: FireSightWall[]): Segment2D[] {
  return walls.map(projectFireSightWall);
}

export function fireSightOpeningToSurface(
  opening: FireSightOpening,
): RoomPlanSurface {
  const rad = (opening.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    identifier: opening.id,
    transform: [
      cos,
      0,
      sin,
      0,
      0,
      1,
      0,
      0,
      -sin,
      0,
      cos,
      0,
      opening.position.x,
      0,
      opening.position.y,
      1,
    ],
    dimensions: [opening.width, opening.height ?? 2, 0],
  };
}
