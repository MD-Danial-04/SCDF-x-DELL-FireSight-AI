import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { importRoomPlanFloorplan } from "../../app/lib/importRoomPlanFloorplan";

vi.mock("../../app/lib/svgToAnnexPng", () => ({
  svgStringToAnnexPngBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "__fixtures__");

function jsonFile(name: string): File {
  const content = readFileSync(join(fixturesDir, name), "utf-8");
  return new File([content], name, { type: "application/json" });
}

describe("importRoomPlanFloorplan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts fixture JSON to PNG blob", async () => {
    const result = await importRoomPlanFloorplan(jsonFile("rectangle-room.json"));
    expect(result.pngBlob.type).toBe("image/png");
    expect(result.warnings).toEqual([]);
  });

  it("does not return opening warnings when gaps are disabled", async () => {
    const invalidOpening = {
      walls: [
        {
          identifier: "w1",
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          dimensions: [2, 2, 0],
        },
      ],
      openings: [
        {
          identifier: "o1",
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 50, 0, 50, 1],
          dimensions: [1, 2, 0],
        },
      ],
    };
    const file = new File([JSON.stringify(invalidOpening)], "room.json", {
      type: "application/json",
    });
    const result = await importRoomPlanFloorplan(file);
    expect(result.pngBlob.type).toBe("image/png");
    expect(result.warnings).toEqual([]);
  });

  it("throws on invalid JSON", async () => {
    const file = new File(["not json"], "bad.json", { type: "application/json" });
    await expect(importRoomPlanFloorplan(file)).rejects.toThrow(/Invalid JSON/);
  });

  it("throws on empty scan", async () => {
    const file = new File(['{"walls":[]}'], "empty.json", {
      type: "application/json",
    });
    await expect(importRoomPlanFloorplan(file)).rejects.toThrow(/No walls found/);
  });
});
