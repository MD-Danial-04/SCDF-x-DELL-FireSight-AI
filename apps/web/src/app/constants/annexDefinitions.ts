import { hasDefaultPageAsset } from "./annexPageDefaults";

export interface AnnexDefinition {
  id: string;
  title: string;
  /** 0-based slide indices from PowerPoint export */
  pageIndices: number[];
}

/** One supplied slide template for each report section, in annex order. */
export const ANNEX_DEFINITIONS: AnnexDefinition[] = [
  {
    id: "A",
    title: "Section 1 – Location Plan",
    pageIndices: [0],
  },
  {
    id: "B",
    title: "Section 2 – Site Layout Plan",
    pageIndices: [1],
  },
  {
    id: "C",
    title: "Section 3 – Affected Area Layout Plan",
    pageIndices: [2],
  },
  {
    id: "D",
    title: "Section 4 – Photo Repository",
    pageIndices: [3],
  },
  {
    id: "E",
    title: "Section 5 – Photo Layout Plan",
    pageIndices: [4],
  },
  {
    id: "F",
    title: "Section 6 – Photo Description",
    pageIndices: [5],
  },
];

export const ANNEX_REFERENCE_SOURCE = "Demo Report_Final.pptx (Sections 1–6)";

export const DEFAULT_SELECTED_ANNEXES = ["A", "B"];

export function getAnnexById(id: string): AnnexDefinition | undefined {
  return ANNEX_DEFINITIONS.find((a) => a.id === id);
}

export function buildAnnexAttachmentList(selectedIds: string[]): string {
  return selectedIds
    .map((id) => getAnnexById(id)?.title)
    .filter(Boolean)
    .join("\n");
}

export function sortAnnexIds(ids: string[]): string[] {
  const order = ANNEX_DEFINITIONS.map((a) => a.id);
  return ids
    .filter((id) => order.includes(id))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function getRequiredPageIndices(selectedIds: string[]): number[] {
  const indices: number[] = [];
  for (const id of sortAnnexIds(selectedIds)) {
    const annex = getAnnexById(id);
    if (annex) indices.push(...annex.pageIndices);
  }
  return indices;
}

export function validateAnnexPages(
  selectedIds: string[],
  overrides: Map<number, Blob>
): { valid: boolean; missing: number[] } {
  const missing: number[] = [];
  for (const pageIndex of getRequiredPageIndices(selectedIds)) {
    const hasOverride = overrides.has(pageIndex);
    const hasDefault = hasDefaultPageAsset(pageIndex);
    if (!hasOverride && !hasDefault) {
      missing.push(pageIndex);
    }
  }
  return { valid: missing.length === 0, missing };
}
