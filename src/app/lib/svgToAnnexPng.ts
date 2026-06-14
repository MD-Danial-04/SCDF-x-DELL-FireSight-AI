/** Annex A slide aspect ratio (matches AnnexPageEditor). */
export const ANNEX_A_WIDTH = 719;
export const ANNEX_A_HEIGHT = 1058;
export const ANNEX_A_RENDER_SCALE = 2;

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

function parseViewBox(svg: string): { width: number; height: number } | null {
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
    img.onerror = () => reject(new Error("Failed to load SVG image"));
    img.src = url;
  });
}

export async function svgStringToAnnexPngBlob(svg: string): Promise<Blob> {
  const canvasWidth = ANNEX_A_WIDTH * ANNEX_A_RENDER_SCALE;
  const canvasHeight = ANNEX_A_HEIGHT * ANNEX_A_RENDER_SCALE;
  const viewBox = parseViewBox(svg);
  const contentWidth = viewBox?.width ?? ANNEX_A_WIDTH;
  const contentHeight = viewBox?.height ?? ANNEX_A_HEIGHT;

  const fit = computeContainFitRect({
    contentWidth,
    contentHeight,
    canvasWidth,
    canvasHeight,
  });

  const blob = new Blob([svg], { type: "image/svg+xml" });
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

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Failed to encode PNG"));
        },
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
