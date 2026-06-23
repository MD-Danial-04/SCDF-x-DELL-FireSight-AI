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

export const SECTION_LINK_BUTTON_LABELS: Record<SuggestedPhotoSection, string> = {
  incident: "Incident",
  damages: "Damages",
  area_of_origin: "5b Origin",
  burn_patterns: "5c Burn patterns",
  evidentiary: "5d Evidence",
};

export const SECTION_2_LINK_SECTIONS: readonly SuggestedPhotoSection[] = [
  "incident",
  "damages",
] as const;

export const SECTION_5_LINK_SECTIONS: readonly SuggestedPhotoSection[] = [
  "area_of_origin",
  "burn_patterns",
  "evidentiary",
] as const;

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

/** Minimum score to enable a per-section link button. */
export const SECTION_CANDIDATE_LINK_THRESHOLD = 0.5;

/** Score at or above which a link button is visually emphasized. */
export const SECTION_CANDIDATE_HIGHLIGHT_THRESHOLD = 0.7;

export interface SectionCandidate {
  score: number;
  reason?: string | null;
}

export type SectionCandidates = Partial<Record<SuggestedPhotoSection, SectionCandidate>>;

export interface PhotoAnalysisConfidence {
  caption: number;
  suggested_section: number | null;
}

export interface PhotoAnalysisResult {
  caption: string;
  detected_elements: string[];
  suggested_section: SuggestedPhotoSection | null;
  section_candidates?: SectionCandidates | null;
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

export function getSectionCandidateScore(
  candidates: SectionCandidates | undefined | null,
  section: SuggestedPhotoSection,
): number | null {
  return candidates?.[section]?.score ?? null;
}

export function isSectionLinkable(
  candidates: SectionCandidates | undefined | null,
  section: SuggestedPhotoSection,
): boolean {
  const score = getSectionCandidateScore(candidates, section);
  return score != null && score >= SECTION_CANDIDATE_LINK_THRESHOLD;
}

export function isSectionHighlighted(
  candidates: SectionCandidates | undefined | null,
  section: SuggestedPhotoSection,
): boolean {
  const score = getSectionCandidateScore(candidates, section);
  return score != null && score >= SECTION_CANDIDATE_HIGHLIGHT_THRESHOLD;
}

export function getSectionLinkTooltip(
  candidates: SectionCandidates | undefined | null,
  section: SuggestedPhotoSection,
): string {
  const candidate = candidates?.[section];
  if (!candidate) {
    return "Run analysis to get a section relevance score";
  }
  const scorePct = Math.round(candidate.score * 100);
  if (candidate.reason) {
    return `${scorePct}% — ${candidate.reason}`;
  }
  return `${scorePct}% relevance`;
}
