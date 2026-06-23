import { describe, expect, it } from "vitest";
import { applyPhotoSectionRef } from "../applyPhotoSectionRef";
import { DEFAULT_PHOTO_REF_PLACEHOLDERS } from "../../types/photoAnalysis";

describe("applyPhotoSectionRef", () => {
  it("replaces damages placeholder with See Photo N", () => {
    expect(
      applyPhotoSectionRef(
        DEFAULT_PHOTO_REF_PLACEHOLDERS.damages,
        "damages",
        3,
      ),
    ).toBe("See Photo 3");
  });

  it("replaces area_of_origin placeholder with See Photo N", () => {
    expect(
      applyPhotoSectionRef(
        DEFAULT_PHOTO_REF_PLACEHOLDERS.area_of_origin,
        "area_of_origin",
        2,
      ),
    ).toBe("See Photo 2");
  });

  it("appends photo number when field already has a reference", () => {
    expect(applyPhotoSectionRef("See Photo 1", "burn_patterns", 4)).toBe(
      "See Photo 1, Photo 4",
    );
  });

  it("does not duplicate an existing photo reference", () => {
    expect(applyPhotoSectionRef("See Photo 2", "evidentiary", 2)).toBe(
      "See Photo 2",
    );
  });

  it("replaces incident placeholder with Annex A and Photo N", () => {
    expect(
      applyPhotoSectionRef(
        DEFAULT_PHOTO_REF_PLACEHOLDERS.incident,
        "incident",
        5,
      ),
    ).toBe("See Annex A and Photo 5");
  });

  it("appends to incident field when already customized", () => {
    expect(
      applyPhotoSectionRef("See Annex A and Photo 1", "incident", 3),
    ).toBe("See Annex A and Photo 1, Photo 3");
  });

  it("does not append duplicate incident photo reference", () => {
    expect(
      applyPhotoSectionRef("See Annex A and Photo 3", "incident", 3),
    ).toBe("See Annex A and Photo 3");
  });
});
