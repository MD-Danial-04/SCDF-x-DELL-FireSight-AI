import { describe, expect, it } from "vitest";
import {
  isSuggestedPhotoSection,
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
});
