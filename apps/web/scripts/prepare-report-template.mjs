/** Populate the supplied demo report's value cells without changing its layout.
 * Run: npm run prepare-report-template
 */
import fs from "node:fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const sourcePath = new URL("../Documents/Demo Report_Final.docx", import.meta.url);
const templatePath = new URL("../src/assets/templates/fire-investigation-report.docx", import.meta.url);

// Match labels in document order, including the three identical photo labels.
// Fail on source changes instead of silently retaining sample incident details.
const fields = [
  ["Incident no.", "incidentNo"],
  ["Location of fire", "locationOfFire"],
  ["Date of fire", "dateOfFire"],
  ["Time of call", "timeOfCall"],
  ["Responding unit", "station"],
  ["Area", "coverage"],
  ["Investigator (name / rank)", "investigatorNameRank"],
  ["Unit attachment", "placeOfAttachment"],
  ["Fire involved", "fireInvolved"],
  ["Photo reference", "incidentPhotosRef"],
  ["Method of extinguishment", "methodOfExtinguishment"],
  ["Damages sustained", "damagesSustained"],
  ["Damages photo ref.", "damagesPhotoRef"],
  ["Appliance call sign", "applianceCallSign"],
  ["Handover officer", "handoverOfficer"],
  ["Handover post", "handoverNpc"],
  ["Probable cause of fire", "probableCause"],
  ["Ignition source", "ignitionSource"],
  ["Ignition fuel(s)", "ignitionFuel"],
  ["Events / circumstances", "eventsCircumstances"],
  ["Area of fire origin", "areaOfFireOrigin"],
  ["Photo ref.", "areaOfOriginPhotoRef"],
  ["Burn patterns observed", "burnPatterns"],
  ["Photo ref.", "burnPatternsPhotoRef"],
  ["Evidence found at scene", "evidentiaryFactors"],
  ["Photo ref.", "evidentiaryPhotoRef"],
  ["Name of injured person", "injuryName"],
  ["ID reference", "injuryPin"],
  ["Address", "injuryAddress"],
  ["Type of injury", "injuryType"],
  ["Reference source", "annexReferenceSource"],
  ["Included sections", "annexAttachmentList"],
  ["Location plan label", "annexLayoutPlan"],
  ["Photographs label", "annexPhotographs"],
  ["Prepared by", "preparedBy"],
  ["Date", "reportDate"],
];

function cellText(xml) {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1]).join("").trim();
}

function populateCell(cell, field) {
  // Preserve cell geometry and first paragraph/run formatting, replacing every
  // sample paragraph (including extra lines in the supporting-materials list).
  const cellProperties = cell.match(/<w:tcPr\b[^>]*>[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  const paragraph = cell.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/)?.[0];
  if (!paragraph) throw new Error(`Missing value paragraph for ${field}`);
  const paragraphProperties = paragraph.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const run = paragraph.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/)?.[0] ?? "";
  const runProperties = run.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  return `<w:tc>${cellProperties}<w:p>${paragraphProperties}<w:r>${runProperties}<w:t>{${field}}</w:t></w:r></w:p></w:tc>`;
}

const zip = new PizZip(fs.readFileSync(sourcePath));
let fieldIndex = 0;
const xml = zip.file("word/document.xml").asText().replace(
  /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,
  (row) => {
    const cells = [...row.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)];
    if (cells.length === 1) return row;
    const [label, field] = fields[fieldIndex] ?? [];
    if (cells.length !== 2 || cellText(cells[0][0]) !== label) {
      throw new Error(`Unexpected report row: ${cellText(cells[0]?.[0] ?? "")}; expected ${label}`);
    }
    fieldIndex++;
    const value = cells[1];
    return row.slice(0, value.index) + populateCell(value[0], field) + row.slice(value.index + value[0].length);
  },
);
if (fieldIndex !== fields.length) throw new Error(`Mapped ${fieldIndex} of ${fields.length} report fields`);
zip.file("word/document.xml", xml);
// Compile before replacing the app's working template.
new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
fs.writeFileSync(templatePath, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Prepared Demo Report_Final template with ${fieldIndex} live fields.`);
