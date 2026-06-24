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
    [6, 1, "contactHome"],
    [6, 2, "contactMobile"],
    [6, 2, "contactOffice"],
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

  const declParaStart = xml.lastIndexOf("<w:p", herebyIdx);
  const factsPara =
    '<w:p><w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>{facts}</w:t></w:r></w:p>';

  const before = xml.slice(0, paraEnd);
  const middle = xml.slice(paraEnd, declParaStart);
  const after = xml.slice(declParaStart);

  const cleanedMiddle = middle.replace(/<w:p[^>]*>[\s\S]*?<\/w:p>/g, "");

  return before + cleanedMiddle + factsPara + after;
}

const SIGNATURE_LABEL_PARA =
  '<w:p><w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Signature of person making statement</w:t></w:r></w:p>';
const SIGNATURE_MARKER_PARA =
  '<w:p><w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>{intervieweeSignature}</w:t></w:r></w:p>';

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
