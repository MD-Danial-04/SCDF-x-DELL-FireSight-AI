/**
 * Injects docxtemplater placeholders into the fire investigation report template.
 * Run: node scripts/prepare-report-template.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import { applyReportPageLayout } from "./report-page-layout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(
  __dirname,
  "../Documents/Fire Investigation Report Format (CAT C1 Accidental only).docx"
);
const templatePath = path.join(
  __dirname,
  "../src/assets/templates/fire-investigation-report.docx"
);
const scdfIconPath = path.join(__dirname, "../Documents/SCDF_icon.png");

const COVER_ICON_PARA_START =
  '<w:p w14:paraId="733FD40E" w14:textId="77777777" w:rsidR="00924CE3" w:rsidRDefault="00924CE3">';

function buildCoverIconParagraph(relId = 8) {
  const cx = 147 * 9525;
  const cy = 115 * 9525;
  return `${COVER_ICON_PARA_START}<w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="000000"/></w:rPr></w:pPr><w:r><w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${cx}" cy="${cy}"/>
      <wp:docPr id="1" name="SCDF Logo"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr><pic:cNvPr id="0" name="SCDF_icon.png"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill><a:blip r:embed="rId${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
            <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing></w:r></w:p>`;
}

function injectScdfCoverIcon(zip, documentXml) {
  const start = documentXml.indexOf(COVER_ICON_PARA_START);
  if (start === -1) {
    console.warn("Cover icon paragraph not found; skipping SCDF icon injection.");
    return documentXml;
  }
  const end = documentXml.indexOf("</w:p>", start) + "</w:p>".length;
  let xml =
    documentXml.slice(0, start) +
    buildCoverIconParagraph() +
    documentXml.slice(end);

  zip.file("word/media/image1.png", fs.readFileSync(scdfIconPath));

  if (zip.file("word/embeddings/oleObject1.bin")) {
    zip.remove("word/embeddings/oleObject1.bin");
  }

  let rels = zip.file("word/_rels/document.xml.rels").asText();
  rels = rels.replace(
    /<Relationship Id="rId9" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/oleObject" Target="embeddings\/oleObject1\.bin"\/>/,
    ""
  );
  zip.file("word/_rels/document.xml.rels", rels);

  console.log("Injected SCDF cover icon from", scdfIconPath);
  return xml;
}

fs.copyFileSync(sourcePath, templatePath);

const zip = new PizZip(fs.readFileSync(templatePath));
let xml = zip.file("word/document.xml").asText();

function replaceOnce(str, search, replacement) {
  const i = str.indexOf(search);
  if (i === -1) return str;
  return str.slice(0, i) + replacement + str.slice(i + search.length);
}

function replaceAllOnce(str, search, replacement, max = 10) {
  let out = str;
  for (let n = 0; n < max; n++) {
    const next = replaceOnce(out, search, replacement);
    if (next === out) break;
    out = next;
  }
  return out;
}

// Underscore blanks (longest first)
const underscoreMap = [
  ["___________________________________", "{methodOfExtinguishment}"],
  ["_______________________________", "{preparedBy}"],
  ["_______________________________", "{vettedBy}"],
  ["_______________________________", "{approvedBy}"],
  ["__________________________", "{reportDate}"],
  ["________________", "{damagesSustained}"],
  ["________________", "{interviewee1Name}"],
  ["______________", "{investigatorNameRank}"],
];

for (const [from, to] of underscoreMap) {
  xml = replaceOnce(xml, from, to);
}

// Second interview name (after "at the scene immediately")
xml = replaceOnce(
  xml,
  "Interview conducted with Mr {investigatorNameRank} at the scene",
  "Interview conducted with {interviewee2Name} at the scene"
);
// If still wrong pattern from prior runs:
xml = replaceOnce(
  xml,
  "Interview conducted with Mr {leadInvestigator} at the scene",
  "Interview conducted with {interviewee2Name} at the scene"
);

const labelInserts = [
  ["Name/Rank/Appointment       :", "Name/Rank/Appointment: {investigatorNameRank}"],
  ["Lead Fire Investigator", "Lead Fire Investigator — {placeOfAttachment}"],
  ["Incident No:", "Incident No: {incidentNo}"],
  ["Location of Fire:", "Location of Fire: {locationOfFire}"],
  ["Date of Fire:", "Date of Fire: {dateOfFire}"],
  ["Time of Call:", "Time of Call: {timeOfCall}"],
  ["Station       ", "Station {station}"],
  ["Coverage:", "Coverage: {coverage}"],
  ["Annex A and Photos", "Annex A and Photos {incidentPhotosRef}"],
  ["The ignition Source:", "The ignition Source: {ignitionSource}"],
  ["The Ignition Fuel/s:", "The Ignition Fuel/s: {ignitionFuel}"],
  ["Events/circumstances leading to the incident:", "Events/circumstances leading to the incident: {eventsCircumstances}"],
  ["a Probable Cause of Fire", "a Probable Cause of Fire: {probableCause}"],
  ["the location marked ‘O’", "the location marked ‘O’ at {areaOfFireOrigin}"],
  ["the location marked 'O'", "the location marked 'O' at {areaOfFireOrigin}"],
  ["Type of Burn Pattern/s Observed", "Type of Burn Pattern/s Observed: {burnPatterns}"],
  ["Type of evidence found at the scene", "Type of evidence found at the scene: {evidentiaryFactors}"],
  ["No details were available at the time of this report.", "{insuranceNotes}"],
  ["Annex A – Layout Plan of the Affected Area", "{annexLayoutPlan}"],
  ["Annex B – Photographs", "{annexPhotographs}"],
  ["8 ATTACHMENT", "8 ATTACHMENT\nAnnex reference: {annexReferenceSource}\nIncluded annexes:\n{annexAttachmentList}"],
  ["Report Prepared by:", "Report Prepared by: {preparedBy}"],
  ["Report Vetted", "Report Vetted by: {vettedBy}"],
  ["Approved by", "Approved by: {approvedBy}"],
  ["Report Accepted", "Report Accepted by: {acceptedBy}"],
];

for (const [from, to] of labelInserts) {
  xml = xml.split(from).join(to);
}

// Fire Involved
xml = xml.replace(
  /<w:t>Fire Involved<\/w:t>\s*<w:t>:<\/w:t>/,
  "<w:t>Fire Involved: {fireInvolved}</w:t>"
);

// Tenant section – first occurrences after section 3
const tenantLabels = [
  ["Designation:", "Designation: {tenantDesignation}"],
  ["Nationality:", "Nationality: {tenantNationality}"],
  ["Address:", "Address: {tenantAddress}"],
];
for (const [from, to] of tenantLabels) {
  xml = replaceOnce(xml, from, to);
}

// Tenant name – first "   Name" in tenant block (replace once)
xml = replaceOnce(xml, "<w:t>   Name</w:t>", "<w:t>   Name: {tenantName}</w:t>");

// Insurance
xml = replaceOnce(xml, "state the sum insured S$", "state the sum insured S$ {insuranceSum}");

// Interview 1 – after first interviewee1Name placeholder
xml = replaceOnce(
  xml,
  "{interviewee1Name},",
  "{interviewee1Name},"
);
xml = replaceOnce(xml, "Name of Interviewee:", "Name of Interviewee: {interviewee1Name}");
xml = replaceOnce(xml, "NRIC / FIN No.:", "NRIC / FIN No.: {interviewee1Nric}");
xml = replaceOnce(xml, "revealed the following:", "revealed the following: {interviewee1Facts}");

// Interview 2 block
xml = replaceOnce(xml, "Name of Interviewee:", "Name of Interviewee: {interviewee2Name}");
xml = replaceOnce(xml, "NRIC / FIN No.:", "NRIC / FIN No.: {interviewee2Nric}");
xml = replaceOnce(
  xml,
  "revealed the following: {interviewee1Facts}",
  "revealed the following: {interviewee2Facts}"
);

// Photo refs – replace generic "See Photo X" occurrences once each
xml = replaceOnce(xml, "See Photo X</w:t>", "See Photo {damagesPhotoRef}</w:t>");
xml = replaceOnce(xml, "See Photo X</w:t>", "See Photo {areaOfOriginPhotoRef}</w:t>");
xml = replaceOnce(xml, "See Photo X</w:t>", "See Photo {burnPatternsPhotoRef}</w:t>");
xml = replaceOnce(xml, "See Photo X</w:t>", "See Photo {evidentiaryPhotoRef}</w:t>");

// Injury section defaults stay as Nil in form; optional placeholders
xml = replaceOnce(xml, "Name of the person injured", "Name of the person injured: {injuryName}");
xml = replaceOnce(xml, "<w:t>PIN/FIN</w:t>", "<w:t>PIN/FIN: {injuryPin}</w:t>");

// Section 7
xml = replaceOnce(xml, "7 OTHER INFORMATION", "7 OTHER INFORMATION: {otherInformation}");

// Tenant NRIC (first in section 3)
xml = replaceOnce(xml, "NRIC / FIN No.:", "NRIC / FIN No.: {tenantNric}");

if (fs.existsSync(scdfIconPath)) {
  xml = injectScdfCoverIcon(zip, xml);
} else {
  console.warn("SCDF icon not found at", scdfIconPath);
}

xml = applyReportPageLayout(xml);
console.log("Applied report page layout (sections 1-3, 4-5, 5 cont., 6-8, blank, sign-off, annexes)");

zip.file("word/document.xml", xml);
fs.writeFileSync(
  templatePath,
  zip.generate({ type: "nodebuffer", compression: "DEFLATE" })
);

const placeholders = [...xml.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]);
console.log("Template prepared:", templatePath);
console.log("Placeholders:", [...new Set(placeholders)].sort().join(", "));
