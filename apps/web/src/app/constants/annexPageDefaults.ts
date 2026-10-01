/** 0-based page index -> bundled asset filename under src/assets/annexes/ */
export const DEFAULT_PAGE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

export function hasDefaultPageAsset(pageIndex: number): boolean {
  return pageIndex >= 0 && pageIndex <= 8;
}

export function getDefaultPageFilename(pageIndex: number): string | null {
  return hasDefaultPageAsset(pageIndex) ? `page-${pageIndex}.png` : null;
}

export function getPageLabel(pageIndex: number, annexId?: string, subIndex?: number): string {
  if (annexId === "F" && subIndex !== undefined) {
    return `Annex F – page ${subIndex + 1} (index ${pageIndex})`;
  }
  if (annexId) {
    return `Annex ${annexId} – page ${pageIndex}`;
  }
  return `Page ${pageIndex}`;
}
