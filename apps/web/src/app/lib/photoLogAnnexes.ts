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
    rowsBottom: 985,
    captionLineHeight: 15,
    cellPaddingY: 8,
    tableLeft: 80,
    tableRight: 640,
    colPhoto: 130,
    colUid: 320,
    colCaption: 520,
  },
  annexF: {
    boxX: 52,
    boxWidth: 615,
    contentTop: 110,
    contentBottom: 980,
    imageBoxHeight: 360,
    minImageBoxHeight: 200,
    blockGap: 12,
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

/**
 * Greedy word-wrap with no line cap. Any single word wider than maxWidth is
 * hard-split across lines so it never overflows the column.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    pushCurrent();

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }

    // Word itself is wider than the column: break it character by character.
    let chunk = "";
    for (const char of word) {
      const next = chunk + char;
      if (ctx.measureText(next).width <= maxWidth) {
        chunk = next;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }

  pushCurrent();
  return lines;
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

function annexDCaptionMaxWidth(): number {
  const { annexD: d } = LAYOUT;
  const captionColLeft = d.colUid + 100;
  return d.tableRight - captionColLeft - 8;
}

function drawAnnexDRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  rowH: number,
  tableLabel: string,
  uid: string,
  captionLines: string[],
): void {
  const { annexD: d } = LAYOUT;
  const captionColLeft = d.colUid + 100;
  const centerY = y + rowH / 2 + 4;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(d.tableLeft, y, d.tableRight - d.tableLeft, rowH);

  ctx.beginPath();
  ctx.moveTo(d.colPhoto + 60, y);
  ctx.lineTo(d.colPhoto + 60, y + rowH);
  ctx.moveTo(d.colUid + 100, y);
  ctx.lineTo(d.colUid + 100, y + rowH);
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.font = "12px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(tableLabel, d.colPhoto, centerY);
  ctx.fillText(uid, d.colUid, centerY);

  if (captionLines.length > 0) {
    ctx.textAlign = "left";
    let lineY = y + d.cellPaddingY + 12;
    for (const line of captionLines) {
      ctx.fillText(line, captionColLeft + 4, lineY);
      lineY += d.captionLineHeight;
    }
  }
}

export async function generateAnnexDBlobs(
  photos: PhotoLogEntry[],
  header?: PhotoLogHeaderInfo,
): Promise<Blob[]> {
  if (photos.length === 0) return [];

  const { annexD: d } = LAYOUT;
  const displayInfo = getPhotoLogDisplayInfo(photos);

  // Measure rows up front so we can flow them across pages with variable heights.
  const measureCtx = createCanvas().ctx;
  measureCtx.font = "12px Arial, sans-serif";
  const captionMaxWidth = annexDCaptionMaxWidth();
  const firstRowTop = d.tableTop + d.rowHeight;
  const maxRowHeight = d.rowsBottom - firstRowTop;

  type MeasuredRow = {
    tableLabel: string;
    uid: string;
    captionLines: string[];
    rowH: number;
  };

  const rows: MeasuredRow[] = displayInfo.map((info) => {
    const caption = info.entry.caption ?? "";
    let captionLines = caption ? wrapText(measureCtx, caption, captionMaxWidth) : [];
    let rowH = Math.max(
      d.rowHeight,
      captionLines.length * d.captionLineHeight + 2 * d.cellPaddingY,
    );

    // Safety: a single caption taller than a full page is truncated to fit.
    if (rowH > maxRowHeight) {
      const maxLines = Math.max(
        1,
        Math.floor((maxRowHeight - 2 * d.cellPaddingY) / d.captionLineHeight),
      );
      captionLines = captionLines.slice(0, maxLines);
      if (captionLines.length > 0) {
        captionLines[captionLines.length - 1] = truncateWithEllipsis(
          measureCtx,
          captionLines[captionLines.length - 1],
          captionMaxWidth,
        );
      }
      rowH = maxRowHeight;
    }

    return { tableLabel: info.tableLabel, uid: info.entry.uid, captionLines, rowH };
  });

  // Pack rows into pages.
  const pages: MeasuredRow[][] = [];
  let currentPage: MeasuredRow[] = [];
  let y = firstRowTop;
  for (const row of rows) {
    if (currentPage.length > 0 && y + row.rowH > d.rowsBottom) {
      pages.push(currentPage);
      currentPage = [];
      y = firstRowTop;
    }
    currentPage.push(row);
    y += row.rowH;
  }
  if (currentPage.length > 0) pages.push(currentPage);

  const blobs: Blob[] = [];
  for (let page = 0; page < pages.length; page++) {
    const { canvas, ctx } = createCanvas();
    drawPageHeader(ctx, "ANNEX D", header);
    drawAnnexDTableHeader(ctx);

    let rowY = firstRowTop;
    for (const row of pages[page]) {
      drawAnnexDRow(ctx, rowY, row.rowH, row.tableLabel, row.uid, row.captionLines);
      rowY += row.rowH;
    }

    drawPageFooter(ctx, pages.length === 1 ? "D-1" : `D-${page + 1}`);
    blobs.push(await encodeCanvasPng(canvas));
  }

  return blobs;
}

function drawPhotoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  boxLabel: string,
  uid: string,
  captionLines: string[],
): void {
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

  if (captionLines.length > 0) {
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    ctx.font = "11px Arial, sans-serif";
    let captionY = labelY + f.captionLineHeight;
    for (const line of captionLines) {
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

  const { annexF: f } = LAYOUT;
  const displayInfo = getPhotoLogDisplayInfo(photos);

  const measureCtx = createCanvas().ctx;
  measureCtx.font = "11px Arial, sans-serif";

  // Non-image vertical chrome per photo block: label row + caption + gap below.
  const labelBlock = f.labelOffset + f.captionLineHeight;
  const availableHeight = f.contentBottom - f.contentTop;

  type LaidOutPhoto = {
    item: (typeof displayInfo)[number];
    captionLines: string[];
    imageBoxHeight: number;
    blockHeight: number;
  };

  const laidOut: LaidOutPhoto[] = displayInfo.map((item) => {
    const caption = item.entry.caption ?? "";
    let captionLines = caption ? wrapText(measureCtx, caption, f.boxWidth) : [];
    let captionH = captionLines.length * f.captionLineHeight;
    let imageBoxHeight = f.imageBoxHeight;
    let blockHeight = imageBoxHeight + labelBlock + captionH + f.blockGap;

    // Safety: ensure a single photo block fits on an empty page by shrinking the
    // image first, then truncating the caption as a last resort.
    if (blockHeight > availableHeight) {
      const overflow = blockHeight - availableHeight;
      const shrink = Math.min(overflow, imageBoxHeight - f.minImageBoxHeight);
      imageBoxHeight -= Math.max(0, shrink);
      blockHeight = imageBoxHeight + labelBlock + captionH + f.blockGap;
    }
    if (blockHeight > availableHeight) {
      const captionBudget =
        availableHeight - imageBoxHeight - labelBlock - f.blockGap;
      const maxLines = Math.max(0, Math.floor(captionBudget / f.captionLineHeight));
      captionLines = captionLines.slice(0, maxLines);
      if (captionLines.length > 0) {
        captionLines[captionLines.length - 1] = truncateWithEllipsis(
          measureCtx,
          captionLines[captionLines.length - 1],
          f.boxWidth,
        );
      }
      captionH = captionLines.length * f.captionLineHeight;
      blockHeight = imageBoxHeight + labelBlock + captionH + f.blockGap;
    }

    return { item, captionLines, imageBoxHeight, blockHeight };
  });

  // Pack photos into pages.
  const pages: LaidOutPhoto[][] = [];
  let currentPage: LaidOutPhoto[] = [];
  let y = f.contentTop;
  for (const photo of laidOut) {
    if (currentPage.length > 0 && y + photo.blockHeight > f.contentBottom) {
      pages.push(currentPage);
      currentPage = [];
      y = f.contentTop;
    }
    currentPage.push(photo);
    y += photo.blockHeight;
  }
  if (currentPage.length > 0) pages.push(currentPage);

  const blobs: Blob[] = [];
  for (let page = 0; page < pages.length; page++) {
    const { canvas, ctx } = createCanvas();
    drawPageHeader(ctx, "ANNEX F", header);

    const pageItems = pages[page];
    const images = await Promise.all(
      pageItems.map((p) => loadImageFromBlob(p.item.entry.blob)),
    );

    let boxY = f.contentTop;
    for (let i = 0; i < pageItems.length; i++) {
      const photo = pageItems[i];
      drawPhotoBox(
        ctx,
        images[i],
        f.boxX,
        boxY,
        f.boxWidth,
        photo.imageBoxHeight,
        photo.item.boxLabel,
        photo.item.entry.uid,
        photo.captionLines,
      );
      boxY += photo.blockHeight;
    }

    drawPageFooter(ctx, pages.length === 1 ? "F-1" : `F-${page + 1}`);
    blobs.push(await encodeCanvasPng(canvas));
  }

  return blobs;
}
