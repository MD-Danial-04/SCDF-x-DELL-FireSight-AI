import {
  DEFAULT_PHOTO_REF_NOTES,
  DEFAULT_PHOTO_REF_PLACEHOLDERS,
  SUGGESTED_PHOTO_SECTIONS,
  SUGGESTED_SECTION_TO_PHOTO_REF,
  type SuggestedPhotoSection,
} from "../types/photoAnalysis";
import type {
  FireReportData,
  PhotoRefLinks,
  PhotoRefNotes,
} from "../types/fireReport";
import { getPhotoLogDisplayInfo, type PhotoLogEntry } from "../types/photoLog";

function photoRefToken(photoNumber: number): string {
  return `Photo ${photoNumber}`;
}

function alreadyReferencesPhoto(value: string, photoNumber: number): boolean {
  const token = photoRefToken(photoNumber);
  const copyToken = `Copy of ${photoNumber}`;
  return (
    value.includes(token) ||
    value.includes(copyToken) ||
    value.includes(`COPY OF ${token.toUpperCase()}`)
  );
}

function mergeIncidentRef(currentValue: string, photoNumber: number): string {
  const trimmed = currentValue.trim();
  const placeholder = DEFAULT_PHOTO_REF_PLACEHOLDERS.incident;
  const token = photoRefToken(photoNumber);

  if (!trimmed || trimmed === placeholder) {
    return `See Annex A and ${token}`;
  }

  if (alreadyReferencesPhoto(trimmed, photoNumber)) {
    return trimmed;
  }

  return `${trimmed}, ${token}`;
}

function mergeStandardRef(currentValue: string, photoNumber: number, section: SuggestedPhotoSection): string {
  const trimmed = currentValue.trim();
  const placeholder = DEFAULT_PHOTO_REF_PLACEHOLDERS[section];
  const token = photoRefToken(photoNumber);

  if (!trimmed || trimmed === placeholder) {
    return `See ${token}`;
  }

  if (alreadyReferencesPhoto(trimmed, photoNumber)) {
    return trimmed;
  }

  return `${trimmed}, ${token}`;
}

/**
 * Merge a photo number into the report *PhotoRef field for the given section.
 * Uses display photo numbers from the photo log (original number for copies).
 */
export function applyPhotoSectionRef(
  currentValue: string,
  section: SuggestedPhotoSection,
  photoNumber: number,
): string {
  if (photoNumber < 1) {
    return currentValue;
  }

  if (section === "incident") {
    return mergeIncidentRef(currentValue, photoNumber);
  }

  return mergeStandardRef(currentValue, photoNumber, section);
}

/**
 * Resolve the live display number for a photo id, accounting for copies
 * (a copy resolves to its original photo's number).
 */
function resolvePhotoNumber(
  photoId: string,
  photos: PhotoLogEntry[],
): number | null {
  const displayInfo = getPhotoLogDisplayInfo(photos);
  const numberById = new Map<string, number>();
  for (const info of displayInfo) {
    if (info.number !== null) {
      numberById.set(info.entry.id, info.number);
    }
  }

  const entry = photos.find((p) => p.id === photoId);
  if (!entry) return null;
  if (!entry.isCopy) {
    return numberById.get(entry.id) ?? null;
  }
  return entry.copyOfId ? numberById.get(entry.copyOfId) ?? null : null;
}

/**
 * Build the human-readable ref text for a section from linked photo ids.
 *
 * Numbers are resolved live from the current photo order, so reordering or
 * deleting photos updates the text. Ids whose photo no longer exists are
 * dropped. With no resolvable links, falls back to the section placeholder.
 */
export function resolvePhotoRefText(
  section: SuggestedPhotoSection,
  photoIds: string[] | undefined,
  photos: PhotoLogEntry[],
  note?: string,
): string {
  const numbers = (photoIds ?? [])
    .map((id) => resolvePhotoNumber(id, photos))
    .filter((n): n is number => n !== null);

  const uniqueSorted = Array.from(new Set(numbers)).sort((a, b) => a - b);

  if (uniqueSorted.length === 0) {
    return DEFAULT_PHOTO_REF_PLACEHOLDERS[section];
  }

  const leadIn = (note ?? DEFAULT_PHOTO_REF_NOTES[section]).trim();
  const tokens = uniqueSorted.map((n) => `Photo ${n}`).join(", ");
  return leadIn ? `${leadIn} ${tokens}` : tokens;
}

/**
 * Best-effort migration of a legacy free-text ref (e.g. "See Photo 3") into a
 * structured links/note pair, using the current photo order to map numbers to
 * ids. Unresolvable custom text is preserved verbatim as the note.
 */
function parseLegacyRef(
  section: SuggestedPhotoSection,
  legacy: string,
  numberToId: Map<number, string>,
): { ids: string[]; note: string | undefined } {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = /Photo\s+(\d+)/gi;
  let firstIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(legacy)) !== null) {
    if (firstIndex === -1) firstIndex = match.index;
    const id = numberToId.get(Number(match[1]));
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  if (ids.length === 0) {
    const trimmed = legacy.trim();
    if (!trimmed || trimmed === DEFAULT_PHOTO_REF_PLACEHOLDERS[section]) {
      return { ids: [], note: undefined };
    }
    return { ids: [], note: trimmed };
  }

  const note = legacy.slice(0, firstIndex).replace(/[\s,]+$/, "").trim();
  return { ids, note: note || undefined };
}

/**
 * Derive photoRefLinks/photoRefNotes from the legacy string ref fields of a
 * report (for drafts saved before structured linking existed).
 */
export function migrateLegacyPhotoRefs(
  data: FireReportData,
  photos: PhotoLogEntry[],
): { links: PhotoRefLinks; notes: PhotoRefNotes } {
  const numberToId = new Map<number, string>();
  for (const info of getPhotoLogDisplayInfo(photos)) {
    if (info.number !== null) {
      numberToId.set(info.number, info.entry.id);
    }
  }

  const links: PhotoRefLinks = {};
  const notes: PhotoRefNotes = {};
  for (const section of SUGGESTED_PHOTO_SECTIONS) {
    const legacy = (data[SUGGESTED_SECTION_TO_PHOTO_REF[section]] as string) ?? "";
    const { ids, note } = parseLegacyRef(section, legacy, numberToId);
    if (ids.length > 0) links[section] = ids;
    if (note !== undefined) notes[section] = note;
  }

  return { links, notes };
}
