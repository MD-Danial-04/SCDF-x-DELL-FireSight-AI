export interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgViewportMapping {
  scale: number;
  offsetX: number;
  offsetY: number;
  rectLeft: number;
  rectTop: number;
}

export function computeSvgViewportMapping(
  rect: Pick<DOMRect, "width" | "height" | "left" | "top">,
  viewBox: SvgViewBox,
): SvgViewportMapping {
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  const contentWidth = viewBox.width * scale;
  const contentHeight = viewBox.height * scale;
  return {
    scale,
    offsetX: (rect.width - contentWidth) / 2,
    offsetY: (rect.height - contentHeight) / 2,
    rectLeft: rect.left,
    rectTop: rect.top,
  };
}

export function clientToSvg(
  clientX: number,
  clientY: number,
  mapping: SvgViewportMapping,
  viewBox: SvgViewBox,
) {
  const localX = clientX - mapping.rectLeft - mapping.offsetX;
  const localY = clientY - mapping.rectTop - mapping.offsetY;
  if (mapping.scale <= 0) return null;
  return {
    x: viewBox.x + localX / mapping.scale,
    y: viewBox.y + localY / mapping.scale,
  };
}

export function svgToClient(
  svgX: number,
  svgY: number,
  mapping: SvgViewportMapping,
  viewBox: SvgViewBox,
) {
  return {
    x: mapping.rectLeft + mapping.offsetX + (svgX - viewBox.x) * mapping.scale,
    y: mapping.rectTop + mapping.offsetY + (svgY - viewBox.y) * mapping.scale,
  };
}
