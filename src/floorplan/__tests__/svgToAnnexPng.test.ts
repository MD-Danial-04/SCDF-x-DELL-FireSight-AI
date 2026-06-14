import { describe, expect, it } from "vitest";
import {
  ANNEX_A_HEIGHT,
  ANNEX_A_RENDER_SCALE,
  ANNEX_A_WIDTH,
  computeContainFitRect,
} from "../../app/lib/svgToAnnexPng";

describe("computeContainFitRect", () => {
  const canvasWidth = ANNEX_A_WIDTH * ANNEX_A_RENDER_SCALE;
  const canvasHeight = ANNEX_A_HEIGHT * ANNEX_A_RENDER_SCALE;

  it("centers wide content with vertical padding", () => {
    const fit = computeContainFitRect({
      contentWidth: 10,
      contentHeight: 5,
      canvasWidth,
      canvasHeight,
    });
    expect(fit.width).toBeCloseTo(canvasWidth, 0);
    expect(fit.height).toBeLessThan(canvasHeight);
    expect(fit.x).toBeCloseTo(0, 0);
    expect(fit.y).toBeGreaterThan(0);
  });

  it("centers tall content with horizontal padding", () => {
    const fit = computeContainFitRect({
      contentWidth: 5,
      contentHeight: 10,
      canvasWidth,
      canvasHeight,
    });
    expect(fit.height).toBeCloseTo(canvasHeight, 0);
    expect(fit.width).toBeLessThan(canvasWidth);
    expect(fit.y).toBeCloseTo(0, 0);
    expect(fit.x).toBeGreaterThan(0);
  });

  it("fills canvas when aspect ratios match", () => {
    const fit = computeContainFitRect({
      contentWidth: ANNEX_A_WIDTH,
      contentHeight: ANNEX_A_HEIGHT,
      canvasWidth,
      canvasHeight,
    });
    expect(fit.x).toBeCloseTo(0, 0);
    expect(fit.y).toBeCloseTo(0, 0);
    expect(fit.width).toBeCloseTo(canvasWidth, 0);
    expect(fit.height).toBeCloseTo(canvasHeight, 0);
  });
});
