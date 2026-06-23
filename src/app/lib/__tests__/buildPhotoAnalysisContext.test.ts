import { describe, expect, it } from "vitest";
import {
  PRIOR_PHOTOS_HEADER,
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

  it("uses compact prior summaries with section and detected elements", () => {
    const context = buildPhotoAnalysisContext(
      { fieldNotes: "Investigator notes" },
      [
        {
          number: 1,
          uid: "IMG_001",
          suggestedSection: "burn_patterns",
          detectedElements: ["ceiling charring", "smoke staining"],
          caption: "Long narrative that should not appear in full.",
        },
        {
          number: 2,
          uid: "IMG_002",
          suggestedSection: "area_of_origin",
          detectedElements: ["rubbish chute opening"],
        },
      ],
    );

    expect(context.fieldNotesExcerpt).toContain("Investigator notes");
    expect(context.fieldNotesExcerpt).toContain(PRIOR_PHOTOS_HEADER);
    expect(context.fieldNotesExcerpt).toContain(
      "Photo 1 (IMG_001) [burn_patterns] ceiling charring, smoke staining",
    );
    expect(context.fieldNotesExcerpt).toContain(
      "Photo 2 (IMG_002) [area_of_origin] rubbish chute opening",
    );
    expect(context.fieldNotesExcerpt).not.toContain("Long narrative");
  });

  it("limits prior photo summaries to the 3 most recent", () => {
    const prior = Array.from({ length: 5 }, (_, index) => ({
      number: index + 1,
      uid: `IMG_00${index + 1}`,
      detectedElements: [`element-${index + 1}`],
    }));

    const context = buildPhotoAnalysisContext({}, prior);

    expect(context.fieldNotesExcerpt).not.toContain("Photo 1 (IMG_001)");
    expect(context.fieldNotesExcerpt).not.toContain("Photo 2 (IMG_002)");
    expect(context.fieldNotesExcerpt).toContain("Photo 3 (IMG_003)");
    expect(context.fieldNotesExcerpt).toContain("Photo 4 (IMG_004)");
    expect(context.fieldNotesExcerpt).toContain("Photo 5 (IMG_005)");
  });

  it("returns only prior summaries when no field notes", () => {
    const context = buildPhotoAnalysisContext({}, [
      {
        number: 1,
        uid: "abc",
        detectedElements: ["soot staining"],
      },
    ]);

    expect(context.fieldNotesExcerpt).toBe(
      `${PRIOR_PHOTOS_HEADER}\nPhoto 1 (abc) soot staining`,
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
      sectionCandidates: undefined,
      detectedElements: ["ceiling charring"],
    });
  });

  it("maps section_candidates onto the photo log entry", () => {
    const result: PhotoAnalysisResult = {
      ...baseResult,
      section_candidates: {
        burn_patterns: { score: 0.85, reason: "ceiling charring" },
        area_of_origin: { score: 0.6, reason: "localized burn seat" },
      },
    };

    expect(mapPhotoAnalysisToEntry(result).sectionCandidates).toEqual({
      burn_patterns: { score: 0.85, reason: "ceiling charring" },
      area_of_origin: { score: 0.6, reason: "localized burn seat" },
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
