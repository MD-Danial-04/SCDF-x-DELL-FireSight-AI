import { describe, expect, it } from "vitest";
import {
  layoutObjectBoxes,
  objectBoxIntersectsWallSegment,
  orientedBoxesOverlap,
  pushObjectBoxOffWalls,
  type ObjectBox2D,
} from "../objects";
import type { Segment2D } from "../types";

const ROOM_WALLS: Segment2D[] = [
  { kind: "segment", wallId: "south", start: { x: 0, z: 0 }, end: { x: 4, z: 0 } },
  { kind: "segment", wallId: "east", start: { x: 4, z: 0 }, end: { x: 4, z: 3 } },
  { kind: "segment", wallId: "north", start: { x: 4, z: 3 }, end: { x: 0, z: 3 } },
  { kind: "segment", wallId: "west", start: { x: 0, z: 3 }, end: { x: 0, z: 0 } },
];

function box(
  id: string,
  centerX: number,
  centerZ: number,
  widthM = 1,
  depthM = 0.8,
  rotationDeg = 0,
): ObjectBox2D {
  return { id, center: { x: centerX, z: centerZ }, widthM, depthM, rotationDeg };
}

describe("objectBoxIntersectsWallSegment", () => {
  it("detects a box overlapping a wall centerline", () => {
    const onWall = box("a", 2, 0, 1, 0.8);
    expect(objectBoxIntersectsWallSegment(onWall, ROOM_WALLS[0], 0.05)).toBe(true);
  });

  it("returns false when the box is away from the wall", () => {
    const inside = box("a", 2, 1.5, 1, 0.8);
    expect(objectBoxIntersectsWallSegment(inside, ROOM_WALLS[0], 0.05)).toBe(false);
  });
});

describe("pushObjectBoxOffWalls", () => {
  it("nudges a box off a wall segment", () => {
    const onWall = box("a", 2, 0.2, 1, 0.8);
    expect(objectBoxIntersectsWallSegment(onWall, ROOM_WALLS[0], 0.05)).toBe(true);

    const pushed = pushObjectBoxOffWalls(onWall, ROOM_WALLS, 0.05);
    expect(objectBoxIntersectsWallSegment(pushed, ROOM_WALLS[0], 0.05)).toBe(false);
    expect(pushed.center.z).toBeGreaterThan(onWall.center.z);
  });
});

describe("layoutObjectBoxes", () => {
  it("separates overlapping boxes and pushes them off walls", () => {
    const boxes = [box("a", 2, 1.5), box("b", 2.2, 1.5)];
    expect(orientedBoxesOverlap(boxes[0], boxes[1])).toBe(true);

    const layout = layoutObjectBoxes(boxes, ROOM_WALLS, 0.05);
    expect(orientedBoxesOverlap(layout[0], layout[1])).toBe(false);
    for (const placed of layout) {
      for (const wall of ROOM_WALLS) {
        expect(objectBoxIntersectsWallSegment(placed, wall, 0.05)).toBe(false);
      }
    }
  });
});
