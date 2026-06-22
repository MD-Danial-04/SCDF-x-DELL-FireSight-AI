export interface AnnexGBurnChartFields {
  incidentNo: string;
  locationOfFire: string;
  nameOfVictim: string;
  nricFinNumber: string;
}

export interface AnnexGFieldBox {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export const ANNEX_G_TEMPLATE_WIDTH = 719;
export const ANNEX_G_TEMPLATE_HEIGHT = 1058;

export const ANNEX_G_FIELD_BOXES: Record<keyof AnnexGBurnChartFields, AnnexGFieldBox> = {
  incidentNo: { x: 170, y: 13, width: 210, height: 26, fontSize: 15 },
  locationOfFire: { x: 170, y: 35, width: 240, height: 26, fontSize: 15 },
  nameOfVictim: { x: 170, y: 914, width: 150, height: 22, fontSize: 12 },
  nricFinNumber: { x: 170, y: 939, width: 130, height: 22, fontSize: 12 },
};

// Crop only the anatomy drawing area from the source reference image.
// The footer/legend region is rebuilt separately below, so it must not be
// included in this source crop.
const MAIN_IMAGE_SOURCE = { x: 47, y: 153, width: 632, height: 717 };
const MAIN_IMAGE_TARGET = { x: 8, y: 58, width: 703, height: 789 };

function sx(canvasWidth: number, value: number) {
  return (value / ANNEX_G_TEMPLATE_WIDTH) * canvasWidth;
}

function sy(canvasHeight: number, value: number) {
  return (value / ANNEX_G_TEMPLATE_HEIGHT) * canvasHeight;
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineWidth = 1,
) {
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  bold = false,
) {
  if (!text.trim()) return;
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${bold ? "700" : "400"} ${fontSize}px Arial, sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawStaticTemplateChrome(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const scaleX = width / ANNEX_G_TEMPLATE_WIDTH;
  const scaleY = height / ANNEX_G_TEMPLATE_HEIGHT;
  const lineWidth = Math.max(1, scaleY * 1.2);

  drawText(ctx, "INCIDENT NUMBER:", sx(width, 8), sy(height, 27), sy(height, 15), true);
  drawText(ctx, "LOCATION OF FIRE:", sx(width, 8), sy(height, 49), sy(height, 15), true);
  drawText(ctx, "ANNEX G", sx(width, 606), sy(height, 24), sy(height, 16), true);

  drawLine(ctx, sx(width, 8), sy(height, 31), sx(width, 154), sy(height, 31), lineWidth);
  drawLine(ctx, sx(width, 8), sy(height, 53), sx(width, 161), sy(height, 53), lineWidth);
  drawLine(ctx, sx(width, 592), sy(height, 27), sx(width, 719), sy(height, 27), lineWidth);

  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, scaleY * 2.2);
  ctx.strokeRect(
    sx(width, 8),
    sy(height, 58),
    sx(width, 703),
    sy(height, 789),
  );
  ctx.restore();

  drawLine(ctx, sx(width, 8), sy(height, 847), sx(width, 711), sy(height, 847), Math.max(1, scaleY * 2.2));
  drawLine(ctx, sx(width, 8), sy(height, 909), sx(width, 440), sy(height, 909), Math.max(1, scaleY * 2.2));
  drawLine(ctx, sx(width, 440), sy(height, 847), sx(width, 440), sy(height, 1051), Math.max(1, scaleY * 2.2));

  drawText(ctx, "SKETCH :", sx(width, 24), sy(height, 879), sy(height, 13), true);
  drawText(ctx, "BURN CHART", sx(width, 131), sy(height, 879), sy(height, 18), true);
  drawText(ctx, "LEGEND:", sx(width, 459), sy(height, 879), sy(height, 12), true);
  drawLine(ctx, sx(width, 23), sy(height, 882), sx(width, 74), sy(height, 882), Math.max(1, scaleY));
  drawLine(ctx, sx(width, 459), sy(height, 881), sx(width, 510), sy(height, 881), Math.max(1, scaleY));

  drawText(ctx, "NAME OF VICTIM  :", sx(width, 16), sy(height, 931), sy(height, 12), true);
  drawText(ctx, "NRIC/FIN NUMBER:", sx(width, 9), sy(height, 956), sy(height, 12), true);
  drawLine(ctx, sx(width, 193), sy(height, 961), sx(width, 272), sy(height, 961), Math.max(1, scaleY));

  ctx.save();
  ctx.fillStyle = "#9b9b9b";
  ctx.fillRect(sx(width, 460), sy(height, 895), sx(width, 53), sy(height, 28));
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, scaleY * 1.2);
  ctx.strokeRect(sx(width, 460), sy(height, 895), sx(width, 53), sy(height, 28));
  ctx.restore();
  drawText(ctx, "THE AFFECTED AREA", sx(width, 531), sy(height, 916), sy(height, 11));
}

export function buildAnnexGBaseTemplateCanvas(source: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = ANNEX_G_TEMPLATE_WIDTH;
  canvas.height = ANNEX_G_TEMPLATE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawStaticTemplateChrome(ctx, canvas.width, canvas.height);
  ctx.drawImage(
    source,
    MAIN_IMAGE_SOURCE.x,
    MAIN_IMAGE_SOURCE.y,
    MAIN_IMAGE_SOURCE.width,
    MAIN_IMAGE_SOURCE.height,
    MAIN_IMAGE_TARGET.x,
    MAIN_IMAGE_TARGET.y,
    MAIN_IMAGE_TARGET.width,
    MAIN_IMAGE_TARGET.height,
  );

  return canvas;
}

export function drawAnnexGFieldValues(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  fields: AnnexGBurnChartFields,
) {
  const scaleX = canvasWidth / ANNEX_G_TEMPLATE_WIDTH;
  const scaleY = canvasHeight / ANNEX_G_TEMPLATE_HEIGHT;

  (Object.keys(ANNEX_G_FIELD_BOXES) as Array<keyof AnnexGBurnChartFields>).forEach((key) => {
    const box = ANNEX_G_FIELD_BOXES[key];
    const value = fields[key] ?? "";
    if (!value.trim()) return;

    drawText(
      ctx,
      value,
      box.x * scaleX,
      (box.y + box.height * 0.78) * scaleY,
      box.fontSize * scaleY,
    );
  });
}
