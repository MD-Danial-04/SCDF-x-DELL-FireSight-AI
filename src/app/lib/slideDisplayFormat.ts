const EMPTY_VALUE = "—";

export function displaySlideValue(value: string): string {
  return value.trim() || EMPTY_VALUE;
}

/** Format YYYY-MM-DD for slide table (template uses DD/MM/YYYY) */
export function formatSlideDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return EMPTY_VALUE;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return trimmed;
}

/** Format HH:mm to HH:mm:ss for template parity */
export function formatSlideTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return EMPTY_VALUE;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
}

export function formatFieldForSlide(key: string, value: string): string {
  if (key === "dateDispatched" || key === "dutyDate") return formatSlideDate(value);
  if (key === "timeDispatched" || key === "timeArrived") return formatSlideTime(value);
  return displaySlideValue(value);
}
