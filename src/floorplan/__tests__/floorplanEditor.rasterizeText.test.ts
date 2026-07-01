/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  normalizeSvgViewBoxToContent,
  parseFloorplan,
  prepareSvgForRasterization,
  renderFloorplanSvg,
  type FloorplanGeneratedElement,
} from "../../app/lib/floorplanEditor";

const SCAN_WITH_ROOM_LABEL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -5 4 5" width="4" height="5">
  <rect x="-4" y="-5" width="4" height="5" fill="#ffffff" />
  <g data-layer="walls" fill="none" stroke="#000000" stroke-width="0.05">
    <line x1="-3.5" y1="-4.5" x2="-0.5" y2="-4.5" />
    <line x1="-3.5" y1="-1" x2="-3.5" y2="-4.5" />
    <line x1="-0.5" y1="-1" x2="-3.5" y2="-1" />
    <line x1="-0.5" y1="-4.5" x2="-0.5" y2="-1" />
  </g>
  <g data-layer="labels" fill="#000000" stroke="none">
    <text x="-2" y="-2.75" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="0.28">Room</text>
  </g>
</svg>`;

describe("floorplan text in annex rasterization pipeline", () => {
  it("keeps room label text through export and viewBox normalization", () => {
    const parsed = parseFloorplan(SCAN_WITH_ROOM_LABEL);
    const exported = renderFloorplanSvg({
      svgText: parsed.svgText,
      amendments: {},
      camera: parsed.baseViewBox,
      selectedId: null,
    });
    const normalized = normalizeSvgViewBoxToContent(exported);

    expect(exported).toContain("Room");
    expect(normalized).toContain("Room");

    const viewBox = normalized.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
    expect(viewBox).toHaveLength(4);
    const [vx, vy, vw, vh] = viewBox!;
    expect(-2).toBeGreaterThanOrEqual(vx);
    expect(-2).toBeLessThanOrEqual(vx + vw);
    expect(-2.75).toBeGreaterThanOrEqual(vy);
    expect(-2.75).toBeLessThanOrEqual(vy + vh);
  });

  it("prepareSvgForRasterization adds explicit fill and pixel dimensions to labels", () => {
    const parsed = parseFloorplan(SCAN_WITH_ROOM_LABEL);
    const exported = renderFloorplanSvg({
      svgText: parsed.svgText,
      amendments: {},
      camera: parsed.baseViewBox,
      selectedId: null,
    });
    const prepared = prepareSvgForRasterization(normalizeSvgViewBoxToContent(exported));
    const doc = new DOMParser().parseFromString(prepared, "image/svg+xml");
    const svg = doc.documentElement;
    const label = [...doc.querySelectorAll("text")].find((node) => node.textContent === "Room");

    expect(label?.getAttribute("fill")).toBe("#000000");
    expect(label?.getAttribute("dominant-baseline")).toBe("central");
    expect(svg.getAttribute("width")).not.toBe("100%");
    expect(Number(svg.getAttribute("width"))).toBeGreaterThan(0);
    expect(svg.getAttribute("overflow")).toBe("visible");
    expect(doc.querySelector("style")).toBeNull();
  });

  it("includes generated room labels in rasterization output", () => {
    const parsed = parseFloorplan(SCAN_WITH_ROOM_LABEL);
    const generated: FloorplanGeneratedElement = {
      id: "generated-text-kitchen",
      type: "text",
      label: "Kitchen",
      textContent: "Kitchen",
      fontFamily: "Arial, sans-serif",
      fontSize: 0.1,
      x: -1.5,
      y: -2,
    };
    const exported = renderFloorplanSvg({
      svgText: parsed.svgText,
      amendments: {},
      camera: parsed.baseViewBox,
      selectedId: null,
      generatedElements: [generated],
    });
    const prepared = prepareSvgForRasterization(normalizeSvgViewBoxToContent(exported));
    const labels = [...new DOMParser()
      .parseFromString(prepared, "image/svg+xml")
      .querySelectorAll("text")].map((node) => node.textContent);

    expect(labels).toContain("Room");
    expect(labels).toContain("Kitchen");
  });
});
