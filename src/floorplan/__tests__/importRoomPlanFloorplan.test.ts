import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convertRoomPlanFile } from "../../app/lib/importRoomPlanFloorplan";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "__fixtures__");

function jsonFile(name: string): File {
  const content = readFileSync(join(fixturesDir, name), "utf-8");
  return new File([content], name, { type: "application/json" });
}

describe("convertRoomPlanFile", () => {
  it("converts fixture JSON to SVG", async () => {
    const result = await convertRoomPlanFile(jsonFile("rectangle-room.json"));
    expect(result.svg).toContain("<svg");
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
    const result = await convertRoomPlanFile(file);
    expect(result.svg).toContain("<svg");
    expect(result.warnings).toEqual([]);
  });

  it("throws on invalid JSON", async () => {
    const file = new File(["not json"], "bad.json", { type: "application/json" });
    await expect(convertRoomPlanFile(file)).rejects.toThrow(/Invalid JSON/);
  });

  it("throws on empty scan", async () => {
    const file = new File(['{"walls":[]}'], "empty.json", {
      type: "application/json",
    });
    await expect(convertRoomPlanFile(file)).rejects.toThrow(/No walls found/);
  });

  it("converts FireSight room-scan JSON to SVG", async () => {
    const result = await convertRoomPlanFile(
      jsonFile("room-scan-193c4d-20260613-121455.json"),
    );
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain('data-layer="openings"');
    expect(result.svg).toMatch(/data-layer="openings"[^>]*stroke="#000000"/);
    expect(result.svg).toContain("<path");
    const wallLines =
      result.svg.match(/data-layer="walls"[\s\S]*?<\/g>/)?.[0].match(/<line/g) ??
      [];
    expect(wallLines.length).toBe(8);
    const openingLines =
      result.svg.match(/data-layer="openings"[\s\S]*?<\/g>/)?.[0].match(/<line/g) ??
      [];
    expect(openingLines.length).toBe(13);
    expect(result.svg).toContain('data-layer="objects"');
    const objectsLayer =
      result.svg.match(/data-layer="objects"[\s\S]*?<\/g>/)?.[0] ?? "";
    expect(objectsLayer.match(/<rect/g) ?? []).toHaveLength(10);
    expect(result.svg).toContain(">Room</text>");
    expect(result.warnings).toEqual([]);
  });
});
