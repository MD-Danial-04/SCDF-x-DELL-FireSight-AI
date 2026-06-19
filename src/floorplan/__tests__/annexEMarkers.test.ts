import { describe, expect, it } from "vitest";
import {
  buildAnnotatedFloorplanSvg,
  buildArrowGeometry,
  buildMarkersSvgFragment,
  clampMarkerTip,
  computeMarkerScale,
  createDefaultMarker,
  distanceToArrowSegment,
  findMarkerHitAtPoint,
  getMarkerAngleDeg,
  getMarkerLength,
  getMarkerLengthBounds,
  getArrowShaftLength,
  injectMarkersIntoSvg,
  parseViewBoxFromSvg,
  setMarkerTipFromAngleLength,
} from "../../app/lib/annexEMarkers";

const FLOORPLAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect x="0" y="0" width="600" height="600" fill="#fff"/></svg>`;
const VIEW_BOX = { x: 0, y: 0, width: 600, height: 600 };

describe("annexEMarkers", () => {
  it("parses viewBox from svg", () => {
    expect(parseViewBoxFromSvg(FLOORPLAN_SVG)).toEqual(VIEW_BOX);
  });

  it("builds light-blue marker fragment", () => {
    const marker = createDefaultMarker(100, 200, VIEW_BOX);
    const fragment = buildMarkersSvgFragment([marker], VIEW_BOX);
    expect(fragment).toContain('data-annex-e-markers="true"');
    expect(fragment).toContain('stroke="#38bdf8"');
    expect(fragment).toContain("<polygon");
    expect(fragment).toContain("?");
  });

  it("injects markers before closing svg tag", () => {
    const marker = { ...createDefaultMarker(100, 200, VIEW_BOX), photoNumber: 3 };
    const annotated = buildAnnotatedFloorplanSvg(FLOORPLAN_SVG, [marker], VIEW_BOX);
    expect(annotated).toContain('data-annex-e-markers="true"');
    expect(annotated).toContain(">3<");
    expect(annotated.endsWith("</svg>")).toBe(true);
  });

  it("returns original svg when fragment is empty", () => {
    expect(injectMarkersIntoSvg(FLOORPLAN_SVG, "")).toBe(FLOORPLAN_SVG);
  });

  it("detects arrow line hits near the segment", () => {
    const marker = createDefaultMarker(100, 200, VIEW_BOX);
    const scale = computeMarkerScale(VIEW_BOX);
    const midX = (marker.cx + marker.tipX) / 2;
    const midY = (marker.cy + marker.tipY) / 2;

    expect(distanceToArrowSegment({ x: midX, y: midY }, marker, scale)).toBeLessThan(
      scale.arrowLineHitThreshold,
    );
    expect(findMarkerHitAtPoint({ x: midX, y: midY }, [marker], VIEW_BOX)?.hit).toBe("arrow");
  });

  it("does not treat distant points as arrow hits", () => {
    const marker = createDefaultMarker(100, 200, VIEW_BOX);
    const scale = computeMarkerScale(VIEW_BOX);
    const farPoint = { x: marker.cx, y: marker.cy - scale.hitRadius * 3 };

    expect(distanceToArrowSegment(farPoint, marker, scale)).toBeGreaterThan(
      scale.arrowLineHitThreshold,
    );
    expect(findMarkerHitAtPoint(farPoint, [marker], VIEW_BOX)).toBeNull();
  });

  it("prefers arrow hits over body when tip overlaps circle edge", () => {
    const marker = createDefaultMarker(100, 200, VIEW_BOX);
    const hit = findMarkerHitAtPoint({ x: marker.tipX, y: marker.tipY }, [marker], VIEW_BOX);
    expect(hit?.hit).toBe("arrow");
  });

  it("computes angle and length helpers", () => {
    const marker = { cx: 100, cy: 200, tipX: 150, tipY: 200 };
    expect(getMarkerLength(marker)).toBeCloseTo(50, 5);
    expect(getMarkerAngleDeg(marker)).toBeCloseTo(0, 5);

    const down = setMarkerTipFromAngleLength(marker, 90, 40);
    expect(down.tipX).toBeCloseTo(100, 5);
    expect(down.tipY).toBeCloseTo(240, 5);
    expect(getMarkerAngleDeg({ ...marker, ...down })).toBeCloseTo(90, 5);
    expect(getMarkerLength({ ...marker, ...down })).toBeCloseTo(40, 5);
  });

  it("returns length bounds scaled to viewBox", () => {
    const scale = computeMarkerScale(VIEW_BOX);
    expect(getMarkerLengthBounds(VIEW_BOX)).toEqual({
      min: scale.radius + scale.arrowHeadLength * 1.2,
      max: 240,
    });
  });

  it("ends the shaft at the arrow head base for short arrows", () => {
    const scale = computeMarkerScale(VIEW_BOX);
    const marker = {
      cx: 100,
      cy: 200,
      tipX: 100 + scale.radius + 4,
      tipY: 200,
    };
    const arrow = buildArrowGeometry(
      marker.cx,
      marker.cy,
      marker.tipX,
      marker.tipY,
      scale.radius,
      scale.arrowHeadLength,
      scale.arrowHeadWidth,
    );

    expect(arrow.lineEndX).not.toBe(marker.tipX);
    expect(arrow.lineEndX).toBeLessThan(marker.tipX);
    expect(arrow.lineStartX).toBeCloseTo(marker.cx + scale.radius, 5);
    expect(arrow.headPoints).not.toBe("");
    expect(getArrowShaftLength(arrow)).toBeGreaterThan(0);
    expect(arrow.lineStartX).not.toBeCloseTo(arrow.lineEndX, 5);
  });

  it("keeps a visible shaft at the minimum clamped arrow length", () => {
    const scale = computeMarkerScale(VIEW_BOX);
    const marker = { cx: 100, cy: 200, tipX: 100, tipY: 200 };
    const clamped = clampMarkerTip(marker, marker.cx, marker.cy, VIEW_BOX);
    const arrow = buildArrowGeometry(
      marker.cx,
      marker.cy,
      clamped.tipX,
      clamped.tipY,
      scale.radius,
      scale.arrowHeadLength,
      scale.arrowHeadWidth,
    );

    expect(getArrowShaftLength(arrow)).toBeGreaterThan(scale.arrowHeadLength * 0.15);
  });

  it("clamps a tip dragged onto the stem center to the minimum length", () => {
    const marker = { cx: 100, cy: 200, tipX: 100, tipY: 200 };
    const clamped = clampMarkerTip(marker, marker.cx, marker.cy, VIEW_BOX);
    const bounds = getMarkerLengthBounds(VIEW_BOX);

    expect(getMarkerLength({ cx: marker.cx, cy: marker.cy, ...clamped })).toBeCloseTo(bounds.min, 5);
    expect(clamped.tipY).toBeCloseTo(marker.cy, 5);
    expect(clamped.tipX).toBeGreaterThan(marker.cx);
  });
});
