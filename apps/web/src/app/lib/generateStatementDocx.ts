import Docxtemplater from "docxtemplater";
import { format, parseISO, isValid } from "date-fns";
import PizZip from "pizzip";
import type { FireReportData } from "../types/fireReport";
import type { Interviewee } from "../types/interviewee";
import {
  decodeDataUrlToBuffer,
  injectImageAtMarker,
  removeDocxMarker,
} from "./injectDocxImage";
import templateUrl from "../../assets/templates/statement-form.docx?url";

export const INTERVIEWEE_SIGNATURE_MARKER = "intervieweeSignature";

export interface StatementRenderData {
  name: string;
  nameChinese: string;
  incidentNo: string;
  sex: string;
  age: string;
  dateAndPlaceOfBirth: string;
  nric: string;
  passportNo: string;
  nationality: string;
  maritalStatus: string;
  numberOfChildren: string;
  citizenshipCertNo: string;
  vehicleNo: string;
  address: string;
  occupation: string;
  placeOfEmployment: string;
  contactHome: string;
  contactMobile: string;
  contactOffice: string;
  recordedTime: string;
  recordedDate: string;
  interviewTakenPlace: string;
  languageSpoken: string;
  interpretedBy: string;
  recordedBy: string;
  facts: string;
}

function formatRecordedTime(start: string, end: string): string {
  const parts = [start.trim(), end.trim()].filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `Start: ${parts[0]}`;
  return `Start: ${parts[0]} End: ${parts[1]}`;
}

function formatStatementDate(isoDate: string): string {
  if (!isoDate) return "";
  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return isoDate;
  return format(parsed, "dd MMMM yyyy");
}

export function mapIntervieweeToStatement(
  interviewee: Interviewee,
  report: FireReportData
): StatementRenderData {
  const recordedDate =
    interviewee.recordedDate.trim() || formatStatementDate(report.dateOfFire);

  return {
    name: interviewee.name,
    nameChinese: interviewee.nameChinese,
    incidentNo: report.incidentNo,
    sex: interviewee.sex,
    age: interviewee.age,
    dateAndPlaceOfBirth: interviewee.dateAndPlaceOfBirth,
    nric: interviewee.nric,
    passportNo: interviewee.passportNo,
    nationality: interviewee.nationality,
    maritalStatus: interviewee.maritalStatus,
    numberOfChildren: interviewee.numberOfChildren,
    citizenshipCertNo: interviewee.citizenshipCertNo,
    vehicleNo: interviewee.vehicleNo,
    address: interviewee.address,
    occupation: interviewee.designation,
    placeOfEmployment: interviewee.placeOfEmployment,
    contactHome: interviewee.contactHome,
    contactMobile: interviewee.contactMobile,
    contactOffice: interviewee.contactOffice,
    recordedTime: formatRecordedTime(
      interviewee.recordedStartTime,
      interviewee.recordedEndTime
    ),
    recordedDate,
    interviewTakenPlace: interviewee.interviewTakenPlace.trim(),
    languageSpoken: interviewee.languageSpoken,
    interpretedBy: interviewee.interpretedBy,
    recordedBy: interviewee.recordedBy || report.investigatorNameRank,
    facts: interviewee.facts,
  };
}

export function getStatementFilename(incidentNo: string, intervieweeName: string): string {
  const safeIncident = incidentNo.replace(/[^\w\-/]+/g, "_") || "Statement";
  const safeName = intervieweeName.replace(/[^\w\-/]+/g, "_").trim() || "Interviewee";
  return `${safeIncident}_Statement_${safeName}.docx`;
}

function applyIntervieweeSignature(zip: PizZip, signatureDataUrl: string): void {
  const buffer = decodeDataUrlToBuffer(signatureDataUrl);
  if (buffer) {
    injectImageAtMarker(zip, INTERVIEWEE_SIGNATURE_MARKER, buffer, {
      mediaPrefix: "signature",
      imageName: "Signature",
      docPrId: 2000,
      widthPx: 320,
      heightPx: 120,
    });
    return;
  }
  removeDocxMarker(zip, INTERVIEWEE_SIGNATURE_MARKER);
}

export async function generateStatementDocx(
  interviewee: Interviewee,
  report: FireReportData
): Promise<Blob> {
  const renderData = mapIntervieweeToStatement(interviewee, report);

  const response = await fetch(templateUrl);
  const arrayBuffer = await response.arrayBuffer();

  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(renderData as unknown as Record<string, string>);

  const outputZip = doc.getZip();
  if (interviewee.signatureDataUrl.trim()) {
    applyIntervieweeSignature(outputZip, interviewee.signatureDataUrl.trim());
  } else {
    removeDocxMarker(outputZip, INTERVIEWEE_SIGNATURE_MARKER);
  }

  const out = outputZip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });

  return out as Blob;
}
