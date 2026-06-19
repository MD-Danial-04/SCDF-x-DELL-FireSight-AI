import PizZip from "pizzip";

const EMU_PER_PIXEL = 9525;

export type DocxImageExtension = "png" | "jpeg";

function nextRelId(relsXml: string): number {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

function nextMediaIndex(zip: PizZip, prefix = "docx-image"): number {
  const files = zip.file(/^word\/media\//) ?? [];
  let max = 0;
  const pattern = new RegExp(`${prefix}-(\\d+)`);
  for (const f of files) {
    const m = f.name.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export function buildImageParagraph(
  relId: number,
  docPrId: number,
  cx: number,
  cy: number,
  name = "Image"
): string {
  return `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${cx}" cy="${cy}"/>
      <wp:docPr id="${docPrId}" name="${name} ${docPrId}"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill><a:blip r:embed="rId${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
            <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing></w:r></w:p>`;
}

export function scaleToMaxWidthEmu(
  widthPx: number,
  heightPx: number,
  maxWidthEmu: number
): { cx: number; cy: number } {
  let cx = widthPx * EMU_PER_PIXEL;
  let cy = heightPx * EMU_PER_PIXEL;
  if (cx > maxWidthEmu) {
    const scale = maxWidthEmu / cx;
    cx = maxWidthEmu;
    cy = Math.round(cy * scale);
  }
  return { cx, cy };
}

function ensureContentType(
  contentTypesXml: string,
  partName: string,
  extension: DocxImageExtension
): string {
  if (contentTypesXml.includes(partName)) return contentTypesXml;
  const imageType = extension === "jpeg" ? "image/jpeg" : "image/png";
  const insert = `<Override PartName="${partName}" ContentType="${imageType}"/>`;
  return contentTypesXml.replace("</Types>", `${insert}</Types>`);
}

function readPngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return null;
  }
  const width =
    (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
  const height =
    (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
  return { width, height };
}

function replaceMarkerParagraph(documentXml: string, markerText: string, replacement: string): string {
  const markerParaRegex = new RegExp(
    `<w:p[^>]*>[\\s\\S]*?\\{${markerText}\\}[\\s\\S]*?</w:p>`,
    "g"
  );
  if (!markerParaRegex.test(documentXml)) return documentXml;
  return documentXml.replace(markerParaRegex, replacement);
}

function removeMarkerParagraph(documentXml: string, markerText: string): string {
  return replaceMarkerParagraph(documentXml, markerText, "");
}

export interface InjectDocxImageOptions {
  mediaPrefix?: string;
  imageName?: string;
  docPrId?: number;
  maxWidthEmu?: number;
  widthPx?: number;
  heightPx?: number;
}

const DEFAULT_SIGNATURE_MAX_WIDTH_EMU = 1900000;

export function injectImageAtMarker(
  zip: PizZip,
  markerText: string,
  imageBuffer: Uint8Array,
  options: InjectDocxImageOptions = {}
): void {
  let documentXml = zip.file("word/document.xml")?.asText() ?? "";
  if (!documentXml.includes(`{${markerText}}`)) return;

  const extension: DocxImageExtension = "png";
  const mediaPrefix = options.mediaPrefix ?? "docx-image";
  const imageName = options.imageName ?? "Image";
  const maxWidthEmu = options.maxWidthEmu ?? DEFAULT_SIGNATURE_MAX_WIDTH_EMU;

  const dimensions =
    options.widthPx && options.heightPx
      ? { width: options.widthPx, height: options.heightPx }
      : readPngDimensions(imageBuffer);
  if (!dimensions) {
    documentXml = removeMarkerParagraph(documentXml, markerText);
    zip.file("word/document.xml", documentXml);
    return;
  }

  let relsXml =
    zip.file("word/_rels/document.xml.rels")?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  let contentTypesXml =
    zip.file("[Content_Types].xml")?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`;

  const relId = nextRelId(relsXml);
  const mediaIndex = nextMediaIndex(zip, mediaPrefix);
  const mediaName = `${mediaPrefix}-${mediaIndex}.png`;
  const mediaPath = `word/media/${mediaName}`;

  zip.file(mediaPath, imageBuffer);
  contentTypesXml = ensureContentType(contentTypesXml, `/${mediaPath}`, extension);
  relsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="rId${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
  );

  const { cx, cy } = scaleToMaxWidthEmu(dimensions.width, dimensions.height, maxWidthEmu);
  const imageParagraph = buildImageParagraph(
    relId,
    options.docPrId ?? 2000,
    cx,
    cy,
    imageName
  );

  documentXml = replaceMarkerParagraph(documentXml, markerText, imageParagraph);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXml);
  zip.file("[Content_Types].xml", contentTypesXml);
}

export function removeDocxMarker(zip: PizZip, markerText: string): void {
  let documentXml = zip.file("word/document.xml")?.asText() ?? "";
  documentXml = removeMarkerParagraph(documentXml, markerText);
  zip.file("word/document.xml", documentXml);
}

export function decodeDataUrlToBuffer(dataUrl: string): Uint8Array | null {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
