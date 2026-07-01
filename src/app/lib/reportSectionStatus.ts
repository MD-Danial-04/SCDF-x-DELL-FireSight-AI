import { parseSelectedAnnexes } from "../components/AnnexSelector";
import {
  REPORT_FORM_SECTIONS,
  getAllSectionFields,
  type ReportFormFieldConfig,
} from "../constants/reportFormSections";
import type { FireReportData } from "../types/fireReport";
import type { PhotoLogEntry } from "../types/photoLog";
import type { Interviewee } from "../types/interviewee";

export type CompletionStatus = "not-edited" | "partial" | "complete";

/** Nav id/label for the interview sub-section pulled out of report section 5. */
export const INTERVIEW_NAV_ID = "5-interview";
export const INTERVIEW_NAV_LABEL = "Interview / Interviewees";

/** Nav id/label for the document preview pane (selected from the editor drawer). */
export const PREVIEW_NAV_ID = "document-preview";
export const PREVIEW_NAV_LABEL = "Document preview";

/** Nav id when no section is open — show navigation only (e.g. after switching drafts). */
export const MENU_NAV_ID = "navigation-menu";

/** Context needed to evaluate a section's completion status. */
export interface SectionStatusContext {
  fields: FireReportData;
  floorplanSvg: string | null;
  photos: PhotoLogEntry[];
  annexPreviewUrls: Record<number, string>;
}

export function getCompletionStatusFromValues(values: string[]): CompletionStatus {
  const filledCount = values.filter((value) => value.trim().length > 0).length;

  if (filledCount === 0) {
    return "not-edited";
  }

  if (filledCount === values.length) {
    return "complete";
  }

  return "partial";
}

export function getCompletionStatusMeta(status: CompletionStatus) {
  switch (status) {
    case "complete":
      return {
        label: "Completed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "partial":
      return {
        label: "Partially completed",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    default:
      return {
        label: "Not edited",
        className: "border-slate-200 bg-slate-100 text-slate-600",
      };
  }
}

export function getStatusBadgeColors(status: CompletionStatus, isActive: boolean) {
  if (isActive) {
    return "border-transparent bg-red-600 text-white";
  }
  switch (status) {
    case "complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-500";
  }
}

/**
 * Ordered list of nav target ids for the report editor, with the interview
 * sub-item inserted right after section "5" (matching the drawer order).
 */
export function buildSectionNavOrder(
  visibleSectionIds: string[],
  showInterviewNav: boolean
): string[] {
  const order: string[] = [];
  for (const id of visibleSectionIds) {
    order.push(id);
    if (id === "5" && showInterviewNav) {
      order.push(INTERVIEW_NAV_ID);
    }
  }
  return order;
}

export function parseSectionTitle(title: string): { number: string; label: string } {
  const match = title.match(/^(\d+)\s+(.*)$/);
  if (match) {
    return { number: match[1], label: match[2] };
  }
  return { number: "", label: title };
}

export function getFieldConfigsStatus(
  fieldConfigs: ReportFormFieldConfig[],
  fields: FireReportData
): CompletionStatus {
  return getCompletionStatusFromValues(
    fieldConfigs.map((config) => String(fields[config.key] ?? ""))
  );
}

export function getIntervieweesStatus(interviewees: Interviewee[]): CompletionStatus {
  const relevantValues = interviewees.flatMap((interviewee) => [
    interviewee.name,
    interviewee.designation,
    interviewee.nric,
    interviewee.nationality,
    interviewee.address,
    interviewee.contactMobile,
    interviewee.contactHome,
    interviewee.contactOffice,
    interviewee.recordedStartTime,
    interviewee.recordedEndTime,
    interviewee.recordedDate,
    interviewee.interviewTakenPlace,
    interviewee.interpretedBy,
    interviewee.recordedBy,
    interviewee.factsOriginal,
    interviewee.facts,
    interviewee.signatureDataUrl,
  ]);

  return getCompletionStatusFromValues(relevantValues);
}

export function getAttachmentsEditorStatus({
  selectedAnnexes,
  floorplanSvg,
  photos,
  annexPreviewUrls,
}: {
  selectedAnnexes: string[];
  floorplanSvg: string | null;
  photos: PhotoLogEntry[];
  annexPreviewUrls: Record<number, string>;
}): CompletionStatus {
  const editorRequirements: boolean[] = [];

  if (selectedAnnexes.includes("A")) {
    editorRequirements.push(Boolean(annexPreviewUrls[0]));
  }

  if (selectedAnnexes.includes("B")) {
    editorRequirements.push(Boolean(annexPreviewUrls[1]));
  }

  if (selectedAnnexes.includes("C") || selectedAnnexes.includes("E")) {
    editorRequirements.push(Boolean(floorplanSvg?.trim()));
  }

  if (selectedAnnexes.includes("E")) {
    editorRequirements.push(Boolean(annexPreviewUrls[4]));
  }

  if (selectedAnnexes.includes("D") || selectedAnnexes.includes("F")) {
    editorRequirements.push(photos.length > 0);
  }

  if (selectedAnnexes.includes("G")) {
    editorRequirements.push(Boolean(annexPreviewUrls[8]));
  }

  if (editorRequirements.length === 0) {
    return "complete";
  }

  const completedCount = editorRequirements.filter(Boolean).length;

  if (completedCount === 0) {
    return "not-edited";
  }

  if (completedCount === editorRequirements.length) {
    return "complete";
  }

  return "partial";
}

export function getSectionStatus(
  sectionId: string,
  { fields, floorplanSvg, photos, annexPreviewUrls }: SectionStatusContext
): CompletionStatus {
  const section = REPORT_FORM_SECTIONS.find((item) => item.id === sectionId);
  if (!section) return "not-edited";

  if (sectionId === "8") {
    const directFieldConfigs = (section.fields ?? []).filter(
      (field) => field.key !== "annexReferenceSource" && field.key !== "selectedAnnexes"
    );
    const textStatus = directFieldConfigs.length
      ? getFieldConfigsStatus(directFieldConfigs, fields)
      : "not-edited";
    const editorStatus = getAttachmentsEditorStatus({
      selectedAnnexes: parseSelectedAnnexes(fields.selectedAnnexes),
      floorplanSvg,
      photos,
      annexPreviewUrls,
    });

    if (textStatus === "complete" && editorStatus === "complete") {
      return "complete";
    }

    if (textStatus === "not-edited" && editorStatus === "not-edited") {
      return "not-edited";
    }

    return "partial";
  }

  const subsectionStatuses =
    section.subsections?.map((subsection) => getFieldConfigsStatus(subsection.fields, fields)) ??
    [];

  const directFieldConfigs = section.fields ?? [];

  const directStatuses = directFieldConfigs.length
    ? [getFieldConfigsStatus(directFieldConfigs, fields)]
    : [];

  const statuses = [...directStatuses, ...subsectionStatuses];

  if (statuses.length === 0) {
    return "not-edited";
  }

  if (statuses.every((status) => status === "complete")) {
    return "complete";
  }

  if (statuses.every((status) => status === "not-edited")) {
    return "not-edited";
  }

  return "partial";
}

export function countAutoFilled(sectionId: string, extractedKeys: Set<string>): number {
  const section = REPORT_FORM_SECTIONS.find((item) => item.id === sectionId);
  if (!section) return 0;
  return getAllSectionFields(section).filter((field) => extractedKeys.has(field.key)).length;
}
