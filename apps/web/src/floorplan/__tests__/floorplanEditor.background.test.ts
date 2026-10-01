/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  applyObjectBoxLayout,
  createDefaultObjectBox,
  parseFloorplan,
  renderFloorplanSvg,
} from "../../app/lib/floorplanEditor";

const SCAN_STYLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 4 4" width="4" height="4">
  <rect x="-0.5" y="-0.5" width="4" height="4" fill="#ffffff" />
  <g data-layer="walls" fill="none" stroke="#000000" stroke-width="0.05">
    <line x1="0" y1="0" x2="3" y2="0" />
    <line x1="0" y1="3" x2="0" y2="0" />
  </g>
</svg>`;

const SVG_WITHOUT_FILL_BACKGROUND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" />
  <line x1="10" y1="10" x2="90" y2="90" stroke="#000000" stroke-width="2" />
</svg>`;

const SVG_WITH_MISTAGGED_BACKGROUND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="#ffffff" data-fs-node-id="node-1" data-fs-selectable="true" id="node-1" />
  <line x1="10" y1="10" x2="90" y2="90" stroke="#000000" stroke-width="2" />
</svg>`;

const SVG_WITH_IMPORTED_OBJECT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 5 4" width="5" height="4">
  <rect x="-0.5" y="-0.5" width="5" height="4" fill="#ffffff" />
  <g data-layer="objects">
    <rect x="1" y="1" width="0.8" height="0.6" fill="#cccccc" data-fs-node-id="node-2" />
  </g>
  <g data-layer="walls" fill="none" stroke="#000000" stroke-width="0.05">
    <rect x="0" y="0" width="4" height="3" />
  </g>
</svg>`;

const SVG_WITH_ROOM_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#ffffff" />
  <rect x="70" y="70" width="1460" height="860" fill="none" stroke="#111827" stroke-width="8" />
</svg>`;

const SVG_WITH_RGB_BACKGROUND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
  <rect x="0" y="0" width="600" height="600" fill="rgb(255, 255, 255)" />
  <line x1="100" y1="100" x2="500" y2="100" stroke="#000" stroke-width="4" />
</svg>`;

describe("parseFloorplan background exclusion", () => {
  it("tags viewBox background rect and excludes it from layers", () => {
    const parsed = parseFloorplan(SCAN_STYLE_SVG);
    const doc = new DOMParser().parseFromString(parsed.svgText, "image/svg+xml");
    const background = doc.querySelector('[data-fs-background="true"]');

    expect(background).not.toBeNull();
    expect(background?.tagName).toBe("rect");
    expect(background?.getAttribute("data-fs-node-id")).toBeNull();
    expect(background?.getAttribute("data-fs-selectable")).toBeNull();
    expect(background?.getAttribute("pointer-events")).toBe("none");
    expect(parsed.layers.some((layer) => layer.tagName === "rect" && layer.id === "node-1")).toBe(false);
  });

  it("assigns node-1 to the first non-background element", () => {
    const parsed = parseFloorplan(SCAN_STYLE_SVG);

    expect(parsed.layers[0]?.id).toBe("node-1");
    expect(parsed.layers[0]?.tagName).toBe("line");
  });

  it("keeps non-background room outline rects selectable", () => {
    const parsed = parseFloorplan(SVG_WITH_ROOM_OUTLINE);
    const outlineLayer = parsed.layers.find((layer) => layer.tagName === "rect");

    expect(parsed.layers).toHaveLength(1);
    expect(outlineLayer?.id).toBe("node-1");
    expect(parsed.svgText).toContain('data-fs-background="true"');
    expect(parsed.svgText).toContain('data-fs-node-id="node-1"');
  });

  it("recognizes rgb(255, 255, 255) background fills", () => {
    const parsed = parseFloorplan(SVG_WITH_RGB_BACKGROUND);

    expect(parsed.layers).toHaveLength(1);
    expect(parsed.layers[0]?.tagName).toBe("line");
    expect(parsed.svgText).toContain('data-fs-background="true"');
  });

  it("renders pointer-events none styling for background rects", () => {
    const parsed = parseFloorplan(SCAN_STYLE_SVG);
    const rendered = renderFloorplanSvg({
      svgText: parsed.svgText,
      amendments: {},
      camera: parsed.baseViewBox,
      selectedId: null,
    });

    expect(rendered).toContain("[data-fs-background=\"true\"]");
    expect(rendered).toContain("pointer-events: none");
  });

  it("tags full-viewBox rect without fill attribute as background", () => {
    const parsed = parseFloorplan(SVG_WITHOUT_FILL_BACKGROUND);
    const doc = new DOMParser().parseFromString(parsed.svgText, "image/svg+xml");
    const background = doc.querySelector('[data-fs-background="true"]');

    expect(background).not.toBeNull();
    expect(background?.getAttribute("data-fs-node-id")).toBeNull();
    expect(parsed.layers).toHaveLength(1);
    expect(parsed.layers[0]?.tagName).toBe("line");
  });
});

describe("renderFloorplanSvg background re-strip", () => {
  it("removes layer markers from a mis-tagged background rect", () => {
    const rendered = renderFloorplanSvg({
      svgText: SVG_WITH_MISTAGGED_BACKGROUND,
      amendments: {},
      camera: { x: 0, y: 0, width: 100, height: 100 },
      selectedId: null,
    });
    const doc = new DOMParser().parseFromString(rendered, "image/svg+xml");
    const background = doc.querySelector('[data-fs-background="true"]');

    expect(background).not.toBeNull();
    expect(background?.getAttribute("data-fs-node-id")).toBeNull();
    expect(background?.getAttribute("data-fs-selectable")).toBeNull();
    expect(background?.getAttribute("id")).toBeNull();
  });
});

describe("applyObjectBoxLayout scope", () => {
  it("does not move imported objects-layer rects when laying out generated boxes", () => {
    const parsed = parseFloorplan(SVG_WITH_IMPORTED_OBJECT);
    const importedLayerId = parsed.layers.find((layer) => layer.tagName === "rect")?.id;
    expect(importedLayerId).toBeDefined();

    const generated = createDefaultObjectBox(2, 1.5, parsed.baseViewBox, parsed.svgText);
    const amendments = {
      [importedLayerId!]: { translateX: 0.25, translateY: -0.1 },
    };

    const result = applyObjectBoxLayout({
      svgText: parsed.svgText,
      generatedElements: [generated],
      amendments,
      viewBox: parsed.baseViewBox,
    });

    expect(result.amendments[importedLayerId!]).toEqual(amendments[importedLayerId!]);
  });
});
