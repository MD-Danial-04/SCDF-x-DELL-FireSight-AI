/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { parseFloorplan, renderFloorplanSvg, resolveTextOverlayFontSize } from "./floorplanEditor";

describe("resolveTextOverlayFontSize", () => {
  it("prefers computed screen pixels over SVG user-unit attributes", () => {
    expect(resolveTextOverlayFontSize("0.1", "12px")).toBe("12");
  });

  it("falls back when computed size is missing", () => {
    expect(resolveTextOverlayFontSize("0.1", null)).toBe("28");
    expect(resolveTextOverlayFontSize("0.1", null, "16")).toBe("16");
  });

  it("uses large attribute values that look like pixel sizes", () => {
    expect(resolveTextOverlayFontSize("28", null)).toBe("28");
  });
});

describe("renderFloorplanSvg editingText", () => {
  it("hides text with opacity instead of display none during edit", () => {
    const parsed = parseFloorplan(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="20" font-size="12">Hello</text></svg>',
    );
    const layerId = parsed.layers[0]?.id;
    expect(layerId).toBeDefined();

    const rendered = renderFloorplanSvg({
      svgText: parsed.svgText,
      amendments: { [layerId!]: { editingText: true } },
      camera: parsed.baseViewBox,
      selectedId: layerId!,
    });

    expect(rendered).toContain('opacity="0"');
    expect(rendered).not.toContain('display="none"');
  });
});
