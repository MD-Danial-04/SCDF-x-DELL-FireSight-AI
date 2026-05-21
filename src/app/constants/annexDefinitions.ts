import { hasDefaultPageAsset } from "./annexPageDefaults";

export interface AnnexDefinition {
  id: string;
  title: string;
  /** 0-based slide indices from PowerPoint export */
  pageIndices: number[];
}

/** Annex letters A–G; pages 0–4 = A–E, 5–7 = F, 8 = G */
export const ANNEX_DEFINITIONS: AnnexDefinition[] = [
  {
    id: "A",
    title: "Annex A – Layout Plan of the Affected Area",
    pageIndices: [0],
  },
  {
    id: "B",
    title: "Annex B – Photographs",
    pageIndices: [1],
  },
  {
    id: "C",
    title: "Annex C – Sketch",
    pageIndices: [2],
  },
  {
    id: "D",
    title: "Annex D – Table of Photo-log",
    pageIndices: [3],
  },
  {
    id: "E",
    title: "Annex E – Sketch",
    pageIndices: [4],
  },
  {
    id: "F",
    title: "Annex F – Photographs",
    pageIndices: [5, 6, 7],
  },
  {
    id: "G",
    title: "Annex G – Burn Sketch",
    pageIndices: [8],
  },
];

export const ANNEX_REFERENCE_SOURCE = "Annexes (A-G).pptx";

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
