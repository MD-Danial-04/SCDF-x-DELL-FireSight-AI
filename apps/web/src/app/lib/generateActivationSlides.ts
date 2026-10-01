import pptxgen from "pptxgenjs";
import {
  ACTIVATION_SLIDE_TEMPLATE_ROWS,
  SLIDE1_TITLE,
} from "../constants/activationSlideTableRows";
import type { ActivationSlideData } from "../types/activationSlides";
import { formatFieldForSlide } from "./slideDisplayFormat";
import slideBackgroundUrl from "../../assets/slides/slide-background.png?url";

export interface SlidePhotoInput {
  id: string;
  label: string;
  preview?: string;
}

const SLIDE_W = 10;
const TABLE_W = 8.2;
const TABLE_X = (SLIDE_W - TABLE_W) / 2;
const COL_W: [number, number, number] = [2.55, 4.05, 1.6];
const TABLE_ROW_H = 0.32;
const TABLE_FONT_SIZE = 12;
const TITLE_BOTTOM = 0.77;
const SLIDE_H = 5.625;

function applySlideBackground(slide: pptxgen.Slide) {
  slide.background = { path: slideBackgroundUrl };
}

function buildTemplateTableRows(data: ActivationSlideData): pptxgen.TableRow[] {
  return ACTIVATION_SLIDE_TEMPLATE_ROWS.map((row) => {
    const values = row.valueKeys.map((key) => formatFieldForSlide(key, data[key]));
    if (values.length === 1) {
      return [
        { text: row.label, options: { bold: true, fontSize: TABLE_FONT_SIZE } },
        { text: values[0], options: { fontSize: TABLE_FONT_SIZE } },
        { text: "", options: { fontSize: TABLE_FONT_SIZE } },
      ];
    }
    return [
      { text: row.label, options: { bold: true, fontSize: TABLE_FONT_SIZE } },
      { text: values[0], options: { fontSize: TABLE_FONT_SIZE } },
      { text: values[1], options: { fontSize: TABLE_FONT_SIZE } },
    ];
  });
}

export async function generateActivationSlidesPptx(
  data: ActivationSlideData,
  photos: SlidePhotoInput[]
): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "SCDF Fire Report Generation App";
  pptx.title = `Activation Slides - ${data.incidentNo || "draft"}`;

  // Slide 1: Information table on SCDF background
  const slide1 = pptx.addSlide();
  applySlideBackground(slide1);
  slide1.addText(SLIDE1_TITLE, {
    x: 0,
    y: 0.22,
    w: SLIDE_W,
    h: 0.55,
    fontSize: 26,
    bold: true,
    color: "000000",
    align: "center",
    valign: "middle",
  });
  const tableH = ACTIVATION_SLIDE_TEMPLATE_ROWS.length * TABLE_ROW_H;
  const tableY = TITLE_BOTTOM + (SLIDE_H - TITLE_BOTTOM - tableH - 0.35) / 2;
  slide1.addTable(buildTemplateTableRows(data), {
    x: TABLE_X,
    y: tableY,
    w: TABLE_W,
    colW: COL_W,
    fontSize: TABLE_FONT_SIZE,
    border: { type: "solid", color: "000000", pt: 0.75 },
    margin: 3,
    valign: "middle",
  });

  // Slide 2: case id, remarks, photo row on same background
  const slide2 = pptx.addSlide();
  applySlideBackground(slide2);

  const caseId = formatFieldForSlide("incidentNo", data.incidentNo);
  slide2.addText(caseId, {
    x: 0,
    y: 0.28,
    w: SLIDE_W,
    h: 0.45,
    fontSize: 22,
    bold: true,
    align: "center",
    color: "000000",
  });

  const remarks = formatFieldForSlide("otherRemarks", data.otherRemarks);
  const REMARKS_Y = SLIDE_H - 2.0;
  const REMARKS_H = 0.55;
  slide2.addText(`Other remarks:\n${remarks}`, {
    x: 0.55,
    y: REMARKS_Y,
    w: SLIDE_W - 1.1,
    h: REMARKS_H,
    fontSize: 12,
    color: "000000",
    valign: "top",
  });

  const margin = 0.32;
  const gap = 0.22;
  const slotCount = photos.length;
  const totalSlotsW = SLIDE_W - 2 * margin - (slotCount - 1) * gap;
  const slotW = totalSlotsW / slotCount;
  const captionH = 0.72;
  const photoAreaTop = 0.88;
  const photoAreaBottom = REMARKS_Y - 0.2;
  const availableH = photoAreaBottom - photoAreaTop;
  const imgH = Math.min(2.15, availableH - captionH - 0.12);
  const photoBlockH = imgH + captionH + 0.12;
  const imgY = photoAreaTop + Math.max(0, (availableH - photoBlockH) / 2);
  const captionY = imgY + imgH + 0.1;

  photos.forEach((photo, index) => {
    const x = margin + index * (slotW + gap);
    if (photo.preview) {
      slide2.addImage({
        data: photo.preview,
        x,
        y: imgY,
        w: slotW,
        h: imgH,
        sizing: { type: "contain", w: slotW, h: imgH },
      });
    } else {
      slide2.addShape(pptx.ShapeType.rect, {
        x,
        y: imgY,
        w: slotW,
        h: imgH,
        fill: { color: "FFFFFF", transparency: 40 },
        line: { color: "9CA3AF", width: 1, dashType: "dash" },
      });
      slide2.addText("Upload Photo", {
        x,
        y: imgY + imgH / 2 - 0.18,
        w: slotW,
        h: 0.35,
        fontSize: 11,
        color: "6B7280",
        align: "center",
        valign: "middle",
      });
    }
    slide2.addText(photo.label, {
      x,
      y: captionY,
      w: slotW,
      h: captionH,
      fontSize: 12,
      color: "000000",
      align: "center",
      valign: "top",
    });
  });

  const result = await pptx.write({ outputType: "blob" });
  if (!(result instanceof Blob)) {
    throw new Error("Failed to generate presentation blob");
  }
  return result;
}

export function getActivationSlidesFilename(incidentNo: string): string {
  const safe = incidentNo.trim().replace(/[^\w-]+/g, "_") || "draft";
  return `Activation_Slides_${safe}.pptx`;
}

export function downloadActivationSlides(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
