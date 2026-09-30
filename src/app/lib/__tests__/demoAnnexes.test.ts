import { afterEach, describe, expect, it, vi } from "vitest";
import { getAnnexById, getRequiredPageIndices } from "../../constants/annexDefinitions";
import { generateAnnexDBlobs, generateAnnexFBlobs, wrapPhotoText } from "../photoLogAnnexes";
import type { PhotoLogEntry } from "../../types/photoLog";

function photos(count: number): PhotoLogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i), uid: `LIVE_${i}`, fileName: `${i}.png`,
    blob: new Blob(["photo"], { type: "image/png" }), caption: `Caption ${i}`,
  }));
}

function mockCanvas() {
  const text: string[] = [];
  const context = {
    scale: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: (value: string) => text.push(value),
    measureText: (value: string) => ({ width: value.length * 9 }),
  };
  vi.stubGlobal("document", { createElement: () => ({
    width: 0, height: 0, getContext: () => context,
    toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])),
  }) });
  vi.stubGlobal("Image", class {
    naturalWidth = 640; naturalHeight = 480;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  return text;
}

afterEach(() => vi.unstubAllGlobals());

describe("demo annex replacement", () => {
  it("maps all four sections and removes the two obsolete F pages", () => {
    expect(getAnnexById("A")?.title).toContain("Section 1");
    expect(getAnnexById("B")?.title).toContain("Section 2");
    expect(getAnnexById("F")?.title).toContain("Section 3");
    expect(getAnnexById("D")?.title).toContain("Section 4");
    expect(getRequiredPageIndices(["A", "B", "D", "F"])).toEqual([0, 1, 3, 5]);
    expect(getRequiredPageIndices(["C", "E", "G"])).toEqual([2, 4, 8]);
  });

  it("generates three photos per repository page with live labels", async () => {
    const text = mockCanvas();
    const result = await generateAnnexFBlobs(photos(4));
    expect(result).toHaveLength(2);
    expect(text).toContain("3 - 02");
    expect(text).toContain("PHOTO 04:");
    expect(text).not.toContain("PHOTO 05:");
    for (let i = 0; i < 4; i++) expect(text).toContain(`LIVE_${i}`);
  });

  it("flows description rows and keeps long captions on continuation pages", async () => {
    const text = mockCanvas();
    const data = photos(6);
    data[0].caption = Array.from({ length: 150 }, (_, i) => `word${i}`).join(" ");
    const result = await generateAnnexDBlobs(data);
    expect(result.length).toBeGreaterThan(2);
    expect(text.join(" ")).toContain("word149");
    for (let i = 0; i < 6; i++) expect(text).toContain(`LIVE_${i}`);
  });

  it("wraps unbroken IDs and returns no pages for an empty photo log", async () => {
    expect(wrapPhotoText({ measureText: (value) => ({ width: value.length } as TextMetrics) }, "ABCDEFG", 3)).toEqual(["ABC", "DEF", "G"]);
    expect(await generateAnnexDBlobs([])).toEqual([]);
    expect(await generateAnnexFBlobs([])).toEqual([]);
  });
});
