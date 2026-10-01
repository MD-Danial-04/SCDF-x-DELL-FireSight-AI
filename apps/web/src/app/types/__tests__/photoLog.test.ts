import { describe, expect, it } from "vitest";
import {
  createPhotoCopy,
  createPhotoLogEntry,
  getPhotoLogDisplayInfo,
  parsePhotoUid,
} from "../photoLog";

describe("parsePhotoUid", () => {
  it("returns file name without extension", () => {
    expect(parsePhotoUid("1234-5678.jpg")).toBe("1234-5678");
    expect(parsePhotoUid("scene_photo.PNG")).toBe("scene_photo");
  });

  it("returns full name when no extension", () => {
    expect(parsePhotoUid("noextension")).toBe("noextension");
  });
});

describe("createPhotoLogEntry", () => {
  it("builds entry with uid from file name", () => {
    const file = new File(["x"], "fire-001.jpeg", { type: "image/jpeg" });
    const entry = createPhotoLogEntry(file);
    expect(entry.fileName).toBe("fire-001.jpeg");
    expect(entry.uid).toBe("fire-001");
    expect(entry.blob).toBe(file);
    expect(entry.id).toBeTruthy();
  });
});

describe("getPhotoLogDisplayInfo", () => {
  it("numbers originals and labels copies after their source photo", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const photo1 = createPhotoLogEntry(file);
    const photo2 = createPhotoLogEntry(new File(["y"], "b.jpg", { type: "image/jpeg" }));
    const copy1 = createPhotoCopy(photo1);

    const info = getPhotoLogDisplayInfo([photo1, copy1, photo2]);

    expect(info[0].boxLabel).toBe("PHOTO 1");
    expect(info[0].tableLabel).toBe("1");
    expect(info[1].boxLabel).toBe("COPY OF PHOTO 1");
    expect(info[1].tableLabel).toBe("Copy of 1");
    expect(info[2].boxLabel).toBe("PHOTO 2");
    expect(info[2].tableLabel).toBe("2");
  });
});

describe("createPhotoCopy", () => {
  it("reuses blob and uid from the original", () => {
    const file = new File(["x"], "fire-001.jpeg", { type: "image/jpeg" });
    const original = createPhotoLogEntry(file);
    const copy = createPhotoCopy(original);

    expect(copy.isCopy).toBe(true);
    expect(copy.copyOfId).toBe(original.id);
    expect(copy.uid).toBe(original.uid);
    expect(copy.blob).toBe(original.blob);
    expect(copy.id).not.toBe(original.id);
  });

  it("does not copy caption from the original", () => {
    const file = new File(["x"], "fire-001.jpeg", { type: "image/jpeg" });
    const original = { ...createPhotoLogEntry(file), caption: "Kitchen damage" };
    const copy = createPhotoCopy(original);

    expect(copy.caption).toBeUndefined();
  });
});
