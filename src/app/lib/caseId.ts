/** Case ID format: YYYYMMDD + XXXX (user replaces the four X's). */

export const CASE_ID_SUFFIX_PLACEHOLDER = "XXXX";

export function dateIsoToYmd(dateIso: string): string {
  return dateIso.trim().replace(/-/g, "").slice(0, 8);
}

export function buildCaseId(
  dateIso: string,
  suffix: string = CASE_ID_SUFFIX_PLACEHOLDER
): string {
  const ymd = dateIsoToYmd(dateIso);
  if (!ymd || ymd.length !== 8) return "";
  const id = suffix.trim().replace(/\s+/g, "").toUpperCase();
  const finalSuffix =
    id.length === 4 ? id : CASE_ID_SUFFIX_PLACEHOLDER;
  return `${ymd}${finalSuffix}`;
}

export function defaultCaseId(dateIso: string = new Date().toISOString().slice(0, 10)): string {
  return buildCaseId(dateIso, CASE_ID_SUFFIX_PLACEHOLDER);
}
