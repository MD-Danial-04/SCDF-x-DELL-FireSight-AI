import type { CreateAnalyzePhotoJobContext } from "./coordinatorApi";
import type { PhotoAnalysisResult, SuggestedPhotoSection } from "../types/photoAnalysis";
import { resolveSuggestedSection } from "../types/photoAnalysis";
import type { PhotoLogEntry } from "../types/photoLog";

const FIELD_NOTES_MAX_LENGTH = 200;
const PRIOR_LINE_MAX_LENGTH = 100;
const MAX_PRIOR_PHOTOS = 3;

export const PRIOR_PHOTOS_HEADER =
  "Photos already logged (describe what is different in THIS image):";

export interface PhotoAnalysisReportContext {
  locationOfFire?: string;
  incidentTypeName?: string;
  stopMessage?: string;
  fieldNotes?: string;
}

export interface PriorPhotoCaption {
  number: number;
  uid: string;
  suggestedSection?: SuggestedPhotoSection | null;
  detectedElements?: string[];
  caption?: string;
}

export interface PhotoAnalysisEntryUpdate {
  caption: string;
  captionSource: "ai";
  suggestedSection: ReturnType<typeof resolveSuggestedSection>;
  suggestedSectionConfidence: number | null;
  detectedElements: string[];
}

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

function summarizePriorPhoto(item: PriorPhotoCaption): string | null {
  const elements = item.detectedElements?.filter(Boolean) ?? [];
  if (elements.length > 0) {
    const sectionPrefix = item.suggestedSection ? `[${item.suggestedSection}] ` : "";
    return truncateText(`${sectionPrefix}${elements.join(", ")}`, PRIOR_LINE_MAX_LENGTH);
  }

  const caption = item.caption?.trim();
  if (!caption) return null;
  return truncateText(caption, PRIOR_LINE_MAX_LENGTH);
}

function buildPriorPhotosBlock(priorCaptions: PriorPhotoCaption[]): string | undefined {
  const recent = priorCaptions.slice(-MAX_PRIOR_PHOTOS);
  const lines = recent
    .map((item) => {
      const summary = summarizePriorPhoto(item);
      if (!summary) return null;
      return `Photo ${item.number} (${item.uid}) ${summary}`;
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) return undefined;
  return [PRIOR_PHOTOS_HEADER, ...lines].join("\n");
}

function buildFieldNotesExcerpt(
  fieldNotes?: string,
  priorCaptions: PriorPhotoCaption[] = [],
): string | undefined {
  const parts: string[] = [];
  const trimmedNotes = fieldNotes?.trim();
  if (trimmedNotes) {
    parts.push(truncateText(trimmedNotes, FIELD_NOTES_MAX_LENGTH));
  }

  const priorBlock = buildPriorPhotosBlock(priorCaptions);
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
    fieldNotesExcerpt: buildFieldNotesExcerpt(report.fieldNotes, priorCaptions),
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
