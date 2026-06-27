import { describe, expect, it } from "vitest";
import {
  buildPhotoAnalysisContext,
  mapPhotoAnalysisToEntry,
} from "../buildPhotoAnalysisContext";
import type { PhotoAnalysisResult } from "../../types/photoAnalysis";

describe("buildPhotoAnalysisContext", () => {
  it("includes location and incident type only (no stop message)", () => {
    const context = buildPhotoAnalysisContext({
      locationOfFire: "Blk 123",
      incidentTypeName: "Residential fire",
      stopMessage: "Stop message text should not be sent",
      fieldNotes: "Field notes text",
    });

    expect(context).toEqual({
      locationOfFire: "Blk 123",
      incidentTypeName: "Residential fire",
      fieldNotesExcerpt: "Field notes text",
    });
    expect(context.stopMessageExcerpt).toBeUndefined();
  });

  it("truncates long field notes", () => {
    const longText = "a".repeat(300);
    const context = buildPhotoAnalysisContext({
      fieldNotes: longText,
    });

    expect(context.fieldNotesExcerpt).toHaveLength(201);
    expect(context.fieldNotesExcerpt?.endsWith("…")).toBe(true);
  });

  it("returns empty context when no inputs", () => {
    expect(buildPhotoAnalysisContext({})).toEqual({});
  });
});

describe("mapPhotoAnalysisToEntry", () => {
  it("maps API result to caption fields only", () => {
    const result: PhotoAnalysisResult = {
      caption: "Charring on ceiling lining.",
      source: "ollama",
    };

    expect(mapPhotoAnalysisToEntry(result)).toEqual({
      caption: "Charring on ceiling lining.",
      captionSource: "ai",
    });
  });
});
