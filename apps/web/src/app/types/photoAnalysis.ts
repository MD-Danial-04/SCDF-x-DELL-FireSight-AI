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

/** Reverse of SUGGESTED_SECTION_TO_PHOTO_REF: ref field key -> section. */
export const PHOTO_REF_FIELD_TO_SECTION: Partial<
  Record<FireReportFieldKey, SuggestedPhotoSection>
> = Object.fromEntries(
  (Object.entries(SUGGESTED_SECTION_TO_PHOTO_REF) as [
    SuggestedPhotoSection,
    FireReportFieldKey,
  ][]).map(([section, fieldKey]) => [fieldKey, section]),
);

export const PHOTO_REF_LABELS: Record<SuggestedPhotoSection, string> = {
  incident: "Incident photos",
  damages: "Damages",
  area_of_origin: "Area of fire origin",
  burn_patterns: "Burn patterns",
  evidentiary: "Evidentiary factors",
};

export const SECTION_LINK_BUTTON_LABELS: Record<SuggestedPhotoSection, string> = {
  incident: "Incident",
  damages: "Damages",
  area_of_origin: "5b Origin",
  burn_patterns: "5c Burn patterns",
  evidentiary: "5d Evidence",
};

/** Default placeholder text for each *PhotoRef field in a new report. */
export const DEFAULT_PHOTO_REF_PLACEHOLDERS: Record<SuggestedPhotoSection, string> = {
  incident: "See Annex A and Photos X to XX",
  damages: "See Photo X",
  area_of_origin: "See Photo X",
  burn_patterns: "See Photo X",
  evidentiary: "See Photo X",
};

/** Default free-text lead-in for each *PhotoRef field when photos are linked. */
export const DEFAULT_PHOTO_REF_NOTES: Record<SuggestedPhotoSection, string> = {
  incident: "See Annex A and",
  damages: "See",
  area_of_origin: "See",
  burn_patterns: "See",
  evidentiary: "See",
};

export interface PhotoAnalysisResult {
  caption: string;
  source: "fake" | "ollama" | "nim";
}

export function isSuggestedPhotoSection(value: string): value is SuggestedPhotoSection {
  return (SUGGESTED_PHOTO_SECTIONS as readonly string[]).includes(value);
}
