import {
  DEFAULT_OBJECT_FOOTPRINT_INSET_M,
  layoutObjectBoxes,
  objectBoxIntersectsWallSegment,
  orientedBoxesOverlap,
  type ObjectBox2D,
} from "../../floorplan/objects";
import type { Segment2D } from "../../floorplan/types";

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
  editingText?: boolean;
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

export function resolveTextOverlayFontSize(
  attributeFontSize: string | null | undefined,
  computedFontSize: string | null | undefined,
  fallback = "28",
): string {
  if (computedFontSize) {
    const parsed = Number.parseFloat(computedFontSize);
    if (Number.isFinite(parsed) && parsed > 0) {
      return String(parsed);
    }
  }
  if (attributeFontSize) {
    const parsed = Number.parseFloat(attributeFontSize);
    if (Number.isFinite(parsed) && parsed >= 4) {
      return String(parsed);
    }
  }
  return fallback;
}

export type FloorplanShapeType =
  | "text"
  | "rect"
  | "objectBox"
  | "circle"
  | "ellipse"
  | "line"
  | "polyline"
  | "polygon";

export interface FloorplanPoint {
  x: number;
  y: number;
}

export type ObjectBoxShape =
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "polyline"
  | "polygon";

export const OBJECT_BOX_SHAPE_OPTIONS: { value: ObjectBoxShape; label: string }[] = [
  { value: "rect", label: "Rectangle" },
  { value: "circle", label: "Circle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "line", label: "Line" },
  { value: "polyline", label: "Polyline" },
  { value: "polygon", label: "Polygon" },
];

export interface FloorplanGeneratedElement {
  id: string;
  type: FloorplanShapeType;
  label: string;
  textContent?: string;
  fontFamily?: string;
  fontSize?: number;
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
  objectLabel?: string;
  objectBoxShape?: ObjectBoxShape;
}

export interface ObjectBoxDefaults {
  width: number;
  height: number;
  strokeWidth: number;
  labelFontSize: number;
}

export function inferObjectBoxDefaults(
  viewBox: FloorplanViewBox,
  svgText: string,
): ObjectBoxDefaults {
  const wallMatch = svgText.match(/data-layer="walls"[^>]*stroke-width="([^"]+)"/);
  const strokeWidth = wallMatch
    ? Number.parseFloat(wallMatch[1])
    : Math.max(viewBox.width, viewBox.height) * 0.01;
  const width = viewBox.width * 0.12;
  const height = viewBox.height * 0.1;
  const labelFontSize = Math.min(width, height) * 0.25;
  return { width, height, strokeWidth, labelFontSize };
}

export function inferTextFontSize(viewBox: FloorplanViewBox, svgText: string): number {
  return inferObjectBoxDefaults(viewBox, svgText).labelFontSize;
}

export function getObjectBoxBounds(element: FloorplanGeneratedElement) {
  const width = element.width ?? 180;
  const height = element.height ?? 120;
  return {
    x: element.x,
    y: element.y,
    width,
    height,
    centerX: element.x + width / 2,
    centerY: element.y + height / 2,
  };
}

function defaultObjectBoxPolylinePoints(x: number, y: number, width: number, height: number): FloorplanPoint[] {
  return [
    { x, y: y + height * 0.7 },
    { x: x + width * 0.35, y: y + height * 0.3 },
    { x: x + width * 0.65, y: y + height * 0.5 },
    { x: x + width, y: y + height * 0.2 },
  ];
}

function defaultObjectBoxPolygonPoints(
  x: number,
  y: number,
  width: number,
  height: number,
): FloorplanPoint[] {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return [
    { x: centerX, y },
    { x: x + width, y: centerY },
    { x: centerX, y: y + height },
    { x, y: centerY },
  ];
}

function populateObjectBoxShapeFields(
  element: FloorplanGeneratedElement,
  shape: ObjectBoxShape,
): FloorplanGeneratedElement {
  const { x, y, width, height, centerX, centerY } = getObjectBoxBounds(element);

  switch (shape) {
    case "circle":
      return { ...element, objectBoxShape: shape, radius: Math.min(width, height) / 2 };
    case "ellipse":
      return { ...element, objectBoxShape: shape, radiusX: width / 2, radiusY: height / 2 };
    case "line":
      return {
        ...element,
        objectBoxShape: shape,
      };
    case "polyline":
      return {
        ...element,
        objectBoxShape: shape,
        points: defaultObjectBoxPolylinePoints(x, y, width, height),
      };
    case "polygon":
      return {
        ...element,
        objectBoxShape: shape,
        points: defaultObjectBoxPolygonPoints(x, y, width, height),
      };
    default:
      return { ...element, objectBoxShape: "rect" };
  }
}

export function convertObjectBoxShape(
  element: FloorplanGeneratedElement,
  newShape: ObjectBoxShape,
): FloorplanGeneratedElement {
  if (element.type !== "objectBox") return element;
  const bounds = getObjectBoxBounds(element);
  const base: FloorplanGeneratedElement = {
    ...element,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    radius: undefined,
    radiusX: undefined,
    radiusY: undefined,
    x2: undefined,
    y2: undefined,
    points: undefined,
  };
  return populateObjectBoxShapeFields(base, newShape);
}

export function createDefaultObjectBox(
  centerX: number,
  centerY: number,
  viewBox: FloorplanViewBox,
  svgText: string,
  shape: ObjectBoxShape = "rect",
): FloorplanGeneratedElement {
  const { width, height, strokeWidth } = inferObjectBoxDefaults(viewBox, svgText);
  const base: FloorplanGeneratedElement = {
    id: `generated-objectBox-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    type: "objectBox",
    label: "Object box",
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth,
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
  return populateObjectBoxShapeFields(base, shape);
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
    case "g": {
      if (node.getAttribute("data-fs-object-box") !== "true") return null;
      const rect = node.querySelector("rect");
      return rect ? getNodeBounds(rect) : null;
    }
    default:
      return null;
  }
}

function applyObjectBoxAmendment(node: Element, amendment?: FloorplanAmendment) {
  const rect = node.querySelector("rect");
  const text = node.querySelector("text");
  if (rect) {
    if (amendment?.width !== undefined) rect.setAttribute("width", String(amendment.width));
    if (amendment?.height !== undefined) rect.setAttribute("height", String(amendment.height));
  }
  const bounds = rect ? getNodeBounds(rect) : null;
  if (text && bounds) {
    text.setAttribute("x", String(bounds.centerX));
    text.setAttribute("y", String(bounds.centerY));
    const width = parseNumericLength(rect?.getAttribute("width")) ?? bounds.width;
    const height = parseNumericLength(rect?.getAttribute("height")) ?? bounds.height;
    text.setAttribute("font-size", String(Math.min(width, height) * 0.25));
  }
}

function applyAmendmentToNode(node: Element, amendment?: FloorplanAmendment) {
  if (!amendment) return;

  if (amendment.hidden) node.setAttribute("display", "none");
  else node.removeAttribute("display");

  if (node.tagName === "g" && node.getAttribute("data-fs-object-box") === "true") {
    applyObjectBoxAmendment(node, amendment);
  }

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

function withAmendment(
  element: FloorplanGeneratedElement,
  amendment: FloorplanAmendment | undefined,
): FloorplanGeneratedElement {
  if (!amendment) return element;
  return {
    ...element,
    textContent: amendment.textContent ?? element.textContent,
    fill: amendment.fill ?? element.fill,
    stroke: amendment.stroke ?? element.stroke,
    strokeWidth: amendment.strokeWidth ?? element.strokeWidth,
    width: amendment.width ?? element.width,
    height: amendment.height ?? element.height,
    rotation: amendment.rotation ?? element.rotation,
    radius: amendment.radius ?? element.radius,
    radiusX: amendment.radiusX ?? element.radiusX,
    radiusY: amendment.radiusY ?? element.radiusY,
    x2: amendment.x2 ?? element.x2,
    y2: amendment.y2 ?? element.y2,
    fontSize:
      amendment.fontSize !== undefined
        ? Number.parseFloat(amendment.fontSize) || element.fontSize
        : element.fontSize,
  };
}

function appendObjectBoxShapeNode(
  doc: XMLDocument,
  group: Element,
  element: FloorplanGeneratedElement,
) {
  const ns = "http://www.w3.org/2000/svg";
  const { x, y, width, height, centerX, centerY } = getObjectBoxBounds(element);
  const shape = element.objectBoxShape ?? "rect";
  const fill = element.fill ?? "#ffffff";
  const stroke = element.stroke ?? "#000000";
  const strokeWidth = String(element.strokeWidth ?? 0.05);
  const strokeAttrs = {
    stroke,
    "stroke-width": strokeWidth,
    "stroke-linecap": "square",
  };

  switch (shape) {
    case "circle": {
      const node = doc.createElementNS(ns, "circle");
      node.setAttribute("cx", String(centerX));
      node.setAttribute("cy", String(centerY));
      node.setAttribute("r", String(Math.min(width, height) / 2));
      node.setAttribute("fill", fill);
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", strokeWidth);
      group.appendChild(node);
      break;
    }
    case "ellipse": {
      const node = doc.createElementNS(ns, "ellipse");
      node.setAttribute("cx", String(centerX));
      node.setAttribute("cy", String(centerY));
      node.setAttribute("rx", String(width / 2));
      node.setAttribute("ry", String(height / 2));
      node.setAttribute("fill", fill);
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", strokeWidth);
      group.appendChild(node);
      break;
    }
    case "line": {
      const node = doc.createElementNS(ns, "line");
      node.setAttribute("x1", String(x));
      node.setAttribute("y1", String(centerY));
      node.setAttribute("x2", String(x + width));
      node.setAttribute("y2", String(centerY));
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", strokeWidth);
      group.appendChild(node);
      break;
    }
    case "polyline": {
      const node = doc.createElementNS(ns, "polyline");
      node.setAttribute(
        "points",
        formatPoints(element.points ?? defaultObjectBoxPolylinePoints(x, y, width, height)),
      );
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", strokeWidth);
      group.appendChild(node);
      break;
    }
    case "polygon": {
      const node = doc.createElementNS(ns, "polygon");
      node.setAttribute(
        "points",
        formatPoints(element.points ?? defaultObjectBoxPolygonPoints(x, y, width, height)),
      );
      node.setAttribute("fill", fill);
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", strokeWidth);
      group.appendChild(node);
      break;
    }
    default: {
      const node = doc.createElementNS(ns, "rect");
      node.setAttribute("x", String(x));
      node.setAttribute("y", String(y));
      node.setAttribute("width", String(width));
      node.setAttribute("height", String(height));
      node.setAttribute("fill", fill);
      Object.entries(strokeAttrs).forEach(([key, value]) => node.setAttribute(key, value));
      group.appendChild(node);
      break;
    }
  }
}

function createGeneratedNode(doc: XMLDocument, element: FloorplanGeneratedElement) {
  const ns = "http://www.w3.org/2000/svg";

  switch (element.type) {
    case "text": {
      const node = doc.createElementNS(ns, "text");
      node.setAttribute("x", String(element.x));
      node.setAttribute("y", String(element.y));
      node.setAttribute("text-anchor", "middle");
      node.setAttribute("dominant-baseline", "middle");
      node.setAttribute("font-family", element.fontFamily ?? "Arial, sans-serif");
      node.setAttribute("font-weight", element.fontWeight ?? "400");
      node.setAttribute("font-style", element.fontStyle ?? "normal");
      node.setAttribute("font-size", String(element.fontSize ?? 15));
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
    case "objectBox": {
      const { width, height, centerX, centerY } = getObjectBoxBounds(element);
      const labelFontSize = Math.min(width, height) * 0.25;

      const group = doc.createElementNS(ns, "g");
      group.setAttribute("data-fs-object-box", "true");
      appendObjectBoxShapeNode(doc, group, element);

      if (element.objectLabel?.trim()) {
        const text = doc.createElementNS(ns, "text");
        text.setAttribute("x", String(centerX));
        text.setAttribute("y", String(centerY));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-family", "Arial, Helvetica, sans-serif");
        text.setAttribute("font-size", String(labelFontSize));
        text.setAttribute("fill", "#000000");
        text.setAttribute("stroke", "none");
        text.textContent = element.objectLabel.trim();
        group.appendChild(text);
      }

      return group;
    }
  }
}

function findOrCreateObjectsLayer(
  doc: XMLDocument,
  svg: SVGSVGElement,
  strokeWidth: number,
): Element {
  const existing = svg.querySelector('[data-layer="objects"]');
  if (existing) return existing;

  const layer = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("data-layer", "objects");
  layer.setAttribute("fill", "none");
  layer.setAttribute("stroke", "#000000");
  layer.setAttribute("stroke-width", String(strokeWidth));
  layer.setAttribute("stroke-linecap", "square");
  svg.appendChild(layer);
  return layer;
}

function appendGeneratedNode(
  doc: XMLDocument,
  svg: SVGSVGElement,
  element: FloorplanGeneratedElement,
  amendment: FloorplanAmendment | undefined,
  selectedId: string | null,
  viewBox: FloorplanViewBox,
  svgText: string,
) {
  const resolvedFontSize =
    amendment?.fontSize ??
    (element.fontSize != null ? String(element.fontSize) : String(inferTextFontSize(viewBox, svgText)));
  const effective = withAmendment(
    element.type === "text" ? { ...element, fontSize: Number.parseFloat(resolvedFontSize) || element.fontSize } : element,
    amendment,
  );
  const node = createGeneratedNode(doc, effective);
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
    fontSize: element.type === "text" ? resolvedFontSize : undefined,
    ...amendment,
  });

  if (element.type === "objectBox") {
    const objectsLayer = findOrCreateObjectsLayer(
      doc,
      svg,
      element.strokeWidth ?? 0.05,
    );
    objectsLayer.appendChild(node);
  } else {
    svg.appendChild(node);
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
  tagFloorplanBackgroundElements(doc, baseViewBox);
  const layers: FloorplanLayer[] = [];

  Array.from(doc.querySelectorAll(SELECTABLE_TAGS.join(",")))
    .filter(isSelectableElement)
    .forEach((element) => {
      if (element.getAttribute("data-fs-background") === "true") return;

      const layerIndex = layers.length + 1;
      const layerId = `node-${layerIndex}`;
      element.setAttribute("data-fs-node-id", layerId);
      element.setAttribute("data-fs-selectable", "true");
      element.setAttribute("data-fs-base-transform", element.getAttribute("transform") ?? "");
      if (!element.getAttribute("id")) {
        element.setAttribute("id", layerId);
      }

      layers.push({
        id: layerId,
        label: inferLayerLabel(element, layerIndex),
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
  const baseViewBox = inferViewBox(svg);
  tagFloorplanBackgroundElements(doc, baseViewBox);

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
    appendGeneratedNode(doc, svg, element, amendments[element.id], selectedId, baseViewBox, options.svgText);
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
    [data-fs-background="true"] {
      pointer-events: none;
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

function parseElementFill(element: Element): string | null {
  const fill = element.getAttribute("fill")?.trim();
  if (fill) return fill;
  const style = element.getAttribute("style") ?? "";
  const match = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

function isWhiteFill(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized === "white" || normalized === "#fff" || normalized === "#ffffff") return true;

  const rgbMatch = normalized.match(/^rgba?\((\d+),(\d+),(\d+)(?:,[\d.]+)?\)$/);
  if (rgbMatch) {
    return rgbMatch.slice(1, 4).every((channel) => Number(channel) >= 250);
  }

  return false;
}

function resolveRectBounds(element: Element, viewBox: FloorplanViewBox) {
  const parseAxis = (value: string | null | undefined, origin: number, span: number, defaultValue: number) => {
    if (!value?.trim()) return defaultValue;
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      const ratio = Number.parseFloat(trimmed) / 100;
      return Number.isFinite(ratio) ? origin + span * ratio : defaultValue;
    }
    return parseNumericLength(value) ?? defaultValue;
  };

  const parseSpan = (value: string | null | undefined, span: number, defaultValue: number) => {
    if (!value?.trim()) return defaultValue;
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      const ratio = Number.parseFloat(trimmed) / 100;
      return Number.isFinite(ratio) ? span * ratio : defaultValue;
    }
    return parseNumericLength(value) ?? defaultValue;
  };

  const x = parseAxis(element.getAttribute("x"), viewBox.x, viewBox.width, viewBox.x);
  const y = parseAxis(element.getAttribute("y"), viewBox.y, viewBox.height, viewBox.y);
  const width = parseSpan(element.getAttribute("width"), viewBox.width, viewBox.width);
  const height = parseSpan(element.getAttribute("height"), viewBox.height, viewBox.height);

  return { x, y, width, height };
}

function isFullViewBoxBackground(element: Element, viewBox: FloorplanViewBox): boolean {
  if (element.tagName !== "rect") return false;

  const { x, y, width, height } = resolveRectBounds(element, viewBox);
  if (width <= 0 || height <= 0) return false;

  const epsilon = Math.max(viewBox.width, viewBox.height) * 0.02;
  const geometryMatch =
    Math.abs(x - viewBox.x) <= epsilon &&
    Math.abs(y - viewBox.y) <= epsilon &&
    Math.abs(width - viewBox.width) <= epsilon &&
    Math.abs(height - viewBox.height) <= epsilon;
  const coverage = (width * height) / (viewBox.width * viewBox.height);
  const coversViewBox = geometryMatch || coverage >= 0.98;
  if (!coversViewBox) return false;

  const fill = parseElementFill(element);
  if (fill && fill !== "none" && !isWhiteFill(fill)) return false;

  return true;
}

function tagFloorplanBackgroundElements(doc: Document, viewBox: FloorplanViewBox) {
  for (const element of doc.querySelectorAll("rect")) {
    if (!isSelectableElement(element)) continue;
    if (!isFullViewBoxBackground(element, viewBox)) continue;

    element.setAttribute("data-fs-background", "true");
    element.setAttribute("pointer-events", "none");
    element.removeAttribute("data-fs-node-id");
    element.removeAttribute("data-fs-selectable");
    element.removeAttribute("data-fs-selected");
    element.removeAttribute("data-fs-base-transform");

    const id = element.getAttribute("id");
    if (id?.startsWith("node-")) {
      element.removeAttribute("id");
    }
  }
}

export function isFloorplanBackgroundElement(element: Element, viewBox: FloorplanViewBox): boolean {
  const rect = element.closest("rect");
  if (!rect) return element.closest('[data-fs-background="true"]') !== null;
  if (rect.getAttribute("data-fs-background") === "true") return true;
  return isFullViewBoxBackground(rect, viewBox);
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

function parseRotationFromTransform(transform: string | null | undefined): number {
  if (!transform) return 0;
  const match = transform.match(/rotate\(([-\d.]+)/);
  return match ? Number.parseFloat(match[1]) : 0;
}

export function parseWallSegmentsFromSvg(svgText: string): Segment2D[] {
  const { doc } = parseSvgDocument(svgText);
  const wallsLayer = doc.querySelector('[data-layer="walls"]');
  if (!wallsLayer) return [];

  return Array.from(wallsLayer.querySelectorAll("line")).map((line, index) => ({
    kind: "segment" as const,
    wallId: line.getAttribute("id") ?? `wall-${index + 1}`,
    start: {
      x: parseNumericLength(line.getAttribute("x1")) ?? 0,
      z: parseNumericLength(line.getAttribute("y1")) ?? 0,
    },
    end: {
      x: parseNumericLength(line.getAttribute("x2")) ?? 0,
      z: parseNumericLength(line.getAttribute("y2")) ?? 0,
    },
  }));
}

function importedObjectRectToObjectBox(
  node: Element,
  layerId: string,
  amendment?: FloorplanAmendment,
): ObjectBox2D {
  const x = parseNumericLength(node.getAttribute("x")) ?? 0;
  const y = parseNumericLength(node.getAttribute("y")) ?? 0;
  const width =
    amendment?.width ?? parseNumericLength(node.getAttribute("width")) ?? 0;
  const height =
    amendment?.height ?? parseNumericLength(node.getAttribute("height")) ?? 0;
  const translateX = amendment?.translateX ?? 0;
  const translateY = amendment?.translateY ?? 0;
  const baseRotation = parseRotationFromTransform(
    node.getAttribute("data-fs-base-transform"),
  );
  const rotationDeg = baseRotation + (amendment?.rotation ?? 0);

  return {
    id: layerId,
    center: {
      x: x + width / 2 + translateX,
      z: y + height / 2 + translateY,
    },
    widthM: width,
    depthM: height,
    rotationDeg,
  };
}

function generatedObjectBoxToObjectBox(
  element: FloorplanGeneratedElement,
  amendment?: FloorplanAmendment,
): ObjectBox2D {
  const width = amendment?.width ?? element.width ?? 0;
  const height = amendment?.height ?? element.height ?? 0;
  const translateX = amendment?.translateX ?? 0;
  const translateY = amendment?.translateY ?? 0;
  const rotationDeg = amendment?.rotation ?? element.rotation ?? 0;

  return {
    id: element.id,
    center: {
      x: element.x + width / 2 + translateX,
      z: element.y + height / 2 + translateY,
    },
    widthM: width,
    depthM: height,
    rotationDeg,
  };
}

export function collectGeneratedObjectBoxes(
  generatedElements: FloorplanGeneratedElement[],
  amendments: Record<string, FloorplanAmendment>,
): ObjectBox2D[] {
  return generatedElements
    .filter((element) => element.type === "objectBox")
    .map((element) => generatedObjectBoxToObjectBox(element, amendments[element.id]));
}

export function collectObjectBoxesFromFloorplan(
  svgText: string,
  generatedElements: FloorplanGeneratedElement[],
  amendments: Record<string, FloorplanAmendment>,
): ObjectBox2D[] {
  const { doc } = parseSvgDocument(svgText);
  const boxes: ObjectBox2D[] = [];

  doc
    .querySelectorAll('[data-layer="objects"] rect[data-fs-node-id]')
    .forEach((node) => {
      const layerId = node.getAttribute("data-fs-node-id");
      if (!layerId) return;
      boxes.push(importedObjectRectToObjectBox(node, layerId, amendments[layerId]));
    });

  for (const element of generatedElements) {
    if (element.type !== "objectBox") continue;
    boxes.push(generatedObjectBoxToObjectBox(element, amendments[element.id]));
  }

  return boxes;
}

export interface ObjectBoxLayoutResult {
  amendments: Record<string, FloorplanAmendment>;
  generatedElements: FloorplanGeneratedElement[];
  unresolved: boolean;
}

export function applyObjectBoxLayout(options: {
  svgText: string;
  generatedElements: FloorplanGeneratedElement[];
  amendments: Record<string, FloorplanAmendment>;
  viewBox: FloorplanViewBox;
}): ObjectBoxLayoutResult {
  const { svgText, generatedElements, amendments, viewBox } = options;
  const boxes = collectGeneratedObjectBoxes(generatedElements, amendments);
  if (boxes.length === 0) {
    return { amendments, generatedElements, unresolved: false };
  }

  const defaults = inferObjectBoxDefaults(viewBox, svgText);
  const clearanceM = defaults.strokeWidth / 2 + DEFAULT_OBJECT_FOOTPRINT_INSET_M;
  const wallSegments = parseWallSegmentsFromSvg(svgText);
  const layout = layoutObjectBoxes(boxes, wallSegments, clearanceM);

  const nextAmendments = { ...amendments };
  const nextGenerated = generatedElements.map((element) => ({ ...element }));

  for (const box of layout) {
    const generated = nextGenerated.find(
      (element) => element.id === box.id && element.type === "objectBox",
    );
    if (!generated) continue;

    const amendment = nextAmendments[box.id] ?? {};
    const width = amendment.width ?? generated.width ?? box.widthM;
    const height = amendment.height ?? generated.height ?? box.depthM;
    generated.x = box.center.x - width / 2;
    generated.y = box.center.z - height / 2;
    nextAmendments[box.id] = {
      ...amendment,
      translateX: 0,
      translateY: 0,
      rotation: box.rotationDeg,
    };
  }

  let unresolved = false;
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      if (orientedBoxesOverlap(layout[i], layout[j])) {
        unresolved = true;
        break;
      }
    }
    if (unresolved) break;
    for (const wall of wallSegments) {
      if (objectBoxIntersectsWallSegment(layout[i], wall, clearanceM)) {
        unresolved = true;
        break;
      }
    }
    if (unresolved) break;
  }

  return {
    amendments: nextAmendments,
    generatedElements: nextGenerated,
    unresolved,
  };
}
