import {
  type FireSightObject,
  type FireSightRoomScan,
  type FireSightWall,
  isFireSightRoomScan,
} from "./firesight";
import type {
  CapturedRoom,
  CapturedStructure,
  NormalizedScan,
  RoomPlanInput,
  RoomPlanSurface,
} from "./types";

export { isFireSightRoomScan };

export class RoomPlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomPlanParseError";
  }
}

function isCapturedStructure(input: RoomPlanInput): input is CapturedStructure {
  return Array.isArray((input as CapturedStructure).rooms);
}

function filterByStory(
  surfaces: RoomPlanSurface[] | undefined,
  story: number,
): RoomPlanSurface[] {
  if (!surfaces) return [];
  return surfaces.filter((s) => (s.story ?? 0) === story);
}

function validateSurface(surface: RoomPlanSurface, label: string): void {
  if (!surface.identifier) {
    throw new RoomPlanParseError(`${label} missing identifier`);
  }
  if (!surface.transform || surface.transform.length !== 16) {
    throw new RoomPlanParseError(
      `${label} ${surface.identifier} missing valid 4x4 transform`,
    );
  }
  const hasDimensions =
    Array.isArray(surface.dimensions) && surface.dimensions.length === 3;
  const hasPolygon =
    Array.isArray(surface.polygonCorners) &&
    surface.polygonCorners.length > 0;
  const hasCurve = surface.curve != null;
  if (!hasDimensions && !hasPolygon && !hasCurve) {
    throw new RoomPlanParseError(
      `${label} ${surface.identifier} needs dimensions, polygonCorners, or curve`,
    );
  }
}

function validateObjectSurface(surface: RoomPlanSurface, label: string): void {
  if (!surface.identifier) {
    throw new RoomPlanParseError(`${label} missing identifier`);
  }
  if (!surface.transform || surface.transform.length !== 16) {
    throw new RoomPlanParseError(
      `${label} ${surface.identifier} missing valid 4x4 transform`,
    );
  }
  if (
    !Array.isArray(surface.dimensions) ||
    surface.dimensions.length !== 3 ||
    surface.dimensions[0] <= 0 ||
    surface.dimensions[2] <= 0
  ) {
    throw new RoomPlanParseError(
      `${label} ${surface.identifier} needs positive width and depth dimensions`,
    );
  }
}

function validateFireSightObject(
  object: unknown,
  index: number,
): FireSightObject | null {
  if (!object || typeof object !== "object") return null;
  const record = object as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== "string" || !id) return null;
  if (!isFireSightPoint(record.position)) return null;
  if (typeof record.width !== "number" || record.width <= 0) return null;
  if (typeof record.depth !== "number" || record.depth <= 0) return null;
  const rotationDegrees =
    typeof record.rotationDegrees === "number" ? record.rotationDegrees : 0;
  return {
    id,
    position: record.position,
    width: record.width,
    depth: record.depth,
    rotationDegrees,
  };
}

function normalizeFireSightObjects(
  objects: unknown[] | undefined,
): FireSightObject[] {
  if (!Array.isArray(objects)) return [];
  return objects
    .map((object, index) => validateFireSightObject(object, index))
    .filter((object): object is FireSightObject => object !== null);
}
function isFireSightPoint(value: unknown): value is { x: number; y: number } {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number"
  );
}

function validateFireSightWall(wall: unknown, index: number): FireSightWall {
  if (!wall || typeof wall !== "object") {
    throw new RoomPlanParseError(`Wall ${index + 1} is invalid`);
  }
  const record = wall as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== "string" || !id) {
    throw new RoomPlanParseError(`Wall ${index + 1} missing id`);
  }
  if (!isFireSightPoint(record.start)) {
    throw new RoomPlanParseError(`Wall ${id} missing valid start point`);
  }
  if (!isFireSightPoint(record.end)) {
    throw new RoomPlanParseError(`Wall ${id} missing valid end point`);
  }
  return {
    id,
    start: record.start,
    end: record.end,
  };
}

export function normalizeFireSightScan(doc: FireSightRoomScan): FireSightRoomScan {
  if (!Array.isArray(doc.walls) || doc.walls.length === 0) {
    throw new RoomPlanParseError("No walls found in room scan");
  }
  const walls = doc.walls.map(validateFireSightWall);
  const objects = normalizeFireSightObjects(doc.objects as unknown[] | undefined);
  return { ...doc, walls, objects };
}

export function parseRoomPlanJson(json: string): RoomPlanInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new RoomPlanParseError("Invalid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new RoomPlanParseError("Expected a JSON object");
  }
  return parsed as RoomPlanInput;
}

export function normalizeScan(
  input: RoomPlanInput,
  story = 0,
): NormalizedScan {
  let walls: RoomPlanSurface[];
  let openings: RoomPlanSurface[];
  let objects: RoomPlanSurface[];

  if (isCapturedStructure(input) && input.walls) {
    walls = filterByStory(input.walls, story);
    openings = filterByStory(input.openings, story);
    objects = filterByStory(input.objects as RoomPlanSurface[] | undefined, story);
  } else {
    const room = input as CapturedRoom;
    walls = filterByStory(room.walls, story);
    openings = filterByStory(room.openings, story);
    objects = filterByStory(room.objects as RoomPlanSurface[] | undefined, story);
  }

  if (walls.length === 0) {
    throw new RoomPlanParseError("No walls found for the selected story");
  }

  for (const wall of walls) {
    validateSurface(wall, "Wall");
  }
  for (const opening of openings) {
    validateSurface(opening, "Opening");
  }
  for (const object of objects) {
    validateObjectSurface(object, "Object");
  }

  return { walls, openings, objects };
}
