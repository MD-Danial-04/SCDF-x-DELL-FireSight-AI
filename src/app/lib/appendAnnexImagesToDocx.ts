import PizZip from "pizzip";
import { getAnnexById, sortAnnexIds } from "../constants/annexDefinitions";
import { loadPageImageData, type AnnexImageExtension } from "./annexImageAssets";
import { buildImageParagraph, scaleToMaxWidthEmu } from "./injectDocxImage";

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

function scaleToMaxWidth(widthPx: number, heightPx: number): { cx: number; cy: number } {
  return scaleToMaxWidthEmu(widthPx, heightPx, MAX_WIDTH_EMU);
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

function appendImageData(
  imageData: AnnexImageData,
  zip: PizZip,
  annexBlock: string[],
  relIdRef: { value: number },
  mediaIndexRef: { value: number },
  docPrIdRef: { value: number },
  relsXmlRef: { value: string },
  contentTypesXmlRef: { value: string },
): void {
  const { buffer, extension, width, height } = imageData;
  const { cx, cy } = scaleToMaxWidth(width, height);
  const ext = extension === "jpeg" ? "jpeg" : "png";
  const mediaName = `annex-media-${mediaIndexRef.value}.${ext}`;
  const mediaPath = `word/media/${mediaName}`;

  zip.file(mediaPath, buffer);
  contentTypesXmlRef.value = ensureContentType(
    contentTypesXmlRef.value,
    `/${mediaPath}`,
    extension,
  );

  relsXmlRef.value = relsXmlRef.value.replace(
    "</Relationships>",
    `<Relationship Id="rId${relIdRef.value}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
  );

  annexBlock.push(buildImageParagraph(relIdRef.value, docPrIdRef.value, cx, cy, "Annex"));
  relIdRef.value += 1;
  mediaIndexRef.value += 1;
  docPrIdRef.value += 1;
}

export async function appendAnnexImagesToDocx(
  zip: PizZip,
  selectedAnnexIds: string[],
  overrides?: Map<number, Blob>,
  generatedPages?: Map<string, AnnexImageData[]>,
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
  const relIdRef = { value: nextRelId(relsXml) };
  const mediaIndexRef = { value: nextMediaIndex(zip) };
  const docPrIdRef = { value: 1000 };
  const relsXmlRef = { value: relsXml };
  const contentTypesXmlRef = { value: contentTypesXml };

  for (const annexId of sorted) {
    const annex = getAnnexById(annexId);
    if (!annex) continue;

    annexBlock.push(buildPageBreak(), buildHeading(annex.title));

    const generated = generatedPages?.get(annexId);
    if (generated && generated.length > 0) {
      for (const imageData of generated) {
        appendImageData(
          imageData,
          zip,
          annexBlock,
          relIdRef,
          mediaIndexRef,
          docPrIdRef,
          relsXmlRef,
          contentTypesXmlRef,
        );
      }
      continue;
    }

    for (const pageIndex of annex.pageIndices) {
      const imageData = await loadPageImageData(pageIndex, overrides);
      appendImageData(
        imageData,
        zip,
        annexBlock,
        relIdRef,
        mediaIndexRef,
        docPrIdRef,
        relsXmlRef,
        contentTypesXmlRef,
      );
    }
  }

  relsXml = relsXmlRef.value;
  contentTypesXml = contentTypesXmlRef.value;

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
