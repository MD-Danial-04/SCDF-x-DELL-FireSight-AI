export interface FloorplanViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorplanLayer {
  id: string;
  label: string;
  tagName: string;
  isText: boolean;
  textContent?: string;
  isGenerated?: boolean;
}

export interface FloorplanAmendment {
  label?: string;
  textContent?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  hidden?: boolean;
  translateX?: number;
  translateY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  cornerRadiusX?: number;
  cornerRadiusY?: number;
  x2?: number;
  y2?: number;
}

export interface ParsedFloorplan {
  svgText: string;
  layers: FloorplanLayer[];
  baseViewBox: FloorplanViewBox;
}

export type FloorplanShapeType =
  | "text"
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "polyline"
  | "polygon";

export interface FloorplanPoint {
  x: number;
  y: number;
}

export interface FloorplanGeneratedElement {
  id: string;
  type: FloorplanShapeType;
  label: string;
  textContent?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  x2?: number;
  y2?: number;
  points?: FloorplanPoint[];
  rotation?: number;
}

export interface FloorplanElementMetrics {
  tagName: string;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
}

const SELECTABLE_TAGS = [
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
];

function parseNumericLength(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferViewBox(svg: SVGSVGElement) {
  const rawViewBox = svg.getAttribute("viewBox");
  if (rawViewBox) {
    const values = rawViewBox
      .trim()
      .split(/[\s,]+/)
      .map((entry) => Number.parseFloat(entry))
      .filter((entry) => Number.isFinite(entry));
    if (values.length === 4) {
      return {
        x: values[0],
        y: values[1],
        width: values[2],
        height: values[3],
      };
    }
  }

  const width = parseNumericLength(svg.getAttribute("width")) ?? 1200;
  const height = parseNumericLength(svg.getAttribute("height")) ?? 800;
  return { x: 0, y: 0, width, height };
}

function isSelectableElement(element: Element) {
  if (!SELECTABLE_TAGS.includes(element.tagName)) return false;
  return !element.closest("defs,clipPath,mask,pattern,marker,symbol");
}

function inferLayerLabel(element: Element, fallbackIndex: number) {
  const textContent = element.textContent?.replace(/\s+/g, " ").trim();
  if (element.getAttribute("id")) return element.getAttribute("id")!;
  if (element.getAttribute("aria-label")) return element.getAttribute("aria-label")!;
  if (element.getAttribute("data-name")) return element.getAttribute("data-name")!;
  if (textContent) return textContent.slice(0, 40);
  return `${element.tagName} ${fallbackIndex}`;
}

function parseSvgDocument(svgText: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("The uploaded file could not be parsed as SVG.");
  }

  const svg = doc.documentElement;
  if (svg.tagName !== "svg") {
    throw new Error("The uploaded file does not contain a root <svg> element.");
  }

  return { doc, svg };
}

function parsePoints(value: string | null | undefined): FloorplanPoint[] {
  if (!value) return [];
  const numbers = value
    .trim()
    .split(/[\s,]+/)
    .map((entry) => Number.parseFloat(entry))
    .filter((entry) => Number.isFinite(entry));

  const points: FloorplanPoint[] = [];
  for (let index = 0; index < numbers.length; index += 2) {
    if (numbers[index + 1] === undefined) break;
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }
  return points;
}

function formatPoints(points: FloorplanPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function getPathBounds(pathData: string | null | undefined) {
  if (!pathData) return null;

  const tokens = Array.from(
    pathData.matchAll(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi),
    (match) => match[0]
  );
  if (tokens.length === 0) return null;

  let index = 0;
  let command = "";
  let currentX = 0;
  let currentY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;
  const points: FloorplanPoint[] = [];

  function isCommand(value: string | undefined) {
    return Boolean(value && /^[a-zA-Z]$/.test(value));
  }

  function readNumber() {
    const value = Number.parseFloat(tokens[index] ?? "");
    index += 1;
    return Number.isFinite(value) ? value : 0;
  }

  function pushPoint(x: number, y: number) {
    points.push({ x, y });
    currentX = x;
    currentY = y;
  }

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index]!;
      index += 1;
    } else if (!command) {
      index += 1;
      continue;
    }

    const isRelative = command === command.toLowerCase();
    switch (command.toLowerCase()) {
      case "m": {
        const x = readNumber();
        const y = readNumber();
        const nextX = isRelative ? currentX + x : x;
        const nextY = isRelative ? currentY + y : y;
        pushPoint(nextX, nextY);
        subpathStartX = nextX;
        subpathStartY = nextY;
        command = isRelative ? "l" : "L";
        break;
      }
      case "l":
        while (index < tokens.length && !isCommand(tokens[index])) {
          const x = readNumber();
          const y = readNumber();
          pushPoint(isRelative ? currentX + x : x, isRelative ? currentY + y : y);
        }
        break;
      case "h":
        while (index < tokens.length && !isCommand(tokens[index])) {
          const x = readNumber();
          pushPoint(isRelative ? currentX + x : x, currentY);
        }
        break;
      case "v":
        while (index < tokens.length && !isCommand(tokens[index])) {
          const y = readNumber();
          pushPoint(currentX, isRelative ? currentY + y : y);
        }
        break;
      case "c":
        while (index + 5 < tokens.length && !isCommand(tokens[index])) {
          const x1 = readNumber();
          const y1 = readNumber();
          const x2 = readNumber();
          const y2 = readNumber();
          const x = readNumber();
          const y = readNumber();
          points.push(
            { x: isRelative ? currentX + x1 : x1, y: isRelative ? currentY + y1 : y1 },
            { x: isRelative ? currentX + x2 : x2, y: isRelative ? currentY + y2 : y2 }
          );
          pushPoint(isRelative ? currentX + x : x, isRelative ? currentY + y : y);
        }
        break;
      case "s":
      case "q":
        while (index + 3 < tokens.length && !isCommand(tokens[index])) {
          const x1 = readNumber();
          const y1 = readNumber();
          const x = readNumber();
          const y = readNumber();
          points.push({ x: isRelative ? currentX + x1 : x1, y: isRelative ? currentY + y1 : y1 });
          pushPoint(isRelative ? currentX + x : x, isRelative ? currentY + y : y);
        }
        break;
      case "t":
        while (index + 1 < tokens.length && !isCommand(tokens[index])) {
          const x = readNumber();
          const y = readNumber();
          pushPoint(isRelative ? currentX + x : x, isRelative ? currentY + y : y);
        }
        break;
      case "a":
        while (index + 6 < tokens.length && !isCommand(tokens[index])) {
          const rx = readNumber();
          const ry = readNumber();
          readNumber();
          readNumber();
          readNumber();
          const x = readNumber();
          const y = readNumber();
          const nextX = isRelative ? currentX + x : x;
          const nextY = isRelative ? currentY + y : y;
          points.push(
            { x: currentX - rx, y: currentY - ry },
            { x: currentX + rx, y: currentY + ry },
            { x: nextX - rx, y: nextY - ry },
            { x: nextX + rx, y: nextY + ry }
          );
          pushPoint(nextX, nextY);
        }
        break;
      case "z":
        pushPoint(subpathStartX, subpathStartY);
        break;
      default:
        index += 1;
        break;
    }
  }

  return getPointBounds(points);
}

function getPointBounds(points: FloorplanPoint[]) {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function scalePoints(points: FloorplanPoint[], nextWidth?: number, nextHeight?: number) {
  const bounds = getPointBounds(points);
  if (!bounds) return points;

  const scaleX = nextWidth && bounds.width > 0 ? nextWidth / bounds.width : 1;
  const scaleY = nextHeight && bounds.height > 0 ? nextHeight / bounds.height : 1;

  return points.map((point) => ({
    x: bounds.minX + (point.x - bounds.minX) * scaleX,
    y: bounds.minY + (point.y - bounds.minY) * scaleY,
  }));
}

function getNodeBounds(node: Element) {
  switch (node.tagName) {
    case "rect": {
      const x = parseNumericLength(node.getAttribute("x")) ?? 0;
      const y = parseNumericLength(node.getAttribute("y")) ?? 0;
      const width = parseNumericLength(node.getAttribute("width")) ?? 0;
      const height = parseNumericLength(node.getAttribute("height")) ?? 0;
      return { minX: x, minY: y, width, height, centerX: x + width / 2, centerY: y + height / 2 };
    }
    case "circle": {
      const cx = parseNumericLength(node.getAttribute("cx")) ?? 0;
      const cy = parseNumericLength(node.getAttribute("cy")) ?? 0;
      const r = parseNumericLength(node.getAttribute("r")) ?? 0;
      return { minX: cx - r, minY: cy - r, width: r * 2, height: r * 2, centerX: cx, centerY: cy };
    }
    case "ellipse": {
      const cx = parseNumericLength(node.getAttribute("cx")) ?? 0;
      const cy = parseNumericLength(node.getAttribute("cy")) ?? 0;
      const rx = parseNumericLength(node.getAttribute("rx")) ?? 0;
      const ry = parseNumericLength(node.getAttribute("ry")) ?? 0;
      return { minX: cx - rx, minY: cy - ry, width: rx * 2, height: ry * 2, centerX: cx, centerY: cy };
    }
    case "line": {
      const x1 = parseNumericLength(node.getAttribute("x1")) ?? 0;
      const y1 = parseNumericLength(node.getAttribute("y1")) ?? 0;
      const x2 = parseNumericLength(node.getAttribute("x2")) ?? x1;
      const y2 = parseNumericLength(node.getAttribute("y2")) ?? y1;
      return {
        minX: Math.min(x1, x2),
        minY: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        centerX: (x1 + x2) / 2,
        centerY: (y1 + y2) / 2,
      };
    }
    case "polygon":
    case "polyline": {
      const points = parsePoints(node.getAttribute("points"));
      const bounds = getPointBounds(points);
      if (!bounds) return null;
      return {
        minX: bounds.minX,
        minY: bounds.minY,
        width: bounds.width,
        height: bounds.height,
        centerX: bounds.minX + bounds.width / 2,
        centerY: bounds.minY + bounds.height / 2,
      };
    }
    case "text": {
      const x = parseNumericLength(node.getAttribute("x")) ?? 0;
      const y = parseNumericLength(node.getAttribute("y")) ?? 0;
      const fontSize = parseNumericLength(node.getAttribute("font-size")) ?? 28;
      const estimatedWidth = (node.textContent?.length ?? 6) * fontSize * 0.56;
      return {
        minX: x - estimatedWidth / 2,
        minY: y - fontSize,
        width: estimatedWidth,
        height: fontSize,
        centerX: x,
        centerY: y - fontSize / 2,
      };
    }
    case "path": {
      const bounds = getPathBounds(node.getAttribute("d"));
      if (!bounds) return null;
      return {
        minX: bounds.minX,
        minY: bounds.minY,
        width: bounds.width,
        height: bounds.height,
        centerX: bounds.minX + bounds.width / 2,
        centerY: bounds.minY + bounds.height / 2,
      };
    }
    default:
      return null;
  }
}

function applyAmendmentToNode(node: Element, amendment?: FloorplanAmendment) {
  if (!amendment) return;

  if (amendment.hidden) node.setAttribute("display", "none");
  else node.removeAttribute("display");

  if (amendment.fontSize && node.tagName === "text") {
    node.setAttribute("font-size", amendment.fontSize);
  }
  if (amendment.fontFamily && node.tagName === "text") {
    node.setAttribute("font-family", amendment.fontFamily);
  }
  if (amendment.fontWeight && node.tagName === "text") {
    node.setAttribute("font-weight", amendment.fontWeight);
  }
  if (amendment.fontStyle && node.tagName === "text") {
    node.setAttribute("font-style", amendment.fontStyle);
  }
  if (amendment.textContent !== undefined && node.tagName === "text") {
    node.textContent = amendment.textContent;
  }
  if (amendment.fill !== undefined) {
    node.setAttribute("fill", amendment.fill);
  }
  if (amendment.stroke !== undefined) {
    node.setAttribute("stroke", amendment.stroke);
  }
  if (amendment.strokeWidth !== undefined) {
    node.setAttribute("stroke-width", String(amendment.strokeWidth));
  }

  if (node.tagName === "rect") {
    if (amendment.width !== undefined) node.setAttribute("width", String(amendment.width));
    if (amendment.height !== undefined) node.setAttribute("height", String(amendment.height));
    if (amendment.cornerRadiusX !== undefined) node.setAttribute("rx", String(amendment.cornerRadiusX));
    if (amendment.cornerRadiusY !== undefined) node.setAttribute("ry", String(amendment.cornerRadiusY));
  } else if (node.tagName === "circle") {
    if (amendment.radius !== undefined) node.setAttribute("r", String(amendment.radius));
  } else if (node.tagName === "ellipse") {
    if (amendment.radiusX !== undefined) node.setAttribute("rx", String(amendment.radiusX));
    if (amendment.radiusY !== undefined) node.setAttribute("ry", String(amendment.radiusY));
  } else if (node.tagName === "line") {
    if (amendment.x2 !== undefined) node.setAttribute("x2", String(amendment.x2));
    if (amendment.y2 !== undefined) node.setAttribute("y2", String(amendment.y2));
  } else if (node.tagName === "polygon" || node.tagName === "polyline") {
    const points = parsePoints(node.getAttribute("points"));
    const scaledPoints = scalePoints(points, amendment.width, amendment.height);
    if (scaledPoints.length > 0) node.setAttribute("points", formatPoints(scaledPoints));
  }

  const bounds = getNodeBounds(node);
  const baseTransform = node.getAttribute("data-fs-base-transform")?.trim() ?? "";
  const translateX = amendment.translateX ?? 0;
  const translateY = amendment.translateY ?? 0;
  const rotation = amendment.rotation ?? 0;
  const scaleX = amendment.scaleX ?? 1;
  const scaleY = amendment.scaleY ?? 1;
  const parts: string[] = [];
  if (translateX !== 0 || translateY !== 0) {
    parts.push(`translate(${translateX} ${translateY})`);
  }
  if (rotation !== 0 && bounds) {
    parts.push(`rotate(${rotation} ${bounds.centerX} ${bounds.centerY})`);
  }
  if ((scaleX !== 1 || scaleY !== 1) && bounds) {
    parts.push(
      `translate(${bounds.centerX} ${bounds.centerY})`,
      `scale(${scaleX} ${scaleY})`,
      `translate(${-bounds.centerX} ${-bounds.centerY})`
    );
  }
  if (baseTransform) {
    parts.push(baseTransform);
  }
  if (parts.length > 0) {
    node.setAttribute("transform", parts.join(" "));
  } else {
    node.removeAttribute("transform");
  }
}

function createGeneratedNode(doc: XMLDocument, element: FloorplanGeneratedElement) {
  const ns = "http://www.w3.org/2000/svg";

  switch (element.type) {
    case "text": {
      const node = doc.createElementNS(ns, "text");
      node.setAttribute("x", String(element.x));
      node.setAttribute("y", String(element.y));
      node.setAttribute("font-family", element.fontFamily ?? "Arial, sans-serif");
      node.setAttribute("font-weight", element.fontWeight ?? "400");
      node.setAttribute("font-style", element.fontStyle ?? "normal");
      node.setAttribute("font-size", "28");
      node.setAttribute("fill", element.fill ?? "#0f172a");
      node.textContent = element.textContent || "New label";
      return node;
    }
    case "rect": {
      const node = doc.createElementNS(ns, "rect");
      node.setAttribute("x", String(element.x));
      node.setAttribute("y", String(element.y));
      node.setAttribute("width", String(element.width ?? 180));
      node.setAttribute("height", String(element.height ?? 120));
      node.setAttribute("rx", "0");
      node.setAttribute("fill", element.fill ?? "none");
      node.setAttribute("stroke", element.stroke ?? "#0f172a");
      node.setAttribute("stroke-width", String(element.strokeWidth ?? 4));
      return node;
    }
    case "circle": {
      const node = doc.createElementNS(ns, "circle");
      node.setAttribute("cx", String(element.x));
      node.setAttribute("cy", String(element.y));
      node.setAttribute("r", String(element.radius ?? 48));
      node.setAttribute("fill", element.fill ?? "none");
      node.setAttribute("stroke", element.stroke ?? "#0f172a");
      node.setAttribute("stroke-width", String(element.strokeWidth ?? 4));
      return node;
    }
    case "ellipse": {
      const node = doc.createElementNS(ns, "ellipse");
      node.setAttribute("cx", String(element.x));
      node.setAttribute("cy", String(element.y));
      node.setAttribute("rx", String(element.radiusX ?? 72));
      node.setAttribute("ry", String(element.radiusY ?? 44));
      node.setAttribute("fill", element.fill ?? "none");
      node.setAttribute("stroke", element.stroke ?? "#0f172a");
      node.setAttribute("stroke-width", String(element.strokeWidth ?? 4));
      return node;
    }
    case "line": {
      const node = doc.createElementNS(ns, "line");
      node.setAttribute("x1", String(element.x));
      node.setAttribute("y1", String(element.y));
      node.setAttribute("x2", String(element.x2 ?? element.x + 180));
      node.setAttribute("y2", String(element.y2 ?? element.y));
      node.setAttribute("stroke", element.stroke ?? "#0f172a");
      node.setAttribute("stroke-width", String(element.strokeWidth ?? 4));
      return node;
    }
    case "polyline":
    case "polygon": {
      const node = doc.createElementNS(ns, element.type);
      node.setAttribute(
        "points",
        formatPoints(
          element.points ?? [
            { x: element.x, y: element.y },
            { x: element.x + 60, y: element.y + 40 },
            { x: element.x + 120, y: element.y - 20 },
            { x: element.x + 180, y: element.y + 30 },
          ]
        )
      );
      node.setAttribute("fill", element.fill ?? "none");
      node.setAttribute("stroke", element.stroke ?? "#0f172a");
      node.setAttribute("stroke-width", String(element.strokeWidth ?? 4));
      return node;
    }
  }
}

/** Empty canvas for the Annex A floorplan editor (sketch-box aspect ratio). */
export const BLANK_FLOORPLAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"></svg>';

export function createBlankFloorplan(): ParsedFloorplan {
  return parseFloorplan(BLANK_FLOORPLAN_SVG);
}

export function parseFloorplan(svgText: string): ParsedFloorplan {
  const { doc, svg } = parseSvgDocument(svgText);
  const baseViewBox = inferViewBox(svg);
  const layers: FloorplanLayer[] = [];

  Array.from(doc.querySelectorAll(SELECTABLE_TAGS.join(",")))
    .filter(isSelectableElement)
    .forEach((element, index) => {
      const layerId = `node-${index + 1}`;
      element.setAttribute("data-fs-node-id", layerId);
      element.setAttribute("data-fs-selectable", "true");
      element.setAttribute("data-fs-base-transform", element.getAttribute("transform") ?? "");
      if (!element.getAttribute("id")) {
        element.setAttribute("id", layerId);
      }

      layers.push({
        id: layerId,
        label: inferLayerLabel(element, index + 1),
        tagName: element.tagName,
        isText: element.tagName === "text",
        textContent:
          element.tagName === "text"
            ? element.textContent?.replace(/\s+/g, " ").trim() ?? ""
            : undefined,
        isGenerated: false,
      });
    });

  svg.setAttribute("viewBox", `${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.width} ${baseViewBox.height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  return {
    svgText: new XMLSerializer().serializeToString(doc),
    layers,
    baseViewBox,
  };
}

export function renderFloorplanSvg(options: {
  svgText: string;
  amendments: Record<string, FloorplanAmendment>;
  camera: FloorplanViewBox;
  selectedId: string | null;
  generatedElements?: FloorplanGeneratedElement[];
}) {
  const { doc, svg } = parseSvgDocument(options.svgText);
  const { camera, amendments, selectedId, generatedElements = [] } = options;

  svg.setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.width} ${camera.height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  Array.from(doc.querySelectorAll("[data-fs-node-id]")).forEach((node) => {
    const layerId = node.getAttribute("data-fs-node-id");
    if (!layerId) return;
    node.removeAttribute("data-fs-selected");
    if (selectedId === layerId) node.setAttribute("data-fs-selected", "true");
    applyAmendmentToNode(node, amendments[layerId]);
  });

  for (const element of generatedElements) {
    const node = createGeneratedNode(doc, element);
    node.setAttribute("data-fs-node-id", element.id);
    node.setAttribute("data-fs-selectable", "true");
    if (selectedId === element.id) node.setAttribute("data-fs-selected", "true");
    applyAmendmentToNode(node, {
      textContent: element.textContent,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      rotation: element.rotation,
      width: element.width,
      height: element.height,
      radius: element.radius,
      radiusX: element.radiusX,
      radiusY: element.radiusY,
      x2: element.x2,
      y2: element.y2,
      ...amendments[element.id],
    });
    svg.appendChild(node);
  }

  const style = doc.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    [data-fs-selectable="true"] {
      cursor: pointer;
      transition: opacity 120ms ease, filter 120ms ease;
      user-select: none;
      -webkit-user-select: none;
    }
    [data-fs-selected="true"] {
      filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.35));
    }
    text[data-fs-selected="true"] {
      paint-order: stroke;
      stroke: rgba(219, 234, 254, 0.95);
      stroke-width: 4px;
    }
  `;
  svg.insertBefore(style, svg.firstChild);

  return new XMLSerializer().serializeToString(doc);
}

const MEASURE_GRAPHICS_SELECTOR = [
  "[data-fs-node-id]",
  "path",
  "line",
  "polyline",
  "polygon",
  "rect",
  "circle",
  "ellipse",
  "text",
].join(",");

function isFullViewBoxBackground(element: Element, viewBox: FloorplanViewBox): boolean {
  if (element.tagName !== "rect") return false;

  const fill = (element.getAttribute("fill") ?? "").trim().toLowerCase();
  if (fill !== "#ffffff" && fill !== "white" && fill !== "#fff") return false;

  const x = parseNumericLength(element.getAttribute("x")) ?? 0;
  const y = parseNumericLength(element.getAttribute("y")) ?? 0;
  const width = parseNumericLength(element.getAttribute("width")) ?? 0;
  const height = parseNumericLength(element.getAttribute("height")) ?? 0;
  if (width <= 0 || height <= 0) return false;

  const epsilon = Math.max(viewBox.width, viewBox.height) * 0.02;
  return (
    Math.abs(x - viewBox.x) <= epsilon &&
    Math.abs(y - viewBox.y) <= epsilon &&
    Math.abs(width - viewBox.width) <= epsilon &&
    Math.abs(height - viewBox.height) <= epsilon
  );
}

function measureGraphicsBounds(svgRoot: SVGSVGElement, viewBox: FloorplanViewBox): FloorplanViewBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of svgRoot.querySelectorAll(MEASURE_GRAPHICS_SELECTOR)) {
    if (!(node instanceof SVGGraphicsElement)) continue;
    if (node.closest("defs,clipPath,mask,pattern,marker,symbol,style")) continue;
    if (isFullViewBoxBackground(node, viewBox)) continue;

    const box = node.getBBox();
    if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) continue;
    if (box.width === 0 && box.height === 0) continue;

    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Tighten viewBox to actual floorplan geometry so annex compositing centers content. */
export function normalizeSvgViewBoxToContent(
  svgText: string,
  paddingFraction = 0.04,
): string {
  if (typeof document === "undefined") return svgText;

  const { doc, svg } = parseSvgDocument(svgText);
  const currentViewBox = inferViewBox(svg);
  const probe = svg.cloneNode(true) as SVGSVGElement;
  probe.setAttribute("width", "1000");
  probe.setAttribute("height", "1000");

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;";
  document.body.appendChild(host);
  host.appendChild(probe);

  try {
    const bounds = measureGraphicsBounds(probe, currentViewBox);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return svgText;

    const pad = Math.max(bounds.width, bounds.height) * paddingFraction;
    const x = bounds.x - pad;
    const y = bounds.y - pad;
    const width = bounds.width + pad * 2;
    const height = bounds.height + pad * 2;

    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    return new XMLSerializer().serializeToString(doc);
  } finally {
    host.remove();
  }
}

export function getFloorplanElementMetrics(
  svgText: string,
  layerId: string
): FloorplanElementMetrics | null {
  const { doc } = parseSvgDocument(svgText);
  const node = doc.querySelector(`[data-fs-node-id="${layerId}"]`);
  if (!node) return null;

  switch (node.tagName) {
    case "rect": {
      const x = parseNumericLength(node.getAttribute("x")) ?? 0;
      const y = parseNumericLength(node.getAttribute("y")) ?? 0;
      const width = parseNumericLength(node.getAttribute("width")) ?? 0;
      const height = parseNumericLength(node.getAttribute("height")) ?? 0;
      return { tagName: "rect", x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 };
    }
    case "circle": {
      const cx = parseNumericLength(node.getAttribute("cx")) ?? 0;
      const cy = parseNumericLength(node.getAttribute("cy")) ?? 0;
      const radius = parseNumericLength(node.getAttribute("r")) ?? 0;
      return { tagName: "circle", radius, width: radius * 2, height: radius * 2, centerX: cx, centerY: cy };
    }
    case "ellipse": {
      const cx = parseNumericLength(node.getAttribute("cx")) ?? 0;
      const cy = parseNumericLength(node.getAttribute("cy")) ?? 0;
      const radiusX = parseNumericLength(node.getAttribute("rx")) ?? 0;
      const radiusY = parseNumericLength(node.getAttribute("ry")) ?? 0;
      return {
        tagName: "ellipse",
        radiusX,
        radiusY,
        width: radiusX * 2,
        height: radiusY * 2,
        centerX: cx,
        centerY: cy,
      };
    }
    case "line": {
      const x = parseNumericLength(node.getAttribute("x1")) ?? 0;
      const y = parseNumericLength(node.getAttribute("y1")) ?? 0;
      const x2 = parseNumericLength(node.getAttribute("x2")) ?? x;
      const y2 = parseNumericLength(node.getAttribute("y2")) ?? y;
      return {
        tagName: "line",
        x,
        y,
        x2,
        y2,
        width: Math.abs(x2 - x),
        height: Math.abs(y2 - y),
        centerX: (x + x2) / 2,
        centerY: (y + y2) / 2,
      };
    }
    case "polygon":
    case "polyline": {
      const points = parsePoints(node.getAttribute("points"));
      const bounds = getPointBounds(points);
      if (!bounds) return null;
      return {
        tagName: node.tagName,
        width: bounds.width,
        height: bounds.height,
        centerX: bounds.minX + bounds.width / 2,
        centerY: bounds.minY + bounds.height / 2,
      };
    }
    case "path": {
      const bounds = getPathBounds(node.getAttribute("d"));
      if (!bounds) return null;
      return {
        tagName: "path",
        width: bounds.width,
        height: bounds.height,
        centerX: bounds.minX + bounds.width / 2,
        centerY: bounds.minY + bounds.height / 2,
      };
    }
    default:
      return null;
  }
}
