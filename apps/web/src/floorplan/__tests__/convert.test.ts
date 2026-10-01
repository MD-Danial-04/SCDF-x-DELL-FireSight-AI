import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convertRoomPlan, convertRoomPlanToSvg } from "../convert";
import { isFireSightRoomScan, projectFireSightWalls } from "../firesight";
import {
  DEFAULT_OBJECT_FOOTPRINT_INSET_M,
  deflateObjectBox,
  objectBoxCorners,
  orientedBoxesOverlap,
  projectFireSightObject,
  projectRoomPlanObject,
  resolveObjectBoxOverlaps,
} from "../objects";
import { RoomPlanParseError, normalizeFireSightScan, normalizeScan } from "../parse";
import { straightenFireSightScan } from "../straighten";
import { transformLocalToXZ } from "../matrix";
import { projectWallTo2D, segmentLength } from "../project";
import { applyOpeningGaps } from "../openings";
import { normalizeSvgForSnapshot } from "../svg";
import type { CapturedRoom, CapturedStructure, RoomPlanSurface } from "../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "__fixtures__");

function loadFixture(name: string): CapturedRoom | CapturedStructure {
  const raw = readFileSync(join(fixturesDir, name), "utf-8");
  return JSON.parse(raw) as CapturedRoom | CapturedStructure;
}

function loadRawFixture(name: string): unknown {
  const raw = readFileSync(join(fixturesDir, name), "utf-8");
  return JSON.parse(raw);
}

const FIRESIGHT_FIXTURE = "room-scan-193c4d-20260613-121455.json";

describe("parse", () => {
  it("normalizes CapturedRoom", () => {
    const scan = normalizeScan(loadFixture("rectangle-room.json"));
    expect(scan.walls).toHaveLength(4);
    expect(scan.openings).toHaveLength(0);
    expect(scan.objects).toEqual([]);
  });

  it("prefers merged top-level walls in CapturedStructure", () => {
    const scan = normalizeScan(loadFixture("captured-structure.json"));
    expect(scan.walls).toHaveLength(3);
    expect(scan.walls[0].identifier).toBe("merged-wall-a");
    expect(scan.openings).toHaveLength(1);
  });

  it("filters by story", () => {
    const input: CapturedRoom = {
      walls: [
        {
          identifier: "w0",
          story: 0,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          dimensions: [1, 2, 0],
        },
        {
          identifier: "w1",
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          dimensions: [1, 2, 0],
        },
      ],
    };
    const scan = normalizeScan(input, 0);
    expect(scan.walls).toHaveLength(1);
    expect(scan.walls[0].identifier).toBe("w0");
  });

  it("throws on empty walls", () => {
    expect(() => normalizeScan({ walls: [] })).toThrow(RoomPlanParseError);
  });
});

describe("project", () => {
  it("projects rectangular wall centerline", () => {
    const wall: RoomPlanSurface = {
      identifier: "test",
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1],
      dimensions: [4, 2.4, 0],
    };
    const seg = projectWallTo2D(wall);
    expect(seg.kind).toBe("segment");
    if (seg.kind === "segment") {
      expect(seg.start.x).toBeCloseTo(0, 4);
      expect(seg.end.x).toBeCloseTo(4, 4);
      expect(seg.start.z).toBeCloseTo(0, 4);
      expect(seg.end.z).toBeCloseTo(0, 4);
      expect(segmentLength(seg)).toBeCloseTo(4, 4);
    }
  });

  it("projects curved wall as arc", () => {
    const room = loadFixture("curved-wall-room.json");
    const arcWall = room.walls!.find((w) => w.identifier === "wall-arc")!;
    const prim = projectWallTo2D(arcWall);
    expect(prim.kind).toBe("arc");
  });

  it("projects polygonCorners centerline", () => {
    const wall: RoomPlanSurface = {
      identifier: "poly",
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      polygonCorners: [
        [-1, 0, 0],
        [1, 0, 0],
      ],
    };
    const seg = projectWallTo2D(wall);
    expect(seg.kind).toBe("segment");
    if (seg.kind === "segment") {
      expect(segmentLength(seg)).toBeCloseTo(2, 4);
    }
  });
});

describe("openings", () => {
  it("creates gap in parent wall", () => {
    const room = loadFixture("rectangle-with-opening.json");
    const scan = normalizeScan(room);
    const walls = scan.walls.map(projectWallTo2D);
    const { primitives } = applyOpeningGaps(walls, scan.openings);

    const northSegments = primitives.filter(
      (p) => p.kind === "segment" && p.wallId === "wall-north",
    );
    expect(northSegments.length).toBe(2);
  });
});

describe("convertRoomPlanToSvg", () => {
  it("produces valid SVG for rectangle room", () => {
    const svg = convertRoomPlanToSvg(loadFixture("rectangle-room.json"));
    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain("<svg");
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain("<line");
  });

  it("matches snapshot for rectangle room", () => {
    const svg = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadFixture("rectangle-room.json")),
    );
    expect(svg).toMatchSnapshot();
  });

  it("matches snapshot for rectangle with opening", () => {
    const svg = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadFixture("rectangle-with-opening.json")),
    );
    expect(svg).toMatchSnapshot();
  });

  it("ignores openings by default (continuous walls)", () => {
    const withOpening = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadFixture("rectangle-with-opening.json")),
    );
    const withoutOpening = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadFixture("rectangle-room.json")),
    );
    expect(withOpening).toBe(withoutOpening);
  });

  it("cuts opening gaps when includeOpeningGaps is true", () => {
    const svg = convertRoomPlanToSvg(loadFixture("rectangle-with-opening.json"), {
      includeOpeningGaps: true,
    });
    const lineCount = (svg.match(/<line/g) ?? []).length;
    expect(lineCount).toBeGreaterThan(4);
  });

  it("matches snapshot for L-shape room", () => {
    const svg = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadFixture("l-shape-room.json")),
    );
    expect(svg).toMatchSnapshot();
  });

  it("matches snapshot for curved wall room", () => {
    const svg = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadFixture("curved-wall-room.json")),
    );
    expect(svg).toMatchSnapshot();
  });

  it("matches snapshot for CapturedStructure", () => {
    const svg = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadFixture("captured-structure.json")),
    );
    expect(svg).toMatchSnapshot();
  });

  it("handles Stack Overflow sample wall", () => {
    const svg = convertRoomPlanToSvg(loadFixture("stackoverflow-sample.json"));
    expect(svg).toContain("<line");
    const wall = loadFixture("stackoverflow-sample.json").walls![0];
    const seg = projectWallTo2D(wall);
    if (seg.kind === "segment") {
      expect(segmentLength(seg)).toBeCloseTo(2.653, 2);
    }
  });

  it("uses meter-based viewBox with padding", () => {
    const svg = convertRoomPlanToSvg(loadFixture("rectangle-room.json"), {
      paddingM: 0.5,
    });
    expect(svg).toMatch(/viewBox="-0\.5 -0\.5 5 4"/);
  });

  it("renders object boxes for RoomPlan scan with objects", () => {
    const svg = convertRoomPlanToSvg(loadFixture("roomplan-with-objects.json"));
    expect(svg).toContain('data-layer="objects"');
    const objectsLayer =
      svg.match(/data-layer="objects"[\s\S]*?<\/g>/)?.[0] ?? "";
    expect(objectsLayer.match(/<rect/g) ?? []).toHaveLength(1);
  });
});

describe("object overlap", () => {
  it("deflateObjectBox shrinks dimensions and keeps center", () => {
    const box = {
      id: "a",
      center: { x: 1, z: 2 },
      widthM: 1,
      depthM: 0.8,
      rotationDeg: 0,
    };
    const deflated = deflateObjectBox(box, 0.025);
    expect(deflated.widthM).toBeCloseTo(0.95, 4);
    expect(deflated.depthM).toBeCloseTo(0.75, 4);
    expect(deflated.center).toEqual(box.center);
    expect(deflated.rotationDeg).toBe(0);
  });

  it("orientedBoxesOverlap detects overlapping and separated rects", () => {
    const a = {
      id: "a",
      center: { x: 0, z: 0 },
      widthM: 1,
      depthM: 1,
      rotationDeg: 0,
    };
    const b = {
      id: "b",
      center: { x: 0.5, z: 0 },
      widthM: 1,
      depthM: 1,
      rotationDeg: 0,
    };
    const c = {
      id: "c",
      center: { x: 3, z: 0 },
      widthM: 1,
      depthM: 1,
      rotationDeg: 45,
    };

    expect(orientedBoxesOverlap(a, b)).toBe(true);
    expect(orientedBoxesOverlap(a, c)).toBe(false);
  });

  it("resolveObjectBoxOverlaps separates overlapping boxes", () => {
    const boxes = [
      {
        id: "a",
        center: { x: 0, z: 0 },
        widthM: 1,
        depthM: 1,
        rotationDeg: 0,
      },
      {
        id: "b",
        center: { x: 0.5, z: 0 },
        widthM: 1,
        depthM: 1,
        rotationDeg: 0,
      },
    ];

    const resolved = resolveObjectBoxOverlaps(boxes);
    expect(orientedBoxesOverlap(resolved[0], resolved[1])).toBe(false);
  });

  it("separates overlapping objects in FireSight fixture conversion", () => {
    const doc = loadRawFixture("overlapping-objects.json");
    const scan = normalizeFireSightScan(
      doc as Parameters<typeof normalizeFireSightScan>[0],
    );
    const projected = scan.objects!.map(projectFireSightObject);
    expect(orientedBoxesOverlap(projected[0], projected[1])).toBe(true);

    const prepared = resolveObjectBoxOverlaps(
      projected.map((box) => deflateObjectBox(box, 0.05 / 2 + DEFAULT_OBJECT_FOOTPRINT_INSET_M)),
    );
    expect(orientedBoxesOverlap(prepared[0], prepared[1])).toBe(false);

    const svg = convertRoomPlanToSvg(doc);
    expect(svg).toContain('data-layer="objects"');
    const objectsLayer =
      svg.match(/data-layer="objects"[\s\S]*?<\/g>/)?.[0] ?? "";
    expect(objectsLayer.match(/<rect/g) ?? []).toHaveLength(2);
  });
});

describe("convertRoomPlan warnings", () => {
  it("warns when opening cannot match wall with gaps enabled", () => {
    const input: CapturedRoom = {
      walls: [
        {
          identifier: "only-wall",
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          dimensions: [2, 2, 0],
        },
      ],
      openings: [
        {
          identifier: "orphan",
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 10, 1],
          dimensions: [1, 2, 0],
        },
      ],
    };
    const { warnings } = convertRoomPlan(input, { includeOpeningGaps: true });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("orphan");
  });

  it("does not emit opening warnings when gaps are disabled", () => {
    const input: CapturedRoom = {
      walls: [
        {
          identifier: "only-wall",
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          dimensions: [2, 2, 0],
        },
      ],
      openings: [
        {
          identifier: "orphan",
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 10, 1],
          dimensions: [1, 2, 0],
        },
      ],
    };
    const { warnings } = convertRoomPlan(input);
    expect(warnings).toEqual([]);
  });
});

describe("firesight room scan", () => {
  it("detects FireSight schema from real fixture", () => {
    const doc = loadRawFixture(FIRESIGHT_FIXTURE);
    expect(isFireSightRoomScan(doc)).toBe(true);
  });

  it("normalizes FireSight scan with 4 walls", () => {
    const doc = loadRawFixture(FIRESIGHT_FIXTURE);
    const scan = normalizeFireSightScan(doc as Parameters<typeof normalizeFireSightScan>[0]);
    expect(scan.walls).toHaveLength(4);
    expect(scan.objects).toHaveLength(10);
  });

  it("projects FireSight object footprint from scan data", () => {
    const doc = loadRawFixture(FIRESIGHT_FIXTURE) as {
      objects: Array<{
        id: string;
        position: { x: number; y: number };
        width: number;
        depth: number;
        rotationDegrees: number;
      }>;
    };
    const object = doc.objects[0];
    const box = projectFireSightObject(object);
    expect(box.id).toBe(object.id);
    expect(box.center).toEqual({ x: object.position.x, z: object.position.y });
    expect(box.widthM).toBe(object.width);
    expect(box.depthM).toBe(object.depth);
    expect(box.rotationDeg).toBe(object.rotationDegrees);
    expect(objectBoxCorners(box)).toHaveLength(4);
  });

  it("projects RoomPlan object footprint from transform and dimensions", () => {
    const room = loadFixture("roomplan-with-objects.json") as CapturedRoom;
    const object = room.objects![0] as RoomPlanSurface;
    const box = projectRoomPlanObject(object);
    expect(box.id).toBe("table-1");
    expect(box.center).toEqual({ x: 2, z: 1.5 });
    expect(box.widthM).toBe(1.2);
    expect(box.depthM).toBe(0.6);
    expect(box.rotationDeg).toBeCloseTo(0, 4);
  });

  it("straightens FireSight object positions with walls", () => {
    const doc = loadRawFixture(FIRESIGHT_FIXTURE);
    const normalized = normalizeFireSightScan(
      doc as Parameters<typeof normalizeFireSightScan>[0],
    );
    const before = normalized.objects![0];
    const { scan } = straightenFireSightScan(normalized, 0.05);
    const after = scan.objects![0];
    expect(after.position.x).not.toBe(before.position.x);
    expect(after.position.y).not.toBe(before.position.y);
    expect(after.rotationDegrees).not.toBe(before.rotationDegrees);
  });

  it("produces valid SVG for real FireSight fixture", () => {
    const svg = convertRoomPlanToSvg(loadRawFixture(FIRESIGHT_FIXTURE));
    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain("<svg");
    expect(svg).toContain('data-layer="walls"');
    expect(svg).toContain('data-layer="openings"');
    expect(svg).toMatch(/data-layer="openings"[^>]*stroke="#000000"/);
    expect(svg).toContain("<path");
    const wallLines =
      svg.match(/data-layer="walls"[\s\S]*?<\/g>/)?.[0].match(/<line/g) ?? [];
    expect(wallLines.length).toBe(8);
    const openingsLayer =
      svg.match(/data-layer="openings"[\s\S]*?<\/g>/)?.[0] ?? "";
    const openingLines = openingsLayer.match(/<line/g) ?? [];
    expect(openingLines.length).toBe(13);
    expect(openingsLayer.match(/<polygon/g) ?? []).toHaveLength(3);
    expect(svg).toContain('data-layer="objects"');
    const objectsLayer =
      svg.match(/data-layer="objects"[\s\S]*?<\/g>/)?.[0] ?? "";
    expect(objectsLayer.match(/<rect/g) ?? []).toHaveLength(10);
    expect(svg).toContain('data-layer="labels"');
    expect(svg).toContain(">Room</text>");

    const wallsLayer = svg.match(/data-layer="walls"[\s\S]*?<\/g>/)?.[0] ?? "";
    const leftWallLines = [
      ...wallsLayer.matchAll(
        /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)" \/>/g,
      ),
    ].filter((m) => {
      const x1 = Number(m[1]);
      const x2 = Number(m[3]);
      return Math.abs(x1 - x2) < 1e-6 && Math.abs(x1 - (-3.91)) < 0.02;
    });
    expect(leftWallLines).toHaveLength(4);

    const windowJambYs = [
      ...openingsLayer.matchAll(
        /<line x1="-3\.8[^"]*" y1="([^"]+)" x2="-3\.9[^"]*" y2="\1" \/>/g,
      ),
    ].map((m) => Number(m[1]));
    expect(windowJambYs).toHaveLength(6);
    const windowGapEnds = leftWallLines.flatMap((m) => [
      Number(m[2]),
      Number(m[4]),
    ]);
    for (const jambY of windowJambYs) {
      expect(
        windowGapEnds.some((y) => Math.abs(y - jambY) < 0.02),
      ).toBe(true);
    }
  });

  it("forms a perfect axis-aligned rectangle after straightening", () => {
    const doc = loadRawFixture(FIRESIGHT_FIXTURE);
    const { scan } = straightenFireSightScan(
      normalizeFireSightScan(doc as Parameters<typeof normalizeFireSightScan>[0]),
      0.05,
    );
    const segments = projectFireSightWalls(scan.walls);
    const xs = new Set<number>();
    const zs = new Set<number>();
    for (const seg of segments) {
      xs.add(seg.start.x);
      xs.add(seg.end.x);
      zs.add(seg.start.z);
      zs.add(seg.end.z);
    }
    expect(xs.size).toBe(2);
    expect(zs.size).toBe(2);
    for (const seg of segments) {
      const horizontal = Math.abs(seg.end.x - seg.start.x) >= Math.abs(seg.end.z - seg.start.z);
      if (horizontal) {
        expect(seg.start.z).toBe(seg.end.z);
      } else {
        expect(seg.start.x).toBe(seg.end.x);
      }
    }
  });

  it("straightens near-rectangular FireSight rooms to cardinal angles", () => {
    const doc = loadRawFixture(FIRESIGHT_FIXTURE);
    const { scan } = straightenFireSightScan(
      normalizeFireSightScan(doc as Parameters<typeof normalizeFireSightScan>[0]),
      0.05,
    );
    const segments = projectFireSightWalls(scan.walls);
    for (const seg of segments) {
      const angle =
        (Math.atan2(seg.end.z - seg.start.z, seg.end.x - seg.start.x) * 180) /
        Math.PI;
      const nearest = Math.round(angle / 90) * 90;
      expect(Math.abs(angle - nearest)).toBeLessThan(0.1);
    }
  });

  it("renders door swing arc inside the room", () => {
    const svg = convertRoomPlanToSvg(loadRawFixture(FIRESIGHT_FIXTURE));
    const openingsLayer =
      svg.match(/data-layer="openings"[\s\S]*?<\/g>/)?.[0] ?? "";
    const doorPath = openingsLayer.match(/<path[^>]*\/>/)?.[0];
    expect(doorPath).toBeTruthy();
    expect(doorPath).toMatch(/A [\d.]+ [\d.]+ 0 0/);
    expect(openingsLayer).toContain("<line");
  });

  it("matches snapshot for real FireSight fixture", () => {
    const svg = normalizeSvgForSnapshot(
      convertRoomPlanToSvg(loadRawFixture(FIRESIGHT_FIXTURE)),
    );
    expect(svg).toMatchSnapshot();
  });

  it("cuts opening gaps when includeOpeningGaps is true", () => {
    const svg = convertRoomPlanToSvg(loadRawFixture(FIRESIGHT_FIXTURE), {
      includeOpeningGaps: true,
      straighten: true,
    });
    const wallLines =
      svg.match(/data-layer="walls"[\s\S]*?<\/g>/)?.[0].match(/<line/g) ?? [];
    expect(wallLines.length).toBe(8);
  });

  it("can disable straightening and opening gaps for FireSight", () => {
    const svg = convertRoomPlanToSvg(loadRawFixture(FIRESIGHT_FIXTURE), {
      straighten: false,
      includeOpeningGaps: false,
    });
    const wallLines =
      svg.match(/data-layer="walls"[\s\S]*?<\/g>/)?.[0].match(/<line/g) ?? [];
    expect(wallLines.length).toBe(4);
    expect(svg).toContain('data-layer="openings"');
    expect(svg).toContain("<path");
  });

  it("throws on empty FireSight walls", () => {
    expect(() =>
      normalizeFireSightScan({
        schemaVersion: "firesight-room-scan/v1",
        walls: [],
      }),
    ).toThrow(RoomPlanParseError);
  });
});

describe("matrix", () => {
  it("transforms local points to world XZ", () => {
    const p = transformLocalToXZ(
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 3, 1],
      { x: 0, y: 0, z: 0 },
    );
    expect(p.x).toBeCloseTo(2, 4);
    expect(p.z).toBeCloseTo(3, 4);
  });
});
