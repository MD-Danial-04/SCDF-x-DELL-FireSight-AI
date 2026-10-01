import { describe, expect, it } from "vitest";
import {
  ANNEX_A_HEIGHT,
  ANNEX_A_RENDER_SCALE,
  ANNEX_A_WIDTH,
  computeContainFitRect,
} from "../../app/lib/svgToAnnexPng";
import {
  ANNEX_A_FLOORPLAN_FRAME,
  computeFloorplanFrameFillRect,
  getAnnexAFloorplanFrameRect,
} from "../../app/lib/annexTemplateLayout";

describe("getAnnexAFloorplanFrameRect", () => {
  it("centers the fixed frame on the Annex A page", () => {
    const rect = getAnnexAFloorplanFrameRect();
    expect(rect.width).toBe(ANNEX_A_FLOORPLAN_FRAME.width);
    expect(rect.height).toBe(ANNEX_A_FLOORPLAN_FRAME.height);
    expect(rect.x + rect.width / 2).toBeCloseTo(ANNEX_A_WIDTH / 2, 0);
    expect(rect.y + rect.height / 2).toBeCloseTo(
      ANNEX_A_HEIGHT / 2 + ANNEX_A_FLOORPLAN_FRAME.centerYOffset,
      0,
    );
  });

  it("scales with render scale", () => {
    const rect = getAnnexAFloorplanFrameRect(ANNEX_A_RENDER_SCALE);
    expect(rect.width).toBe(ANNEX_A_FLOORPLAN_FRAME.width * ANNEX_A_RENDER_SCALE);
    expect(rect.height).toBe(ANNEX_A_FLOORPLAN_FRAME.height * ANNEX_A_RENDER_SCALE);
  });
});

describe("computeFloorplanFrameFillRect", () => {
  it("keeps fitted floorplan inside the fixed frame", () => {
    const scale = ANNEX_A_RENDER_SCALE;
    const frame = getAnnexAFloorplanFrameRect(scale);
    const fill = computeFloorplanFrameFillRect(10, 5, scale);

    expect(fill.x).toBeGreaterThanOrEqual(frame.x);
    expect(fill.y).toBeGreaterThanOrEqual(frame.y);
    expect(fill.x + fill.width).toBeLessThanOrEqual(frame.x + frame.width + 0.01);
    expect(fill.y + fill.height).toBeLessThanOrEqual(frame.y + frame.height + 0.01);
  });

  it("returns the full frame when content size is unknown", () => {
    const scale = ANNEX_A_RENDER_SCALE;
    const frame = getAnnexAFloorplanFrameRect(scale);
    const fill = computeFloorplanFrameFillRect(0, 0, scale);
    expect(fill).toEqual(frame);
  });

  it("matches full-page export dimensions at 2x scale", () => {
    expect(ANNEX_A_WIDTH * ANNEX_A_RENDER_SCALE).toBe(1438);
    expect(ANNEX_A_HEIGHT * ANNEX_A_RENDER_SCALE).toBe(2116);
  });
});

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
