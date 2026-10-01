/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  convertObjectBoxShape,
  createDefaultObjectBox,
  getObjectBoxBounds,
  inferObjectBoxDefaults,
  inferTextFontSize,
  renderFloorplanSvg,
  type FloorplanViewBox,
  type FloorplanGeneratedElement,
} from "../../app/lib/floorplanEditor";

const METER_FLOORPLAN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 5 4" width="5" height="4">
  <g data-layer="walls" fill="none" stroke="#000000" stroke-width="0.05" stroke-linecap="square">
    <rect x="0" y="0" width="4" height="3" />
  </g>
</svg>`;

const METER_VIEW_BOX: FloorplanViewBox = { x: -0.5, y: -0.5, width: 5, height: 4 };

const PIXEL_FLOORPLAN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000"></svg>';

const PIXEL_VIEW_BOX: FloorplanViewBox = { x: 0, y: 0, width: 1600, height: 1000 };

describe("inferObjectBoxDefaults", () => {
  it("returns meter-scale values when walls use meter stroke width", () => {
    const defaults = inferObjectBoxDefaults(METER_VIEW_BOX, METER_FLOORPLAN);
    expect(defaults.strokeWidth).toBe(0.05);
    expect(defaults.width).toBeCloseTo(0.6, 5);
    expect(defaults.height).toBeCloseTo(0.4, 5);
    expect(defaults.labelFontSize).toBeCloseTo(0.1, 5);
  });

  it("returns pixel-scale values for large viewBox SVGs", () => {
    const defaults = inferObjectBoxDefaults(PIXEL_VIEW_BOX, PIXEL_FLOORPLAN);
    expect(defaults.strokeWidth).toBeCloseTo(16, 5);
    expect(defaults.width).toBeCloseTo(192, 5);
    expect(defaults.height).toBeCloseTo(100, 5);
    expect(defaults.labelFontSize).toBeCloseTo(25, 5);
  });
});

describe("inferTextFontSize", () => {
  it("returns meter-scale font size for room scans", () => {
    expect(inferTextFontSize(METER_VIEW_BOX, METER_FLOORPLAN)).toBeCloseTo(0.1, 5);
  });

  it("returns pixel-scale font size for large viewBox SVGs", () => {
    expect(inferTextFontSize(PIXEL_VIEW_BOX, PIXEL_FLOORPLAN)).toBeCloseTo(25, 5);
  });
});

describe("renderFloorplanSvg generated text", () => {
  it("renders user text with inferred font size instead of hardcoded 28", () => {
    const element: FloorplanGeneratedElement = {
      id: "generated-text-1",
      type: "text",
      label: "New text",
      textContent: "Kitchen",
      fontFamily: "Arial, sans-serif",
      fontSize: inferTextFontSize(METER_VIEW_BOX, METER_FLOORPLAN),
      x: 2,
      y: 1.5,
    };
    const rendered = renderFloorplanSvg({
      svgText: METER_FLOORPLAN,
      amendments: {},
      camera: METER_VIEW_BOX,
      selectedId: null,
      generatedElements: [element],
    });

    expect(rendered).toContain('font-size="0.1"');
    expect(rendered).not.toContain('font-size="28"');
    expect(rendered).toContain("Kitchen");
  });
});

describe("createDefaultObjectBox", () => {
  it("centers the box on the click point", () => {
    const element = createDefaultObjectBox(2, 1.5, METER_VIEW_BOX, METER_FLOORPLAN);
    expect(element.type).toBe("objectBox");
    expect(element.objectBoxShape ?? "rect").toBe("rect");
    expect(element.fill).toBe("#ffffff");
    expect(element.stroke).toBe("#000000");
    expect(element.x + (element.width ?? 0) / 2).toBeCloseTo(2, 5);
    expect(element.y + (element.height ?? 0) / 2).toBeCloseTo(1.5, 5);
  });

  it("creates a circle object box when shape is circle", () => {
    const element = createDefaultObjectBox(2, 1.5, METER_VIEW_BOX, METER_FLOORPLAN, "circle");
    expect(element.objectBoxShape).toBe("circle");
    expect(element.radius).toBeCloseTo(Math.min(element.width ?? 0, element.height ?? 0) / 2, 5);
  });
});

describe("convertObjectBoxShape", () => {
  it("preserves center and bounds when converting rect to circle", () => {
    const rect = createDefaultObjectBox(2, 1.5, METER_VIEW_BOX, METER_FLOORPLAN, "rect");
    const before = getObjectBoxBounds(rect);
    const circle = convertObjectBoxShape(rect, "circle");
    const after = getObjectBoxBounds(circle);

    expect(circle.objectBoxShape).toBe("circle");
    expect(after.width).toBeCloseTo(before.width, 5);
    expect(after.height).toBeCloseTo(before.height, 5);
    expect(after.centerX).toBeCloseTo(before.centerX, 5);
    expect(after.centerY).toBeCloseTo(before.centerY, 5);
  });
});

describe("renderFloorplanSvg object boxes", () => {
  it("appends user object boxes into data-layer=objects", () => {
    const element = createDefaultObjectBox(2, 1.5, METER_VIEW_BOX, METER_FLOORPLAN);
    const rendered = renderFloorplanSvg({
      svgText: METER_FLOORPLAN,
      amendments: {},
      camera: METER_VIEW_BOX,
      selectedId: null,
      generatedElements: [element],
    });

    expect(rendered).toContain('data-layer="objects"');
    expect(rendered).toContain('data-fs-object-box="true"');
    expect(rendered).toContain('data-fs-node-id="' + element.id + '"');
    const objectsGroup = rendered.match(/<g data-layer="objects"[^>]*>[\s\S]*?<\/g>/);
    expect(objectsGroup?.[0]).toContain('data-fs-node-id="' + element.id + '"');
  });

  it("renders circle geometry inside object box groups", () => {
    const element = createDefaultObjectBox(2, 1.5, METER_VIEW_BOX, METER_FLOORPLAN, "circle");
    const rendered = renderFloorplanSvg({
      svgText: METER_FLOORPLAN,
      amendments: {},
      camera: METER_VIEW_BOX,
      selectedId: null,
      generatedElements: [element],
    });

    expect(rendered).toContain("<circle");
    expect(rendered).not.toMatch(/data-fs-object-box="true"[\s\S]*?<rect /);
  });

  it("renders line geometry inside object box groups", () => {
    const element = createDefaultObjectBox(2, 1.5, METER_VIEW_BOX, METER_FLOORPLAN, "line");
    const rendered = renderFloorplanSvg({
      svgText: METER_FLOORPLAN,
      amendments: {},
      camera: METER_VIEW_BOX,
      selectedId: null,
      generatedElements: [element],
    });

    expect(rendered).toContain("<line");
  });

  it("renders optional label text inside the object box group", () => {
    const element = {
      ...createDefaultObjectBox(2, 1.5, METER_VIEW_BOX, METER_FLOORPLAN),
      objectLabel: "Sofa",
    };
    const rendered = renderFloorplanSvg({
      svgText: METER_FLOORPLAN,
      amendments: {},
      camera: METER_VIEW_BOX,
      selectedId: null,
      generatedElements: [element],
    });

    expect(rendered).toContain(">Sofa<");
    expect(rendered).toContain('text-anchor="middle"');
  });
});
