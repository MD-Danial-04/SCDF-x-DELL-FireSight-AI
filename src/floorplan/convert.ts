import { cleanupPrimitives } from "./cleanup";
import { applyOpeningGaps } from "./openings";
import { normalizeScan, parseRoomPlanJson } from "./parse";
import { projectAllWalls } from "./project";
import { buildSvg } from "./svg";
import {
  DEFAULT_CONVERT_OPTIONS,
  type ConvertOptions,
  type RoomPlanInput,
} from "./types";

export interface ConvertResult {
  svg: string;
  warnings: string[];
}

export function convertRoomPlanToSvg(
  input: RoomPlanInput | string,
  options?: ConvertOptions,
): string {
  return convertRoomPlan(input, options).svg;
}

export function convertRoomPlan(
  input: RoomPlanInput | string,
  options?: ConvertOptions,
): ConvertResult {
  const opts = { ...DEFAULT_CONVERT_OPTIONS, ...options };
  const parsed =
    typeof input === "string" ? parseRoomPlanJson(input) : input;

  const scan = normalizeScan(parsed, opts.story);
  const wallPrimitives = projectAllWalls(scan.walls);
  let primitives = wallPrimitives;
  let openingWarnings: string[] = [];
  if (opts.includeOpeningGaps) {
    const gapResult = applyOpeningGaps(wallPrimitives, scan.openings);
    primitives = gapResult.primitives;
    openingWarnings = gapResult.warnings.map((w) => w.message);
  }
  const cleaned = cleanupPrimitives(primitives, opts.snapToleranceM);

  const svg = buildSvg(cleaned, {
    strokeWidthM: opts.strokeWidthM,
    paddingM: opts.paddingM,
  });

  return {
    svg,
    warnings: openingWarnings,
  };
}
