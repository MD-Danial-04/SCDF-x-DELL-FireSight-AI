import PizZip from "pizzip";
import { getAnnexById, sortAnnexIds } from "../constants/annexDefinitions";
import { loadPageImageData, type AnnexImageExtension } from "./annexImageAssets";

const EMU_PER_PIXEL = 9525;
const MAX_WIDTH_EMU = 5486400;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nextRelId(relsXml: string): number {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

function nextMediaIndex(zip: PizZip): number {
  const files = zip.file(/^word\/media\//) ?? [];
  let max = 0;
  for (const f of files) {
    const m = f.name.match(/annex-media-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function buildPageBreak(): string {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
}

function buildHeading(text: string): string {
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function buildImageParagraph(
  relId: number,
  docPrId: number,
  cx: number,
  cy: number
): string {
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${cx}" cy="${cy}"/>
      <wp:docPr id="${docPrId}" name="Annex Image ${docPrId}"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr><pic:cNvPr id="0" name="Annex"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill><a:blip r:embed="rId${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
            <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing></w:r></w:p>`;
}

function scaleToMaxWidth(widthPx: number, heightPx: number): { cx: number; cy: number } {
  let cx = widthPx * EMU_PER_PIXEL;
  let cy = heightPx * EMU_PER_PIXEL;
  if (cx > MAX_WIDTH_EMU) {
    const scale = MAX_WIDTH_EMU / cx;
    cx = MAX_WIDTH_EMU;
    cy = Math.round(cy * scale);
  }
  return { cx, cy };
}

function ensureContentType(
  contentTypesXml: string,
  partName: string,
  extension: AnnexImageExtension
): string {
  if (contentTypesXml.includes(partName)) return contentTypesXml;
  const imageType = extension === "jpeg" ? "image/jpeg" : "image/png";
  const insert = `<Override PartName="${partName}" ContentType="${imageType}"/>`;
  return contentTypesXml.replace("</Types>", `${insert}</Types>`);
}

export async function appendAnnexImagesToDocx(
  zip: PizZip,
  selectedAnnexIds: string[],
  overrides?: Map<number, Blob>
): Promise<void> {
  const sorted = sortAnnexIds(selectedAnnexIds);
  if (sorted.length === 0) return;

  let documentXml = zip.file("word/document.xml")?.asText() ?? "";
  let relsXml =
    zip.file("word/_rels/document.xml.rels")?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  let contentTypesXml =
    zip.file("[Content_Types].xml")?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`;

  const annexBlock: string[] = [buildPageBreak(), buildHeading("ANNEXES")];
  let relId = nextRelId(relsXml);
  let mediaIndex = nextMediaIndex(zip);
  let docPrId = 1000;

  for (const annexId of sorted) {
    const annex = getAnnexById(annexId);
    if (!annex) continue;

    annexBlock.push(buildPageBreak(), buildHeading(annex.title));

    for (const pageIndex of annex.pageIndices) {
      const { buffer, extension, width, height } = await loadPageImageData(
        pageIndex,
        overrides
      );
      const { cx, cy } = scaleToMaxWidth(width, height);
      const ext = extension === "jpeg" ? "jpeg" : "png";
      const mediaName = `annex-media-${mediaIndex}.${ext}`;
      const mediaPath = `word/media/${mediaName}`;

      zip.file(mediaPath, buffer);
      contentTypesXml = ensureContentType(contentTypesXml, `/${mediaPath}`, extension);

      relsXml = relsXml.replace(
        "</Relationships>",
        `<Relationship Id="rId${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
      );

      annexBlock.push(buildImageParagraph(relId, docPrId, cx, cy));
      relId += 1;
      mediaIndex += 1;
      docPrId += 1;
    }
  }

  const insertXml = annexBlock.join("");
  if (documentXml.includes("<w:sectPr")) {
    documentXml = documentXml.replace("<w:sectPr", `${insertXml}<w:sectPr`);
  } else {
    documentXml = documentXml.replace("</w:body>", `${insertXml}</w:body>`);
  }

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXml);
  zip.file("[Content_Types].xml", contentTypesXml);
}
