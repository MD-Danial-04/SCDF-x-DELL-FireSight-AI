import {
  computeFloorplanFrameFillRect,
  getAnnexAFloorplanFrameRect,
  ANNEX_A_FLOORPLAN_FRAME,
  ANNEX_A_HEIGHT,
  ANNEX_A_RENDER_SCALE,
  ANNEX_A_WIDTH,
} from "./annexTemplateLayout";
import { drawHeaderValuesOnCanvas } from "./annexHeaderOverlay";
import { getDefaultPagePreviewUrl } from "./annexImageAssets";
import { normalizeSvgViewBoxToContent, prepareSvgForRasterization } from "./floorplanEditor";
import type { PhotoLogHeaderInfo } from "../types/photoLog";

export { ANNEX_A_HEIGHT, ANNEX_A_RENDER_SCALE, ANNEX_A_WIDTH } from "./annexTemplateLayout";

export interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitBoxInput {
  contentWidth: number;
  contentHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

/** Compute contain-fit rectangle for content inside a canvas. */
export function computeContainFitRect(input: FitBoxInput): FitRect {
  const { contentWidth, contentHeight, canvasWidth, canvasHeight } = input;
  if (contentWidth <= 0 || contentHeight <= 0) {
    return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  }

  const scale = Math.min(canvasWidth / contentWidth, canvasHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
}

export function parseSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  if (!match) return null;
  const parts = match[1].trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { width: parts[2], height: parts[3] };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function encodeCanvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to encode PNG"));
      },
      "image/png",
    );
  });
}

export async function svgStringToAnnexPngBlob(svg: string): Promise<Blob> {
  const canvasWidth = ANNEX_A_WIDTH * ANNEX_A_RENDER_SCALE;
  const canvasHeight = ANNEX_A_HEIGHT * ANNEX_A_RENDER_SCALE;
  const rasterSvg = prepareSvgForRasterization(normalizeSvgViewBoxToContent(svg), {
    pixelWidth: canvasWidth,
  });
  const viewBox = parseSvgViewBox(rasterSvg);
  const contentWidth = viewBox?.width ?? ANNEX_A_WIDTH;
  const contentHeight = viewBox?.height ?? ANNEX_A_HEIGHT;

  const fit = computeContainFitRect({
    contentWidth,
    contentHeight,
    canvasWidth,
    canvasHeight,
  });

  const blob = new Blob([rasterSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, fit.x, fit.y, fit.width, fit.height);

    return encodeCanvasPng(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface AnnexTemplatePngOptions {
  /** 0-based bundled template page index (0 = Annex A, 4 = Annex E). */
  templatePageIndex?: number;
}

/** Composite floorplan SVG into the fixed sketch frame on an annex template PNG. */
export async function svgStringToAnnexTemplatePngBlob(
  svg: string,
  header?: PhotoLogHeaderInfo,
  options?: AnnexTemplatePngOptions,
): Promise<Blob> {
  const templatePageIndex = options?.templatePageIndex ?? 0;
  const scale = ANNEX_A_RENDER_SCALE;
  const canvasWidth = ANNEX_A_WIDTH * scale;
  const canvasHeight = ANNEX_A_HEIGHT * scale;
  const templateUrl = getDefaultPagePreviewUrl(templatePageIndex);
  if (!templateUrl) {
    throw new Error(`Annex template image not found for page ${templatePageIndex}`);
  }

  const normalizedSvg = prepareSvgForRasterization(
    normalizeSvgViewBoxToContent(svg),
    { pixelWidth: ANNEX_A_FLOORPLAN_FRAME.width * scale },
  );
  const viewBox = parseSvgViewBox(normalizedSvg);
  const contentWidth = viewBox?.width ?? 1;
  const contentHeight = viewBox?.height ?? 1;
  const fill = computeFloorplanFrameFillRect(contentWidth, contentHeight, scale);

  const svgBlob = new Blob([normalizedSvg], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const [templateImg, svgImg] = await Promise.all([
      loadImage(templateUrl),
      loadImage(svgUrl),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(templateImg, 0, 0, canvasWidth, canvasHeight);

    const frame = getAnnexAFloorplanFrameRect(scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);

    ctx.drawImage(svgImg, fill.x, fill.y, fill.width, fill.height);

    drawHeaderValuesOnCanvas(ctx, header, canvasWidth, canvasHeight);

    return encodeCanvasPng(canvas);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Composite an uploaded raster image into the fixed sketch frame on an annex template PNG. */
export async function imageBlobToAnnexTemplatePngBlob(
  imageSource: Blob,
  header?: PhotoLogHeaderInfo,
  options?: AnnexTemplatePngOptions,
): Promise<Blob> {
  const templatePageIndex = options?.templatePageIndex ?? 0;
  const scale = ANNEX_A_RENDER_SCALE;
  const canvasWidth = ANNEX_A_WIDTH * scale;
  const canvasHeight = ANNEX_A_HEIGHT * scale;
  const templateUrl = getDefaultPagePreviewUrl(templatePageIndex);
  if (!templateUrl) {
    throw new Error(`Annex template image not found for page ${templatePageIndex}`);
  }

  const imageUrl = URL.createObjectURL(imageSource);

  try {
    const [templateImg, uploadImg] = await Promise.all([
      loadImage(templateUrl),
      loadImage(imageUrl),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(templateImg, 0, 0, canvasWidth, canvasHeight);

    const frame = getAnnexAFloorplanFrameRect(scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);

    const fill = computeFloorplanFrameFillRect(
      uploadImg.naturalWidth,
      uploadImg.naturalHeight,
      scale,
    );
    ctx.drawImage(uploadImg, fill.x, fill.y, fill.width, fill.height);

    drawHeaderValuesOnCanvas(ctx, header, canvasWidth, canvasHeight);

    return encodeCanvasPng(canvas);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
