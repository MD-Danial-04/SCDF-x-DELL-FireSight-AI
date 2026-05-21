import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { FireReportData } from "../types/fireReport";
import { buildAnnexAttachmentList } from "../constants/annexDefinitions";
import { parseSelectedAnnexes } from "../components/AnnexSelector";
import { appendAnnexImagesToDocx } from "./appendAnnexImagesToDocx";
import templateUrl from "../../assets/templates/fire-investigation-report.docx?url";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Patch fields whose placeholders could not be injected into split Word XML runs */
function patchDocumentXml(xml: string, data: FireReportData): string {
  let out = xml;
  if (data.fireInvolved && !out.includes("{fireInvolved}")) {
    out = out.replace(
      /<w:t>Fire Involved<\/w:t>\s*<w:t>:<\/w:t>/,
      `<w:t>Fire Involved: ${escapeXml(data.fireInvolved)}</w:t>`
    );
  }
  if (data.tenantName && !out.includes("{tenantName}")) {
    out = replaceOnce(out, "<w:t>   Name</w:t>", `<w:t>   Name: ${escapeXml(data.tenantName)}</w:t>`);
  }
  if (data.areaOfFireOrigin && !out.includes("{areaOfFireOrigin}")) {
    out = out.split("the location marked ‘O’").join(
      `the location marked ‘O’ at ${escapeXml(data.areaOfFireOrigin)}`
    );
  }
  return out;
}

function replaceOnce(str: string, search: string, replacement: string): string {
  const i = str.indexOf(search);
  if (i === -1) return str;
  return str.slice(0, i) + replacement + str.slice(i + search.length);
}

export async function generateFireReportDocx(
  data: FireReportData,
  selectedAnnexIds?: string[],
  annexImageOverrides?: Map<number, Blob>
): Promise<Blob> {
  const annexIds =
    selectedAnnexIds ?? parseSelectedAnnexes(data.selectedAnnexes);
  const renderData: FireReportData = {
    ...data,
    annexAttachmentList:
      data.annexAttachmentList || buildAnnexAttachmentList(annexIds),
  };

  const response = await fetch(templateUrl);
  const arrayBuffer = await response.arrayBuffer();

  const zip = new PizZip(arrayBuffer);
  let xml = zip.file("word/document.xml")?.asText() ?? "";
  xml = patchDocumentXml(xml, renderData);
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(renderData as unknown as Record<string, string>);

  await appendAnnexImagesToDocx(doc.getZip(), annexIds, annexImageOverrides);

  const out = doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });

  return out as Blob;
}

export function downloadDocx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
