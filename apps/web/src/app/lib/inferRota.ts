/**
 * SCDF duty rota cycles every 3 days: 2 → 1 → 3 → 2 → …
 * Anchor: 20 May 2026 is Rota 2; 21 May → 1; 22 May → 3.
 */

export const ROTA_CYCLE = [2, 1, 3] as const;

export type RotaNumber = (typeof ROTA_CYCLE)[number];

/** Fixed anchor — 20/5/2026 is Rota 2 (not "today" at runtime). */
export const ROTA_ANCHOR_DATE = "2026-05-20";

function daysBetween(isoStart: string, isoEnd: string): number {
  const start = Date.parse(`${isoStart}T12:00:00`);
  const end = Date.parse(`${isoEnd}T12:00:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

/** Infer rota (1, 2, or 3) for a duty date (YYYY-MM-DD). */
export function inferRotaFromDate(dutyDateIso: string): string {
  if (!dutyDateIso?.trim()) return "";

  const dayOffset = daysBetween(ROTA_ANCHOR_DATE, dutyDateIso);
  const index = ((dayOffset % 3) + 3) % 3;
  return String(ROTA_CYCLE[index]);
}
