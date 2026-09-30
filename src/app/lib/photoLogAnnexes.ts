import { getDefaultPagePreviewUrl } from "./annexImageAssets";
import { computeContainFitRect } from "./svgToAnnexPng";
import { getPhotoLogDisplayInfo, type PhotoLogEntry, type PhotoLogHeaderInfo } from "../types/photoLog";

// Coordinates measured from the supplied deck's 762 x 1100 preview. Render at
// twice that resolution; retain its native proportions and all page furniture.
const WIDTH = 762;
const HEIGHT = 1100;
const SCALE = 2;

function loadImage(source: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    const image = new Image();
    const release = () => { if (typeof source !== "string") URL.revokeObjectURL(url); };
    image.onload = () => { release(); resolve(image); };
    image.onerror = () => { release(); reject(new Error("Unable to load photo annex image")); };
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Unable to encode photo annex")), "image/png",
  ));
}

function createPage(template: HTMLImageElement, section: number, page: number) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.scale(SCALE, SCALE);
  ctx.drawImage(template, 0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "white";
  ctx.fillRect(330, 1055, 105, 30);
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.font = "bold 14px Arial";
  ctx.fillText(`${section} - ${String(page).padStart(2, "0")}`, WIDTH / 2, 1074);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx };
}

/** Wrap even long unbroken IDs so they cannot overflow table cells. */
export function wrapPhotoText(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) {
        lines.push(line); line = "";
      }
      for (const char of (line ? " " : "") + word) {
        if (line && ctx.measureText(line + char).width > width) {
          lines.push(line); line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Section 4 replaces Annex D. Full captions flow onto continuation rows/pages. */
export async function generateAnnexDBlobs(photos: PhotoLogEntry[], _header?: PhotoLogHeaderInfo): Promise<Blob[]> {
  if (!photos.length) return [];
  const template = await loadImage(getDefaultPagePreviewUrl(3)!);
  const measure = createPage(template, 4, 1).ctx;
  measure.font = "18px Arial";
  const rows: { columns: string[][]; height: number }[] = [];
  for (const info of getPhotoLogDisplayInfo(photos)) {
    const label = info.number === null ? info.boxLabel : `PHOTO ${String(info.number).padStart(2, "0")}`;
    const columns = [
      wrapPhotoText(measure, label, 130),
      wrapPhotoText(measure, info.entry.uid, 168),
      wrapPhotoText(measure, info.entry.caption ?? "", 296),
    ];
    // A single long caption/ID can span multiple rows without being discarded.
    const count = Math.max(...columns.map((column) => column.length));
    for (let offset = 0; offset < count; offset += 18) {
      const chunk = columns.map((column, i) => i === 0 && offset >= column.length
        ? column.slice(0, 18) : column.slice(offset, offset + 18));
      rows.push({ columns: chunk, height: Math.max(82, Math.max(...chunk.map((c) => c.length)) * 22 + 18) });
    }
  }
  const pages: typeof rows[] = [];
  let current: typeof rows = [];
  let height = 0;
  for (const row of rows) {
    if (current.length && (height + row.height > 445 || current.length === 5)) {
      pages.push(current); current = []; height = 0;
    }
    current.push(row); height += row.height;
  }
  if (current.length) pages.push(current);

  const output: Blob[] = [];
  for (let page = 0; page < pages.length; page++) {
    const { canvas, ctx } = createPage(template, 4, page + 1);
    // Retain the supplied table header and replace all sample photo IDs/rows.
    ctx.fillStyle = "white";
    ctx.fillRect(55, 274, 659, 446);
    ctx.font = "18px Arial";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    let y = 274;
    const entries = [...pages[page]];
    while (entries.length < 5 && entries.reduce((sum, row) => sum + row.height, 0) + 82 <= 445) {
      entries.push({ columns: [[], [], []], height: 82 });
    }
    for (const row of entries) {
      const edges = [57, 207, 395, 712];
      for (let col = 0; col < 3; col++) {
        ctx.strokeRect(edges[col], y, edges[col + 1] - edges[col], row.height);
        ctx.fillStyle = "black";
        row.columns[col].forEach((line, i) => ctx.fillText(line, edges[col] + 10, y + 25 + i * 22));
      }
      y += row.height;
    }
    output.push(await encode(canvas));
  }
  return output;
}

/** Section 3 replaces Annex F, with three photographs per supplied slide. */
export async function generateAnnexFBlobs(photos: PhotoLogEntry[], _header?: PhotoLogHeaderInfo): Promise<Blob[]> {
  if (!photos.length) return [];
  const template = await loadImage(getDefaultPagePreviewUrl(5)!);
  const info = getPhotoLogDisplayInfo(photos);
  const output: Blob[] = [];
  for (let start = 0; start < info.length; start += 3) {
    const { canvas, ctx } = createPage(template, 3, start / 3 + 1);
    const top = [115, 418, 716];
    // Clear every sample label, including empty slots on the final page.
    ctx.fillStyle = "white";
    top.forEach((y) => ctx.fillRect(495, y, 245, 272));
    for (let slot = 0; slot < 3 && start + slot < info.length; slot++) {
      const item = info[start + slot];
      const image = await loadImage(item.entry.blob);
      const fit = computeContainFitRect({ contentWidth: image.naturalWidth, contentHeight: image.naturalHeight, canvasWidth: 419, canvasHeight: 267 });
      ctx.drawImage(image, 58 + fit.x, top[slot] + 1 + fit.y, fit.width, fit.height);
      ctx.fillStyle = "black";
      ctx.font = "bold 17px Arial";
      const label = item.number === null ? item.boxLabel : `PHOTO ${String(item.number).padStart(2, "0")}:`;
      const labelLines = wrapPhotoText(ctx, label, 220);
      labelLines.forEach((line, i) => ctx.fillText(line, 505, top[slot] + 20 + i * 21));
      ctx.font = "16px Arial";
      wrapPhotoText(ctx, item.entry.uid, 220).slice(0, 10).forEach((line, i) =>
        ctx.fillText(line, 505, top[slot] + 22 + (labelLines.length + i) * 21));
      // Captions are shown in full in Section 4's matching photo-description rows.
    }
    output.push(await encode(canvas));
  }
  return output;
}
