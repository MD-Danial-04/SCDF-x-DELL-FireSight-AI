import { hasDefaultPageAsset } from "../constants/annexPageDefaults";

import page0 from "../../assets/annexes/page-0.png?url";
import page1 from "../../assets/annexes/page-1.png?url";
import page2 from "../../assets/annexes/page-2.png?url";
import page3 from "../../assets/annexes/page-3.png?url";
import page4 from "../../assets/annexes/page-4.png?url";
import page5 from "../../assets/annexes/page-5.png?url";
import page6 from "../../assets/annexes/page-6.png?url";
import page7 from "../../assets/annexes/page-7.png?url";
import page8 from "../../assets/annexes/page-8.png?url";

const DEFAULT_PAGE_URLS: Record<number, string> = {
  0: page0,
  1: page1,
  2: page2,
  3: page3,
  4: page4,
  5: page5,
  6: page6,
  7: page7,
  8: page8,
};

export type AnnexImageExtension = "png" | "jpeg";

export interface AnnexImageData {
  buffer: ArrayBuffer;
  extension: AnnexImageExtension;
  width: number;
  height: number;
}

function detectExtension(buffer: ArrayBuffer): AnnexImageExtension {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  return "png";
}

export function getPngDimensions(buffer: ArrayBuffer): { width: number; height: number } {
  const view = new DataView(buffer);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function getJpegDimensions(buffer: ArrayBuffer): { width: number; height: number } {
  const view = new DataView(buffer);
  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      };
    }
    const length = view.getUint16(offset + 2, false);
    offset += 2 + length;
  }
  return { width: 800, height: 600 };
}

export function getImageDimensions(
  buffer: ArrayBuffer,
  extension: AnnexImageExtension
): { width: number; height: number } {
  if (extension === "jpeg") {
    try {
      return getJpegDimensions(buffer);
    } catch {
      return { width: 800, height: 600 };
    }
  }
  return getPngDimensions(buffer);
}

export function getDefaultPagePreviewUrl(pageIndex: number): string | null {
  return DEFAULT_PAGE_URLS[pageIndex] ?? null;
}

export async function loadPageImageData(
  pageIndex: number,
  overrides?: Map<number, Blob>
): Promise<AnnexImageData> {
  const override = overrides?.get(pageIndex);
  let buffer: ArrayBuffer;

  if (override) {
    buffer = await override.arrayBuffer();
  } else if (hasDefaultPageAsset(pageIndex)) {
    const url = DEFAULT_PAGE_URLS[pageIndex];
    if (!url) throw new Error(`No default asset for page ${pageIndex}`);
    const response = await fetch(url);
    buffer = await response.arrayBuffer();
  } else {
    throw new Error(`No image available for page ${pageIndex}.`);
  }

  const extension = detectExtension(buffer);
  const { width, height } = getImageDimensions(buffer, extension);
  return { buffer, extension, width, height };
}
