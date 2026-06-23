import {
  DEFAULT_PHOTO_REF_PLACEHOLDERS,
  type SuggestedPhotoSection,
} from "../types/photoAnalysis";

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
