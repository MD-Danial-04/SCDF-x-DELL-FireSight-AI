/**
 * Injects docxtemplater placeholders into the Statement Form template.
 * Run: node scripts/prepare-statement-template.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, "../src/assets/templates/statement-form-clean.docx");
const templatePath = path.join(__dirname, "../src/assets/templates/statement-form.docx");

const PLACEHOLDER_PARA = (placeholder) =>
  `<w:p><w:pPr><w:pStyle w:val="TableParagraph"/><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>{${placeholder}}</w:t></w:r></w:p>`;

function replaceOnce(str, search, replacement) {
  const i = str.indexOf(search);
  if (i === -1) return str;
  return str.slice(0, i) + replacement + str.slice(i + search.length);
}

function insertPlaceholderInCell(cellXml, placeholder) {
  if (cellXml.includes(`{${placeholder}}`)) return cellXml;
  return cellXml.replace("</w:tc>", `${PLACEHOLDER_PARA(placeholder)}</w:tc>`);
}

function getTableRows(xml) {
  const tableMatch = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
  if (!tableMatch) return { xml, rows: [] };

  const tableXml = tableMatch[0];
  const rows = [...tableXml.matchAll(/<w:tr[^>]*>[\s\S]*?<\/w:tr>/g)].map((m) => m[0]);
  return { tableXml, rows };
}

function setCellPlaceholder(rows, rowIndex, cellIndex, placeholder) {
  const row = rows[rowIndex];
  if (!row) {
    console.warn(`Row ${rowIndex} not found for placeholder ${placeholder}`);
    return rows;
  }

  let cellCount = 0;
  const updatedRow = row.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (cell) => {
    if (cellCount === cellIndex) {
      cellCount++;
      return insertPlaceholderInCell(cell, placeholder);
    }
    cellCount++;
    return cell;
  });

  rows[rowIndex] = updatedRow;
  return rows;
}

function injectTablePlaceholders(xml) {
  const { tableXml, rows } = getTableRows(xml);
  if (rows.length === 0) {
    console.warn("Statement form table not found");
    return xml;
  }

  let updatedRows = [...rows];

  const mappings = [
    [0, 0, "name"],
    [0, 1, "nameChinese"],
    [1, 0, "incidentNo"],
    [1, 1, "sex"],
    [1, 2, "age"],
    [2, 0, "dateAndPlaceOfBirth"],
    [2, 1, "nric"],
    [2, 2, "passportNo"],
    [2, 3, "nationality"],
    [3, 0, "maritalStatus"],
    [3, 1, "numberOfChildren"],
    [3, 2, "citizenshipCertNo"],
    [3, 3, "vehicleNo"],
    [4, 0, "address"],
    [4, 1, "occupation"],
    [5, 0, "placeOfEmployment"],
    // The original form's Telephone Nos. section only has Residence + Mobile
    // sub-fields (no Office cell), so contactOffice is intentionally not mapped.
    [6, 1, "contactHome"],
    [6, 2, "contactMobile"],
    [8, 0, "recordedTime"],
    [8, 1, "recordedDate"],
    [8, 2, "interviewTakenPlace"],
    [9, 0, "languageSpoken"],
    [9, 1, "interpretedBy"],
    [9, 2, "recordedBy"],
  ];

  for (const [row, cell, placeholder] of mappings) {
    updatedRows = setCellPlaceholder(updatedRows, row, cell, placeholder);
  }

  const newTableXml = tableXml.replace(
    /<w:tr[^>]*>[\s\S]*?<\/w:tr>/g,
    () => updatedRows.shift()
  );

  return xml.replace(tableXml, newTableXml);
}

/**
 * Index of the last paragraph-open tag (`<w:p>` or `<w:p ...>`) before
 * `beforeIdx`. Crucially this does NOT match `<w:pPr>` or `<w:pStyle>`, so it
 * always lands on a real paragraph start rather than a properties element.
 */
function lastParagraphStart(xml, beforeIdx) {
  const re = /<w:p(?:\s[^>]*)?>/g;
  let last = -1;
  let match;
  while ((match = re.exec(xml)) !== null) {
    if (match.index >= beforeIdx) break;
    last = match.index;
  }
  return last;
}

// The statement narrative is enclosed in a full-width, page-height bordered box
// that begins on its own page (matching the SCDF interview statement form). The
// single-row table is allowed to break across pages so long statements flow on.
const STATEMENT_BORDER =
  '<w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>' +
  '<w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/>' +
  '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>' +
  '<w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/>';

const STATEMENT_BOX_BLOCK =
  // Page break so the boxed statement starts on its own page (tiny font, so the
  // break paragraph itself adds no visible space).
  '<w:p><w:pPr><w:spacing w:after="0"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>' +
  '<w:tbl>' +
  '<w:tblPr>' +
  '<w:tblW w:w="11520" w:type="dxa"/>' +
  '<w:tblBorders>' +
  STATEMENT_BORDER +
  '<w:insideH w:val="single" w:sz="8" w:space="0" w:color="000000"/>' +
  '<w:insideV w:val="single" w:sz="8" w:space="0" w:color="000000"/>' +
  '</w:tblBorders>' +
  '<w:tblLayout w:type="fixed"/>' +
  '</w:tblPr>' +
  '<w:tblGrid><w:gridCol w:w="11520"/></w:tblGrid>' +
  '<w:tr>' +
  '<w:trPr><w:trHeight w:val="9000" w:hRule="atLeast"/></w:trPr>' +
  '<w:tc>' +
  '<w:tcPr><w:tcW w:w="11520" w:type="dxa"/>' +
  '<w:tcMar>' +
  '<w:top w:w="120" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>' +
  '<w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/>' +
  '</w:tcMar></w:tcPr>' +
  '<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>{facts}</w:t></w:r></w:p>' +
  '</w:tc>' +
  '</w:tr>' +
  '</w:tbl>';

function injectFactsBody(xml) {
  const necessaryIdx = xml.indexOf("<w:t>necessary</w:t>");
  if (necessaryIdx === -1) {
    console.warn("Could not find statement body marker");
    return xml;
  }

  const paraEnd = xml.indexOf("</w:p>", necessaryIdx) + "</w:p>".length;
  const herebyIdx = xml.indexOf("<w:t>hereby</w:t>", paraEnd);
  if (herebyIdx === -1) {
    console.warn("Could not find declaration after body marker");
    return xml;
  }

  // Start of the "I hereby declare..." paragraph. Must be the paragraph's own
  // <w:p> open tag — using a plain lastIndexOf("<w:p") would wrongly match the
  // nested <w:pPr>/<w:pStyle> tags and nest {facts} inside paragraph
  // properties (where it is silently dropped on render).
  const declParaStart = lastParagraphStart(xml, herebyIdx);
  if (declParaStart === -1) {
    console.warn("Could not find declaration paragraph start");
    return xml;
  }

  const before = xml.slice(0, paraEnd);
  const middle = xml.slice(paraEnd, declParaStart);
  const after = xml.slice(declParaStart);

  const cleanedMiddle = middle.replace(/<w:p[^>]*>[\s\S]*?<\/w:p>/g, "");

  return before + cleanedMiddle + STATEMENT_BOX_BLOCK + after;
}

// The signature marker uses [[ ]] rather than { } so docxtemplater leaves it
// untouched during render(); the image is injected afterwards by replacing the
// literal token (see injectDocxImage.ts).
const SIGNATURE_LABEL_PARA =
  '<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Signature of person making statement</w:t></w:r></w:p>';
const SIGNATURE_MARKER_PARA =
  '<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>[[intervieweeSignature]]</w:t></w:r></w:p>';

function injectSignaturePlaceholder(xml) {
  const marker = "<w:t> true.</w:t>";
  const markerIdx = xml.indexOf(marker);
  if (markerIdx === -1) {
    console.warn("Could not find declaration end for signature placeholder");
    return xml;
  }

  const paraEnd = xml.indexOf("</w:p>", markerIdx) + "</w:p>".length;
  return (
    xml.slice(0, paraEnd) +
    SIGNATURE_LABEL_PARA +
    SIGNATURE_MARKER_PARA +
    xml.slice(paraEnd)
  );
}

fs.copyFileSync(sourcePath, templatePath);

const zip = new PizZip(fs.readFileSync(templatePath));
let xml = zip.file("word/document.xml").asText();

xml = injectTablePlaceholders(xml);

xml = replaceOnce(
  xml,
  "Nationality Singaporean",
  "Nationality"
);

xml = replaceOnce(
  xml,
  "Language SpokenEnglish",
  "Language Spoken"
);

xml = injectFactsBody(xml);
xml = injectSignaturePlaceholder(xml);

zip.file("word/document.xml", xml);
fs.writeFileSync(
  templatePath,
  zip.generate({ type: "nodebuffer", compression: "DEFLATE" })
);

const placeholders = [...xml.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]);
console.log("Template prepared:", templatePath);
console.log("Placeholders:", [...new Set(placeholders)].sort().join(", "));
