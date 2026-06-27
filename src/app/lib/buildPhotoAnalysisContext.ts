import type { CreateAnalyzePhotoJobContext } from "./coordinatorApi";
import type { PhotoAnalysisResult } from "../types/photoAnalysis";
import type { PhotoLogEntry } from "../types/photoLog";

const FIELD_NOTES_MAX_LENGTH = 200;

export interface PhotoAnalysisReportContext {
  locationOfFire?: string;
  incidentTypeName?: string;
  stopMessage?: string;
  fieldNotes?: string;
}

export interface PhotoAnalysisEntryUpdate {
  caption: string;
  captionSource: "ai";
}

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function buildPhotoAnalysisContext(
  report: PhotoAnalysisReportContext,
): CreateAnalyzePhotoJobContext {
  const trimmedNotes = report.fieldNotes?.trim();
  return {
    locationOfFire: report.locationOfFire?.trim() || undefined,
    incidentTypeName: report.incidentTypeName?.trim() || undefined,
    fieldNotesExcerpt: trimmedNotes
      ? truncateText(trimmedNotes, FIELD_NOTES_MAX_LENGTH)
      : undefined,
  };
}

export function mapPhotoAnalysisToEntry(
  result: PhotoAnalysisResult,
): PhotoAnalysisEntryUpdate {
  return {
    caption: result.caption,
    captionSource: "ai",
  };
}

export type PhotoAnalysisPartialEntry = Pick<
  PhotoLogEntry,
  "caption" | "captionSource"
>;
