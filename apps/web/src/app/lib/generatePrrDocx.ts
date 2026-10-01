import Docxtemplater from "docxtemplater";
import { format, parseISO, isValid } from "date-fns";
import PizZip from "pizzip";
import type { FireReportData } from "../types/fireReport";
import templateUrl from "../../assets/templates/prr-report.docx?url";

export interface PrrRenderData {
  incidentNo: string;
  locationOfFire: string;
  dateOfFire: string;
  timeOfCall: string;
  station: string;
  coverage: string;
  fireInvolved: string;
  methodOfExtinguishment: string;
  probableCause: string;
  damagesSustained: string;
  injuryName: string;
  injuryPin: string;
  injuryType: string;
  preparedBy: string;
}

export function formatPrrDate(isoDate: string): string {
  if (!isoDate) return "";
  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return isoDate;
  return format(parsed, "dd MMMM yyyy");
}

export function formatPrrTimeOfCall(time: string): string {
  if (!time) return "";
  const trimmed = time.trim();
  if (/hrs$/i.test(trimmed)) return trimmed;
  return `${trimmed} hrs`;
}

function prrInjuryValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "nil") return "NIL";
  return value;
}

export function mapFireReportToPrr(data: FireReportData): PrrRenderData {
  return {
    incidentNo: data.incidentNo,
    locationOfFire: data.locationOfFire,
    dateOfFire: formatPrrDate(data.dateOfFire),
    timeOfCall: formatPrrTimeOfCall(data.timeOfCall),
    station: data.station,
    coverage: data.coverage,
    fireInvolved: data.fireInvolved,
    methodOfExtinguishment: data.methodOfExtinguishment,
    probableCause: data.probableCause,
    damagesSustained: data.damagesSustained,
    injuryName: prrInjuryValue(data.injuryName),
    injuryPin: prrInjuryValue(data.injuryPin),
    injuryType: prrInjuryValue(data.injuryType),
    preparedBy: data.preparedBy,
  };
}

export function getPrrFilename(incidentNo: string): string {
  const safe = incidentNo.replace(/[^\w\-/]+/g, "_") || "PRR";
  return `${safe}_PRR.docx`;
}

export async function generatePrrDocx(data: FireReportData): Promise<Blob> {
  const renderData = mapFireReportToPrr(data);

  const response = await fetch(templateUrl);
  const arrayBuffer = await response.arrayBuffer();

  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(renderData as unknown as Record<string, string>);

  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });

  return out as Blob;
}
