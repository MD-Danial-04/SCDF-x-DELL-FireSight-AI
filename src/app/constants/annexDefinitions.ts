import { hasDefaultPageAsset } from "./annexPageDefaults";

export interface AnnexDefinition {
  id: string;
  title: string;
  /** 0-based slide indices from PowerPoint export */
  pageIndices: number[];
}

/** Stable page slots: A=0, B=1, C=2, D=3, E=4, F=5, G=8.
 * Demo sections 1/2/3/4 replace A/B/F/D; legacy F slots 6/7 are unused.
 */
export const ANNEX_DEFINITIONS: AnnexDefinition[] = [
  {
    id: "A",
    title: "Section 1 – Location Plan (Annex A)",
    pageIndices: [0],
  },
  {
    id: "B",
    title: "Section 2 – Site Layout Plan (Annex B)",
    pageIndices: [1],
  },
  {
    id: "C",
    title: "Annex C – Layout Plan of the Affected Area",
    pageIndices: [2],
  },
  {
    id: "D",
    title: "Section 4 – Photo Description (Annex D)",
    pageIndices: [3],
  },
  {
    id: "E",
    title: "Annex E – Photo Log",
    pageIndices: [4],
  },
  {
    id: "F",
    title: "Section 3 – Photo Repository (Annex F)",
    pageIndices: [5],
  },
  {
    id: "G",
    title: "Annex G – Burn Sketch",
    pageIndices: [8],
  },
];

export const ANNEX_REFERENCE_SOURCE = "Demo Report_Final.pptx (Sections 1–4); Annexes (A-G).pptx (C/E/G)";

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
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
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
