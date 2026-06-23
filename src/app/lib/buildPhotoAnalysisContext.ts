import type { CreateAnalyzePhotoJobContext } from "./coordinatorApi";
import type { PhotoAnalysisResult } from "../types/photoAnalysis";
import { resolveSuggestedSection } from "../types/photoAnalysis";
import type { PhotoLogEntry } from "../types/photoLog";

const EXCERPT_MAX_LENGTH = 500;

export interface PhotoAnalysisReportContext {
  locationOfFire?: string;
  incidentTypeName?: string;
  stopMessage?: string;
  fieldNotes?: string;
}

export interface PriorPhotoCaption {
  number: number;
  uid: string;
  caption: string;
}

export interface PhotoAnalysisEntryUpdate {
  caption: string;
  captionSource: "ai";
  suggestedSection: ReturnType<typeof resolveSuggestedSection>;
  suggestedSectionConfidence: number | null;
  detectedElements: string[];
}

function truncateExcerpt(text: string | undefined, maxLength = EXCERPT_MAX_LENGTH): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

function buildPriorCaptionsBlock(priorCaptions: PriorPhotoCaption[]): string | undefined {
  if (priorCaptions.length === 0) return undefined;

  const lines = [
    "Prior photo log captions (keep narrative consistent with these):",
    ...priorCaptions.map(
      (item) => `Photo ${item.number} (UID ${item.uid}): ${item.caption}`,
    ),
  ];
  return lines.join("\n");
}

function combineFieldNotesExcerpt(
  fieldNotes?: string,
  priorCaptions: PriorPhotoCaption[] = [],
): string | undefined {
  const parts: string[] = [];
  const fieldNotesExcerpt = truncateExcerpt(fieldNotes);
  if (fieldNotesExcerpt) {
    parts.push(fieldNotesExcerpt);
  }

  const priorBlock = buildPriorCaptionsBlock(priorCaptions);
  if (priorBlock) {
    parts.push(priorBlock);
  }

  if (parts.length === 0) return undefined;
  return parts.join("\n\n");
}

export function buildPhotoAnalysisContext(
  report: PhotoAnalysisReportContext,
  priorCaptions: PriorPhotoCaption[] = [],
): CreateAnalyzePhotoJobContext {
  return {
    locationOfFire: report.locationOfFire?.trim() || undefined,
    incidentTypeName: report.incidentTypeName?.trim() || undefined,
    stopMessageExcerpt: truncateExcerpt(report.stopMessage),
    fieldNotesExcerpt: combineFieldNotesExcerpt(report.fieldNotes, priorCaptions),
  };
}

export function mapPhotoAnalysisToEntry(
  result: PhotoAnalysisResult,
): PhotoAnalysisEntryUpdate {
  return {
    caption: result.caption,
    captionSource: "ai",
    suggestedSection: resolveSuggestedSection(
      result.suggested_section,
      result.confidence.suggested_section,
    ),
    suggestedSectionConfidence: result.confidence.suggested_section,
    detectedElements: result.detected_elements,
  };
}

export type PhotoAnalysisPartialEntry = Pick<
  PhotoLogEntry,
  | "caption"
  | "captionSource"
  | "suggestedSection"
  | "suggestedSectionConfidence"
  | "detectedElements"
>;
