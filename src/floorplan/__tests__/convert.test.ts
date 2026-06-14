import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convertRoomPlan, convertRoomPlanToSvg } from "../convert";
import { RoomPlanParseError, normalizeScan } from "../parse";
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

describe("parse", () => {
  it("normalizes CapturedRoom", () => {
    const scan = normalizeScan(loadFixture("rectangle-room.json"));
    expect(scan.walls).toHaveLength(4);
    expect(scan.openings).toHaveLength(0);
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
