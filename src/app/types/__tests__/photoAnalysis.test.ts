import { describe, expect, it } from "vitest";
import {
  isSuggestedPhotoSection,
  resolveSuggestedSection,
  SUGGESTED_SECTION_CONFIDENCE_THRESHOLD,
  SUGGESTED_SECTION_TO_PHOTO_REF,
} from "../photoAnalysis";

describe("photoAnalysis taxonomy", () => {
  it("maps each section to exactly one photo ref field", () => {
    expect(SUGGESTED_SECTION_TO_PHOTO_REF.incident).toBe("incidentPhotosRef");
    expect(SUGGESTED_SECTION_TO_PHOTO_REF.damages).toBe("damagesPhotoRef");
    expect(SUGGESTED_SECTION_TO_PHOTO_REF.area_of_origin).toBe("areaOfOriginPhotoRef");
    expect(SUGGESTED_SECTION_TO_PHOTO_REF.burn_patterns).toBe("burnPatternsPhotoRef");
    expect(SUGGESTED_SECTION_TO_PHOTO_REF["evidentiary"]).toBe("evidentiaryPhotoRef");
  });

  it("recognizes valid section strings", () => {
    expect(isSuggestedPhotoSection("burn_patterns")).toBe(true);
    expect(isSuggestedPhotoSection("vehicle")).toBe(false);
    expect(isSuggestedPhotoSection("appliance")).toBe(false);
  });

  it("nulls section when confidence is below threshold", () => {
    expect(resolveSuggestedSection("damages", SUGGESTED_SECTION_CONFIDENCE_THRESHOLD)).toBe(
      "damages",
    );
    expect(
      resolveSuggestedSection("damages", SUGGESTED_SECTION_CONFIDENCE_THRESHOLD - 0.01),
    ).toBeNull();
    expect(resolveSuggestedSection(null, 0.9)).toBeNull();
  });
});
