import { describe, expect, it } from "vitest";
import {
  applyPhotoSectionRef,
  migrateLegacyPhotoRefs,
  resolvePhotoRefText,
} from "../applyPhotoSectionRef";
import { DEFAULT_PHOTO_REF_PLACEHOLDERS } from "../../types/photoAnalysis";
import {
  createPhotoCopy,
  createPhotoLogEntry,
  type PhotoLogEntry,
} from "../../types/photoLog";
import { createEmptyReportFields } from "../../types/fireReport";

function makePhoto(name: string): PhotoLogEntry {
  return createPhotoLogEntry(new File(["x"], name, { type: "image/jpeg" }));
}

describe("applyPhotoSectionRef", () => {
  it("replaces damages placeholder with See Photo N", () => {
    expect(
      applyPhotoSectionRef(DEFAULT_PHOTO_REF_PLACEHOLDERS.damages, "damages", 3),
    ).toBe("See Photo 3");
  });

  it("appends photo number when field already has a reference", () => {
    expect(applyPhotoSectionRef("See Photo 1", "burn_patterns", 4)).toBe(
      "See Photo 1, Photo 4",
    );
  });

  it("replaces incident placeholder with Annex A and Photo N", () => {
    expect(
      applyPhotoSectionRef(DEFAULT_PHOTO_REF_PLACEHOLDERS.incident, "incident", 5),
    ).toBe("See Annex A and Photo 5");
  });
});

describe("resolvePhotoRefText", () => {
  it("falls back to the placeholder when nothing is linked", () => {
    const photos = [makePhoto("a.jpg"), makePhoto("b.jpg")];
    expect(resolvePhotoRefText("damages", [], photos)).toBe(
      DEFAULT_PHOTO_REF_PLACEHOLDERS.damages,
    );
    expect(resolvePhotoRefText("damages", undefined, photos)).toBe(
      DEFAULT_PHOTO_REF_PLACEHOLDERS.damages,
    );
  });

  it("renders See Photo N for a linked photo", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    expect(resolvePhotoRefText("damages", [b.id], [a, b])).toBe("See Photo 2");
  });

  it("uses the live number after reordering", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    // b is initially Photo 2
    expect(resolvePhotoRefText("damages", [b.id], [a, b])).toBe("See Photo 2");
    // after reorder b becomes Photo 1
    expect(resolvePhotoRefText("damages", [b.id], [b, a])).toBe("See Photo 1");
  });

  it("drops ids whose photo no longer exists", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    // b deleted -> only a (Photo 1) remains
    expect(resolvePhotoRefText("damages", [a.id, b.id], [a])).toBe("See Photo 1");
    // all deleted -> placeholder
    expect(resolvePhotoRefText("damages", [a.id, b.id], [])).toBe(
      DEFAULT_PHOTO_REF_PLACEHOLDERS.damages,
    );
  });

  it("sorts and dedupes by display number", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    const c = makePhoto("c.jpg");
    expect(
      resolvePhotoRefText("evidentiary", [c.id, a.id, c.id], [a, b, c]),
    ).toBe("See Photo 1, Photo 3");
  });

  it("resolves a copy to its original's number", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    const copyOfB = createPhotoCopy(b);
    expect(
      resolvePhotoRefText("damages", [copyOfB.id], [a, b, copyOfB]),
    ).toBe("See Photo 2");
  });

  it("uses the incident lead-in prefix", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    expect(resolvePhotoRefText("incident", [a.id, b.id], [a, b])).toBe(
      "See Annex A and Photo 1, Photo 2",
    );
  });

  it("honours a custom note", () => {
    const a = makePhoto("a.jpg");
    expect(resolvePhotoRefText("damages", [a.id], [a], "Refer to")).toBe(
      "Refer to Photo 1",
    );
  });
});

describe("migrateLegacyPhotoRefs", () => {
  it("parses legacy 'See Photo N' text into ids using current order", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    const fields = {
      ...createEmptyReportFields(),
      damagesPhotoRef: "See Photo 2",
    };

    const { links, notes } = migrateLegacyPhotoRefs(fields, [a, b]);
    expect(links.damages).toEqual([b.id]);
    expect(notes.damages).toBe("See");
  });

  it("preserves custom unparseable text as the note", () => {
    const a = makePhoto("a.jpg");
    const fields = {
      ...createEmptyReportFields(),
      damagesPhotoRef: "Refer to attached annex",
    };

    const { links, notes } = migrateLegacyPhotoRefs(fields, [a]);
    expect(links.damages).toBeUndefined();
    expect(notes.damages).toBe("Refer to attached annex");
  });

  it("leaves the placeholder untouched", () => {
    const fields = createEmptyReportFields();
    const { links, notes } = migrateLegacyPhotoRefs(fields, []);
    expect(links.damages).toBeUndefined();
    expect(notes.damages).toBeUndefined();
  });

  it("captures the incident lead-in", () => {
    const a = makePhoto("a.jpg");
    const b = makePhoto("b.jpg");
    const fields = {
      ...createEmptyReportFields(),
      incidentPhotosRef: "See Annex A and Photo 1, Photo 2",
    };

    const { links, notes } = migrateLegacyPhotoRefs(fields, [a, b]);
    expect(links.incident).toEqual([a.id, b.id]);
    expect(notes.incident).toBe("See Annex A and");
  });
});
