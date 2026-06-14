import { ANNEX_A_HEIGHT, ANNEX_A_WIDTH } from "./annexTemplateLayout";
import type { PhotoLogHeaderInfo } from "../types/photoLog";

/** Value positions in the 719×1058 template coordinate space (after the baked-in labels). */
export const HEADER_VALUE_LAYOUT = {
  incidentValueX: 245,
  incidentValueY: 61,
  locationValueX: 245,
  locationValueY: 83,
  fontSize: 16,
} as const;

/** Annex E static template page index — values use bold+underline to match the label style. */
export const ANNEX_E_PAGE_INDEX = 4;

export interface HeaderValueDrawOptions {
  boldUnderline?: boolean;
}

export function hasHeaderValues(header?: PhotoLogHeaderInfo): boolean {
  return Boolean(header?.incidentNo?.trim() || header?.locationOfFire?.trim());
}

function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
      reject(new Error("Failed to load annex template image"));
    };
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

function drawHeaderValueText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  boldUnderline: boolean,
): void {
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  if (boldUnderline) {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillText(text, x, y);
    const width = ctx.measureText(text).width;
    const underlineY = y + 1;
    ctx.lineWidth = Math.max(1, fontSize / 14);
    ctx.beginPath();
    ctx.moveTo(x, underlineY);
    ctx.lineTo(x + width, underlineY);
    ctx.stroke();
    return;
  }

  ctx.font = `${fontSize}px Arial, sans-serif`;
  ctx.fillText(text, x, y);
}

/** Draw incident/location values onto an existing annex template image. */
export function drawHeaderValuesOnCanvas(
  ctx: CanvasRenderingContext2D,
  header: PhotoLogHeaderInfo | undefined,
  canvasWidth: number,
  canvasHeight: number,
  options: HeaderValueDrawOptions = {},
): void {
  if (!hasHeaderValues(header)) return;

  const scaleX = canvasWidth / ANNEX_A_WIDTH;
  const scaleY = canvasHeight / ANNEX_A_HEIGHT;
  const { incidentValueX, incidentValueY, locationValueX, locationValueY, fontSize } =
    HEADER_VALUE_LAYOUT;
  const scaledFontSize = fontSize * scaleY;
  const boldUnderline = options.boldUnderline ?? false;

  if (header?.incidentNo?.trim()) {
    drawHeaderValueText(
      ctx,
      header.incidentNo.trim(),
      incidentValueX * scaleX,
      incidentValueY * scaleY,
      scaledFontSize,
      boldUnderline,
    );
  }

  if (header?.locationOfFire?.trim()) {
    drawHeaderValueText(
      ctx,
      header.locationOfFire.trim(),
      locationValueX * scaleX,
      locationValueY * scaleY,
      scaledFontSize,
      boldUnderline,
    );
  }
}

export async function compositeHeaderValuesOntoTemplate(
  source: Blob | string,
  header?: PhotoLogHeaderInfo,
  options: HeaderValueDrawOptions = {},
): Promise<Blob> {
  const img = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, 0, 0);
  drawHeaderValuesOnCanvas(ctx, header, canvas.width, canvas.height, options);

  return encodeCanvasPng(canvas);
}
