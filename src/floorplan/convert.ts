import { cleanupPrimitives } from "./cleanup";
import {
  fireSightOpeningToSurface,
  isFireSightRoomScan,
  projectFireSightWalls,
  type FireSightOpening,
} from "./firesight";
import {
  buildFireSightOpeningMarkers,
  MARKER_STROKE_WIDTH_M,
} from "./openingMarkers";
import {
  DEFAULT_OBJECT_FOOTPRINT_INSET_M,
  deflateObjectBox,
  layoutObjectBoxes,
  projectFireSightObject,
  projectRoomPlanObject,
  resolveObjectBoxOverlaps,
  type ObjectBox2D,
} from "./objects";
import { applyOpeningGaps } from "./openings";
import { normalizeFireSightScan, normalizeScan, parseRoomPlanJson } from "./parse";
import { projectAllWalls } from "./project";
import { straightenFireSightScan } from "./straighten";
import { computeRoomCenter, roomLabelFontSizeM } from "./roomLabel";
import { buildSvg } from "./svg";
import {
  DEFAULT_CONVERT_OPTIONS,
  type ConvertOptions,
  type RoomPlanInput,
  type RoomPlanSurface,
  type Segment2D,
} from "./types";

function resolveOptions(
  options: ConvertOptions | undefined,
  isFireSight: boolean,
): Required<ConvertOptions> {
  return {
    ...DEFAULT_CONVERT_OPTIONS,
    ...options,
    straighten: options?.straighten ?? (isFireSight ? true : false),
    includeOpeningGaps:
      options?.includeOpeningGaps ?? (isFireSight ? true : false),
  };
}

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
  const parsed: unknown =
    typeof input === "string" ? parseRoomPlanJson(input) : input;
  const isFireSight = isFireSightRoomScan(parsed);
  const opts = resolveOptions(options, isFireSight);

  let wallPrimitives;
  let openingSurfaces: RoomPlanSurface[];
  let fireSightOpenings: FireSightOpening[] = [];
  let objectBoxes: ObjectBox2D[] = [];
  let roomLabel: { text: string; center: { x: number; z: number }; fontSizeM: number } | undefined;

  if (isFireSight) {
    let scan = normalizeFireSightScan(parsed);
    if (opts.straighten) {
      ({ scan } = straightenFireSightScan(scan, opts.snapToleranceM));
    }
    wallPrimitives = projectFireSightWalls(scan.walls);
    fireSightOpenings = scan.openings ?? [];
    objectBoxes = (scan.objects ?? []).map(projectFireSightObject);
    const cutOpenings = fireSightOpenings.filter(
      (o) => o.kind === "door" || o.kind === "window",
    );
    openingSurfaces = cutOpenings.map(fireSightOpeningToSurface);

    const wallSegments = wallPrimitives.filter(
      (wall): wall is Segment2D => wall.kind === "segment",
    );
    roomLabel = {
      text: "Room",
      center: computeRoomCenter(wallSegments),
      fontSizeM: roomLabelFontSizeM(wallSegments),
    };
  } else {
    const scan = normalizeScan(parsed as RoomPlanInput, opts.story);
    wallPrimitives = projectAllWalls(scan.walls);
    openingSurfaces = scan.openings;
    objectBoxes = scan.objects.map(projectRoomPlanObject);
  }

  const wallsForMarkers = wallPrimitives;
  let primitives = wallPrimitives;
  let openingWarnings: string[] = [];
  if (opts.includeOpeningGaps) {
    const gapResult = applyOpeningGaps(wallPrimitives, openingSurfaces);
    primitives = gapResult.primitives;
    openingWarnings = gapResult.warnings.map((w) => w.message);
  }
  const cleaned = cleanupPrimitives(primitives, opts.snapToleranceM);

  const openingMarkers = isFireSight
    ? buildFireSightOpeningMarkers(fireSightOpenings, wallsForMarkers)
    : [];

  if (objectBoxes.length > 0) {
    const insetM = opts.strokeWidthM / 2 + DEFAULT_OBJECT_FOOTPRINT_INSET_M;
    const wallSegments = cleaned.filter(
      (wall): wall is Segment2D => wall.kind === "segment",
    );
    objectBoxes = layoutObjectBoxes(
      resolveObjectBoxOverlaps(
        objectBoxes.map((box) => deflateObjectBox(box, insetM)),
      ),
      wallSegments,
      insetM,
    );
  }

  const svg = buildSvg(cleaned, {
    strokeWidthM: opts.strokeWidthM,
    paddingM: opts.paddingM,
    openingMarkers,
    openingStrokeWidthM: MARKER_STROKE_WIDTH_M,
    roomLabel,
    objects: objectBoxes,
  });

  return {
    svg,
    warnings: openingWarnings,
  };
}
