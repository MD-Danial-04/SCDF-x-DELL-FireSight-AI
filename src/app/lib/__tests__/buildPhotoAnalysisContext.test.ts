import { describe, expect, it } from "vitest";
import {
  buildPhotoAnalysisContext,
  mapPhotoAnalysisToEntry,
} from "../buildPhotoAnalysisContext";
import type { PhotoAnalysisResult } from "../../types/photoAnalysis";

describe("buildPhotoAnalysisContext", () => {
  it("includes report context fields when provided", () => {
    const context = buildPhotoAnalysisContext({
      locationOfFire: "Blk 123",
      incidentTypeName: "Residential fire",
      stopMessage: "Stop message text",
      fieldNotes: "Field notes text",
    });

    expect(context).toEqual({
      locationOfFire: "Blk 123",
      incidentTypeName: "Residential fire",
      stopMessageExcerpt: "Stop message text",
      fieldNotesExcerpt: "Field notes text",
    });
  });

  it("truncates long excerpts", () => {
    const longText = "a".repeat(600);
    const context = buildPhotoAnalysisContext({
      stopMessage: longText,
      fieldNotes: longText,
    });

    expect(context.stopMessageExcerpt).toHaveLength(501);
    expect(context.stopMessageExcerpt?.endsWith("…")).toBe(true);
    expect(context.fieldNotesExcerpt).toHaveLength(501);
  });

  it("includes prior captions in field_notes_excerpt for narrative consistency", () => {
    const context = buildPhotoAnalysisContext(
      { fieldNotes: "Investigator notes" },
      [
        { number: 1, uid: "IMG_001", caption: "Burnt couch in living room." },
        { number: 2, uid: "IMG_002", caption: "Ceiling charring above seating." },
      ],
    );

    expect(context.fieldNotesExcerpt).toContain("Investigator notes");
    expect(context.fieldNotesExcerpt).toContain(
      "Prior photo log captions (keep narrative consistent with these):",
    );
    expect(context.fieldNotesExcerpt).toContain(
      "Photo 1 (UID IMG_001): Burnt couch in living room.",
    );
    expect(context.fieldNotesExcerpt).toContain(
      "Photo 2 (UID IMG_002): Ceiling charring above seating.",
    );
  });

  it("returns only prior captions when no field notes", () => {
    const context = buildPhotoAnalysisContext({}, [
      { number: 1, uid: "abc", caption: "Scene overview." },
    ]);

    expect(context.fieldNotesExcerpt).toBe(
      "Prior photo log captions (keep narrative consistent with these):\nPhoto 1 (UID abc): Scene overview.",
    );
  });

  it("returns empty context when no inputs", () => {
    expect(buildPhotoAnalysisContext({})).toEqual({});
  });
});

describe("mapPhotoAnalysisToEntry", () => {
  const baseResult: PhotoAnalysisResult = {
    caption: "Charring on ceiling lining.",
    detected_elements: ["ceiling charring"],
    suggested_section: "burn_patterns",
    confidence: { caption: 0.9, suggested_section: 0.78 },
    source: "ollama",
  };

  it("maps API result to photo log entry fields", () => {
    expect(mapPhotoAnalysisToEntry(baseResult)).toEqual({
      caption: "Charring on ceiling lining.",
      captionSource: "ai",
      suggestedSection: "burn_patterns",
      suggestedSectionConfidence: 0.78,
      detectedElements: ["ceiling charring"],
    });
  });

  it("nulls suggested section when confidence is below threshold", () => {
    const result: PhotoAnalysisResult = {
      ...baseResult,
      confidence: { caption: 0.9, suggested_section: 0.5 },
    };

    expect(mapPhotoAnalysisToEntry(result).suggestedSection).toBeNull();
  });
});
