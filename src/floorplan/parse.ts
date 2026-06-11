import type {
  CapturedRoom,
  CapturedStructure,
  NormalizedScan,
  RoomPlanInput,
  RoomPlanSurface,
} from "./types";

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

  if (isCapturedStructure(input) && input.walls) {
    walls = filterByStory(input.walls, story);
    openings = filterByStory(input.openings, story);
  } else {
    const room = input as CapturedRoom;
    walls = filterByStory(room.walls, story);
    openings = filterByStory(room.openings, story);
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

  return { walls, openings };
}
