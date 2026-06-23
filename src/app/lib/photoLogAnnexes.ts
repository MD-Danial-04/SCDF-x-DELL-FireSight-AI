import {
  ANNEX_A_HEIGHT,
  ANNEX_A_RENDER_SCALE,
  ANNEX_A_WIDTH,
} from "./annexTemplateLayout";
import { computeContainFitRect } from "./svgToAnnexPng";
import {
  getPhotoLogDisplayInfo,
  type PhotoLogEntry,
  type PhotoLogHeaderInfo,
} from "../types/photoLog";

const ROWS_PER_D_PAGE = 15;
const PHOTOS_PER_F_PAGE = 2;

const LAYOUT = {
  header: {
    confidentialY: 28,
    labelX: 52,
    incidentY: 65,
    locationY: 90,
    annexX: 580,
    annexY: 65,
  },
  footer: {
    pageNumY: 1010,
    confidentialY: 1035,
  },
  annexD: {
    tableTitleY: 380,
    tableTop: 420,
    rowHeight: 36,
    tableLeft: 80,
    tableRight: 640,
    colPhoto: 130,
    colUid: 320,
    colCaption: 520,
  },
  annexF: {
    boxX: 52,
    boxWidth: 615,
    box1Y: 110,
    box1Height: 360,
    box2Y: 545,
    box2Height: 360,
    labelOffset: 18,
    captionLineHeight: 14,
  },
} as const;

function truncateWithEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + ellipsis).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + ellipsis : ellipsis;
}

function wrapTextToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) {
        const remainder = [word, ...words.slice(i + 1)].join(" ");
        lines[maxLines - 1] = truncateWithEllipsis(
          ctx,
          `${lines[maxLines - 1]} ${remainder}`,
          maxWidth,
        );
        return lines;
      }
      current = ctx.measureText(word).width <= maxWidth
        ? word
        : truncateWithEllipsis(ctx, word, maxWidth);
      if (ctx.measureText(word).width > maxWidth) {
        if (lines.length >= maxLines) return lines;
        lines.push(current);
        current = "";
      }
    } else {
      current = truncateWithEllipsis(ctx, word, maxWidth);
      if (word !== current || ctx.measureText(word).width > maxWidth) {
        lines.push(current);
        current = "";
        if (lines.length >= maxLines) return lines;
      }
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
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

function createCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const scale = ANNEX_A_RENDER_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = ANNEX_A_WIDTH * scale;
  canvas.height = ANNEX_A_HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

function drawPageHeader(
  ctx: CanvasRenderingContext2D,
  annexLabel: string,
  header?: PhotoLogHeaderInfo,
): void {
  const { header: h } = LAYOUT;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ANNEX_A_WIDTH, ANNEX_A_HEIGHT);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText("CONFIDENTIAL", ANNEX_A_WIDTH / 2, h.confidentialY);

  ctx.textAlign = "left";
  ctx.font = "12px Arial, sans-serif";
  const incidentText = header?.incidentNo
    ? `INCIDENT NUMBER : ${header.incidentNo}`
    : "INCIDENT NUMBER :";
  ctx.fillText(incidentText, h.labelX, h.incidentY);

  const locationText = header?.locationOfFire
    ? `LOCATION OF FIRE : ${header.locationOfFire}`
    : "LOCATION OF FIRE :";
  ctx.fillText(locationText, h.labelX, h.locationY);

  ctx.textAlign = "right";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText(annexLabel, ANNEX_A_WIDTH - 52, h.annexY);
}

function drawPageFooter(
  ctx: CanvasRenderingContext2D,
  pageLabel: string,
): void {
  const { footer } = LAYOUT;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(pageLabel, ANNEX_A_WIDTH / 2, footer.pageNumY);
  ctx.fillText("CONFIDENTIAL", ANNEX_A_WIDTH / 2, footer.confidentialY);
}

function drawAnnexDTableHeader(ctx: CanvasRenderingContext2D): void {
  const { annexD: d } = LAYOUT;

  ctx.textAlign = "center";
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText("TABLE OF PHOTO-LOG", ANNEX_A_WIDTH / 2, d.tableTitleY);

  const headerY = d.tableTop;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(d.tableLeft, headerY, d.tableRight - d.tableLeft, d.rowHeight);

  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.fillText("Photo", d.colPhoto, headerY + 24);
  ctx.fillText("Photo UID No.", d.colUid, headerY + 24);
  ctx.fillText("Captions", d.colCaption, headerY + 24);

  ctx.beginPath();
  ctx.moveTo(d.colPhoto + 60, headerY);
  ctx.lineTo(d.colPhoto + 60, headerY + d.rowHeight);
  ctx.moveTo(d.colUid + 100, headerY);
  ctx.lineTo(d.colUid + 100, headerY + d.rowHeight);
  ctx.stroke();
}

function drawAnnexDRow(
  ctx: CanvasRenderingContext2D,
  rowIndex: number,
  tableLabel: string,
  uid: string,
  caption?: string,
): void {
  const { annexD: d } = LAYOUT;
  const y = d.tableTop + d.rowHeight * (rowIndex + 1);
  const captionColLeft = d.colUid + 100;
  const captionMaxWidth = d.tableRight - captionColLeft - 8;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(d.tableLeft, y, d.tableRight - d.tableLeft, d.rowHeight);

  ctx.beginPath();
  ctx.moveTo(d.colPhoto + 60, y);
  ctx.lineTo(d.colPhoto + 60, y + d.rowHeight);
  ctx.moveTo(d.colUid + 100, y);
  ctx.lineTo(d.colUid + 100, y + d.rowHeight);
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.font = "12px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(tableLabel, d.colPhoto, y + 24);
  ctx.fillText(uid, d.colUid, y + 24);

  if (caption) {
    ctx.textAlign = "left";
    ctx.fillText(
      truncateWithEllipsis(ctx, caption, captionMaxWidth),
      captionColLeft + 4,
      y + 24,
    );
  }
}

export async function generateAnnexDBlobs(
  photos: PhotoLogEntry[],
  header?: PhotoLogHeaderInfo,
): Promise<Blob[]> {
  if (photos.length === 0) return [];

  const displayInfo = getPhotoLogDisplayInfo(photos);
  const pageCount = Math.ceil(displayInfo.length / ROWS_PER_D_PAGE);
  const blobs: Blob[] = [];

  for (let page = 0; page < pageCount; page++) {
    const { canvas, ctx } = createCanvas();
    drawPageHeader(ctx, "ANNEX D", header);
    drawAnnexDTableHeader(ctx);

    const start = page * ROWS_PER_D_PAGE;
    const end = Math.min(start + ROWS_PER_D_PAGE, displayInfo.length);
    for (let i = start; i < end; i++) {
      const info = displayInfo[i];
      drawAnnexDRow(
        ctx,
        i - start,
        info.tableLabel,
        info.entry.uid,
        info.entry.caption,
      );
    }

    drawPageFooter(ctx, pageCount === 1 ? "D-1" : `D-${page + 1}`);
    blobs.push(await encodeCanvasPng(canvas));
  }

  return blobs;
}

async function drawPhotoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  boxLabel: string,
  uid: string,
  caption?: string,
): Promise<void> {
  const { annexF: f } = LAYOUT;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  const fit = computeContainFitRect({
    contentWidth: img.naturalWidth,
    contentHeight: img.naturalHeight,
    canvasWidth: boxWidth - 4,
    canvasHeight: boxHeight - 4,
  });

  ctx.drawImage(
    img,
    boxX + 2 + fit.x,
    boxY + 2 + fit.y,
    fit.width,
    fit.height,
  );

  const labelY = boxY + boxHeight + f.labelOffset;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillText(boxLabel, boxX, labelY);

  ctx.fillStyle = "#cc0000";
  ctx.textAlign = "right";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(uid, boxX + boxWidth, labelY);

  if (caption) {
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    ctx.font = "11px Arial, sans-serif";
    const lines = wrapTextToLines(ctx, caption, boxWidth, 2);
    let captionY = labelY + f.captionLineHeight;
    for (const line of lines) {
      ctx.fillText(line, boxX, captionY);
      captionY += f.captionLineHeight;
    }
  }
}

export async function generateAnnexFBlobs(
  photos: PhotoLogEntry[],
  header?: PhotoLogHeaderInfo,
): Promise<Blob[]> {
  if (photos.length === 0) return [];

  const displayInfo = getPhotoLogDisplayInfo(photos);
  const pageCount = Math.ceil(displayInfo.length / PHOTOS_PER_F_PAGE);
  const blobs: Blob[] = [];
  const { annexF: f } = LAYOUT;

  for (let page = 0; page < pageCount; page++) {
    const { canvas, ctx } = createCanvas();
    drawPageHeader(ctx, "ANNEX F", header);

    const start = page * PHOTOS_PER_F_PAGE;
    const pageItems = displayInfo.slice(start, start + PHOTOS_PER_F_PAGE);
    const images = await Promise.all(pageItems.map((item) => loadImageFromBlob(item.entry.blob)));

    for (let i = 0; i < pageItems.length; i++) {
      const boxY = i === 0 ? f.box1Y : f.box2Y;
      const boxHeight = i === 0 ? f.box1Height : f.box2Height;
      await drawPhotoBox(
        ctx,
        images[i],
        f.boxX,
        boxY,
        f.boxWidth,
        boxHeight,
        pageItems[i].boxLabel,
        pageItems[i].entry.uid,
        pageItems[i].entry.caption,
      );
    }

    drawPageFooter(ctx, pageCount === 1 ? "F-1" : `F-${page + 1}`);
    blobs.push(await encodeCanvasPng(canvas));
  }

  return blobs;
}
