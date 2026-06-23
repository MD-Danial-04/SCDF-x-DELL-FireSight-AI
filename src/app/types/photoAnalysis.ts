import type { FireReportFieldKey } from "./fireReport";

/** Maps 1:1 to FireReportData *PhotoRef fields. Used only for report linking. */
export type SuggestedPhotoSection =
  | "incident"
  | "damages"
  | "area_of_origin"
  | "burn_patterns"
  | "evidentiary";

export const SUGGESTED_PHOTO_SECTIONS: readonly SuggestedPhotoSection[] = [
  "incident",
  "damages",
  "area_of_origin",
  "burn_patterns",
  "evidentiary",
] as const;

export const SUGGESTED_SECTION_TO_PHOTO_REF: Record<
  SuggestedPhotoSection,
  FireReportFieldKey
> = {
  incident: "incidentPhotosRef",
  damages: "damagesPhotoRef",
  area_of_origin: "areaOfOriginPhotoRef",
  burn_patterns: "burnPatternsPhotoRef",
  evidentiary: "evidentiaryPhotoRef",
};

export const PHOTO_REF_LABELS: Record<SuggestedPhotoSection, string> = {
  incident: "Incident photos",
  damages: "Damages",
  area_of_origin: "Area of fire origin",
  burn_patterns: "Burn patterns",
  evidentiary: "Evidentiary factors",
};

/** Default placeholder text for each *PhotoRef field in a new report. */
export const DEFAULT_PHOTO_REF_PLACEHOLDERS: Record<SuggestedPhotoSection, string> = {
  incident: "See Annex A and Photos X to XX",
  damages: "See Photo X",
  area_of_origin: "See Photo X",
  burn_patterns: "See Photo X",
  evidentiary: "See Photo X",
};

/** Minimum model confidence required to surface a section suggestion in the UI. */
export const SUGGESTED_SECTION_CONFIDENCE_THRESHOLD = 0.7;

export interface PhotoAnalysisConfidence {
  caption: number;
  suggested_section: number | null;
}

export interface PhotoAnalysisResult {
  caption: string;
  detected_elements: string[];
  suggested_section: SuggestedPhotoSection | null;
  confidence: PhotoAnalysisConfidence;
  source: "fake" | "ollama" | "nim";
}

export function isSuggestedPhotoSection(value: string): value is SuggestedPhotoSection {
  return (SUGGESTED_PHOTO_SECTIONS as readonly string[]).includes(value);
}

/** Apply confidence threshold; returns null section when below threshold. */
export function resolveSuggestedSection(
  section: SuggestedPhotoSection | null | undefined,
  confidence: number | null | undefined,
): SuggestedPhotoSection | null {
  if (!section || confidence == null) return null;
  if (confidence < SUGGESTED_SECTION_CONFIDENCE_THRESHOLD) return null;
  return section;
}
