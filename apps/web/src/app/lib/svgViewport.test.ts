import { describe, expect, it } from "vitest";
import { clientToSvg, computeSvgViewportMapping, svgToClient } from "./svgViewport";

const VIEW_BOX = { x: 0, y: 0, width: 100, height: 100 };

function makeRect(width: number, height: number, left = 0, top = 0) {
  return { width, height, left, top };
}

describe("computeSvgViewportMapping", () => {
  it("letterboxes a wide container with vertical padding", () => {
    const mapping = computeSvgViewportMapping(makeRect(200, 100), VIEW_BOX);

    expect(mapping.scale).toBe(1);
    expect(mapping.offsetX).toBe(50);
    expect(mapping.offsetY).toBe(0);
  });

  it("letterboxes a tall container with horizontal padding", () => {
    const mapping = computeSvgViewportMapping(makeRect(100, 200), VIEW_BOX);

    expect(mapping.scale).toBe(1);
    expect(mapping.offsetX).toBe(0);
    expect(mapping.offsetY).toBe(50);
  });
});

describe("clientToSvg", () => {
  it("maps the content center to the viewBox center", () => {
    const rect = makeRect(200, 100);
    const mapping = computeSvgViewportMapping(rect, VIEW_BOX);
    const point = clientToSvg(
      rect.left + mapping.offsetX + 50,
      rect.top + mapping.offsetY + 50,
      mapping,
      VIEW_BOX,
    );

    expect(point).toEqual({ x: 50, y: 50 });
  });

  it("maps the content top-left to the viewBox origin", () => {
    const rect = makeRect(200, 100);
    const mapping = computeSvgViewportMapping(rect, VIEW_BOX);
    const point = clientToSvg(
      rect.left + mapping.offsetX,
      rect.top + mapping.offsetY,
      mapping,
      VIEW_BOX,
    );

    expect(point).toEqual({ x: 0, y: 0 });
  });

  it("returns coordinates for clicks in letterbox margins", () => {
    const rect = makeRect(200, 100);
    const mapping = computeSvgViewportMapping(rect, VIEW_BOX);
    const point = clientToSvg(rect.left + 10, rect.top + 50, mapping, VIEW_BOX);

    expect(point).not.toBeNull();
    expect(point!.x).toBeLessThan(0);
    expect(point!.y).toBeCloseTo(50, 5);
  });
});

describe("svgToClient", () => {
  it("round-trips viewBox corners through client space", () => {
    const rect = makeRect(200, 100);
    const mapping = computeSvgViewportMapping(rect, VIEW_BOX);
    const topLeft = svgToClient(0, 0, mapping, VIEW_BOX);
    const back = clientToSvg(topLeft.x, topLeft.y, mapping, VIEW_BOX);

    expect(back).toEqual({ x: 0, y: 0 });
  });
});
