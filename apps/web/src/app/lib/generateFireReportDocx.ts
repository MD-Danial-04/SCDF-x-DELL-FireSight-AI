import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { FireReportData } from "../types/fireReport";
import { buildAnnexAttachmentList } from "../constants/annexDefinitions";
import { parseSelectedAnnexes } from "../components/AnnexSelector";
import { appendAnnexImagesToDocx } from "./appendAnnexImagesToDocx";
import {
  compositeHeaderValuesOntoTemplate,
  ANNEX_E_PAGE_INDEX,
  hasHeaderValues,
} from "./annexHeaderOverlay";
import {
  detectExtension,
  getDefaultPagePreviewUrl,
  getImageDimensions,
  type AnnexImageData,
} from "./annexImageAssets";
import { generateAnnexDBlobs, generateAnnexFBlobs } from "./photoLogAnnexes";
import { getRequiredPageIndices } from "../constants/annexDefinitions";
import type { PhotoLogEntry } from "../types/photoLog";
import templateUrl from "../../assets/templates/fire-investigation-report.docx?url";

/** Static annex template pages (A/B/C/E/G) that receive header value overlays on export. */
const STATIC_HEADER_PAGE_INDICES = [0, 1, 2, 4, 8];

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

async function blobToAnnexImageData(blob: Blob): Promise<AnnexImageData> {
  const buffer = await blob.arrayBuffer();
  const extension = detectExtension(buffer);
  const { width, height } = getImageDimensions(buffer, extension);
  return { buffer, extension, width, height };
}

async function buildAnnexOverridesWithHeaders(
  selectedAnnexIds: string[],
  userOverrides: Map<number, Blob> | undefined,
  header: { incidentNo?: string; locationOfFire?: string },
): Promise<Map<number, Blob>> {
  const merged = new Map(userOverrides ?? []);
  if (!hasHeaderValues(header)) return merged;

  const requiredPages = getRequiredPageIndices(selectedAnnexIds);
  const pagesToOverlay = STATIC_HEADER_PAGE_INDICES.filter(
    (pageIndex) => requiredPages.includes(pageIndex) && !merged.has(pageIndex),
  );

  await Promise.all(
    pagesToOverlay.map(async (pageIndex) => {
      const templateUrl = getDefaultPagePreviewUrl(pageIndex);
      if (!templateUrl) return;
      const response = await fetch(templateUrl);
      const templateBlob = await response.blob();
      const withHeader = await compositeHeaderValuesOntoTemplate(templateBlob, header, {
        boldUnderline: pageIndex === ANNEX_E_PAGE_INDEX,
      });
      merged.set(pageIndex, withHeader);
    }),
  );

  return merged;
}

export function buildFireReportRenderData(data: FireReportData): Record<string, unknown> {
  const { interviewees, ...scalarFields } = data;
  return {
    ...scalarFields,
    interviewees: interviewees.map(({ id: _id, ...interviewee }) => interviewee),
  };
}

export async function generateFireReportDocx(
  data: FireReportData,
  selectedAnnexIds?: string[],
  annexImageOverrides?: Map<number, Blob>,
  photos?: PhotoLogEntry[],
): Promise<Blob> {
  const annexIds =
    selectedAnnexIds ?? parseSelectedAnnexes(data.selectedAnnexes);
  const renderData = buildFireReportRenderData({
    ...data,
    annexAttachmentList:
      data.annexAttachmentList || buildAnnexAttachmentList(annexIds),
  });

  const response = await fetch(templateUrl);
  const arrayBuffer = await response.arrayBuffer();

  const zip = new PizZip(arrayBuffer);
  let xml = zip.file("word/document.xml")?.asText() ?? "";
  xml = patchDocumentXml(xml, data);
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(renderData);

  const generatedPages = new Map<string, AnnexImageData[]>();
  if (photos && photos.length > 0) {
    const header = {
      incidentNo: data.incidentNo,
      locationOfFire: data.locationOfFire,
    };

    if (annexIds.includes("D")) {
      const blobs = await generateAnnexDBlobs(photos, header);
      generatedPages.set(
        "D",
        await Promise.all(blobs.map((blob) => blobToAnnexImageData(blob))),
      );
    }

    if (annexIds.includes("F")) {
      const blobs = await generateAnnexFBlobs(photos, header);
      generatedPages.set(
        "F",
        await Promise.all(blobs.map((blob) => blobToAnnexImageData(blob))),
      );
    }
  }

  await appendAnnexImagesToDocx(
    doc.getZip(),
    annexIds,
    await buildAnnexOverridesWithHeaders(annexIds, annexImageOverrides, {
      incidentNo: data.incidentNo,
      locationOfFire: data.locationOfFire,
    }),
    generatedPages.size > 0 ? generatedPages : undefined,
  );

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
