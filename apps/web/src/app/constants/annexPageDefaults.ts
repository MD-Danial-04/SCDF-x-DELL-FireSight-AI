/** 0-based page index -> bundled asset filename under src/assets/annexes/ */
export const DEFAULT_PAGE_INDICES = [0, 1, 2, 3, 4, 5] as const;

export function hasDefaultPageAsset(pageIndex: number): boolean {
  return Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex <= 5;
}

export function getDefaultPageFilename(pageIndex: number): string | null {
  return hasDefaultPageAsset(pageIndex) ? `page-${pageIndex}.png` : null;
}

export function getPageLabel(pageIndex: number, annexId?: string, subIndex?: number): string {
  if (annexId) {
    const sectionNumber = "ABCDEF".indexOf(annexId) + 1;
    const section = sectionNumber > 0 ? `Section ${sectionNumber}` : "Section";
    return subIndex !== undefined
      ? `${section}, page ${subIndex + 1}`
      : section;
  }
  return `Page ${pageIndex}`;
}
