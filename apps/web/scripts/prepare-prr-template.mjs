/**
 * Injects docxtemplater placeholders into the PRR (Fire Report) template.
 * Run: node scripts/prepare-prr-template.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, "../src/assets/templates/PRR (Clean).docx");
const templatePath = path.join(__dirname, "../src/assets/templates/prr-report.docx");

function replaceOnce(str, search, replacement) {
  const i = str.indexOf(search);
  if (i === -1) return str;
  return str.slice(0, i) + replacement + str.slice(i + search.length);
}

fs.copyFileSync(sourcePath, templatePath);

const zip = new PizZip(fs.readFileSync(templatePath));
let xml = zip.file("word/document.xml").asText();

xml = replaceOnce(xml, "<w:t>/20260608/1495</w:t>", "<w:t>{incidentNo}</w:t>");

xml = xml.replace(
  /<w:t>FIRE REPORTED ON: 08 June <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>2026<\/w:t>/,
  "<w:t>FIRE REPORTED ON: {dateOfFire}</w:t>"
);

xml = xml.replace(
  /<w:t>Block XX, <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>Address<\/w:t>/,
  "<w:t>{locationOfFire}</w:t>"
);

xml = xml.replace(
  /<w:t>#XX-<\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>XX<\/w:t>/,
  "<w:t></w:t>"
);

xml = xml.replace(
  /<w:t>Singapore <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>XXXXXX<\/w:t>/,
  "<w:t></w:t>"
);

xml = xml.replace(
  /<w:t>TIME OF CALL: 22:16:40 <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>hrs<\/w:t>/,
  "<w:t>TIME OF CALL: {timeOfCall}</w:t>"
);

xml = replaceOnce(xml, "<w:t>STATION</w:t>", "<w:t>STATION: {station}</w:t>");

xml = xml.replace(
  /<w:t>COVERAGE: Changi Fire <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>Station<\/w:t>/,
  "<w:t>COVERAGE: {coverage}</w:t>"
);

xml = xml.replace(
  /<w:t>FIRE INVOLVED: The contents of a green rubbish <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>bin\.<\/w:t>/,
  "<w:t>FIRE INVOLVED: {fireInvolved}</w:t>"
);

xml = xml.replace(
  /<w:t>METHOD OF EXTINGUISHMENT: By members of public using buckets of <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>water<\/w:t>/,
  "<w:t>METHOD OF EXTINGUISHMENT: {methodOfExtinguishment}</w:t>"
);

xml = xml.replace(
  /<w:t>PROBABLE CAUSE OF FIRE: Accidental \(Embers from <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>Cigarette\(s\)\)<\/w:t>/,
  "<w:t>PROBABLE CAUSE OF FIRE: {probableCause}</w:t>"
);

xml = xml.replace(
  /<w:t>DAMAGE<\/w:t>[\s\S]*?<w:t>comprising discarded items were damaged\.<\/w:t>/,
  "<w:t>DAMAGE OBSERVED*: {damagesSustained}</w:t>"
);

const injuryStart = xml.indexOf("DEAD/INJURIES");
const injuryPlaceholders = ["{injuryName}", "{injuryPin}", "{injuryType}"];
let searchFrom = injuryStart;
for (const placeholder of injuryPlaceholders) {
  const nilTag = "<w:t>NIL</w:t>";
  const idx = xml.indexOf(nilTag, searchFrom);
  if (idx === -1) {
    console.warn("Could not find NIL placeholder near injury section for", placeholder);
    continue;
  }
  xml = xml.slice(0, idx) + `<w:t>${placeholder}</w:t>` + xml.slice(idx + nilTag.length);
  searchFrom = idx + 1;
}

xml = xml.replace(
  /<w:t>Rank \/ <\/w:t><\/w:r><w:r[^>]*><w:rPr[^>]*>[\s\S]*?<\/w:rPr><w:t>Name<\/w:t>/,
  "<w:t>{preparedBy}</w:t>"
);

zip.file("word/document.xml", xml);
fs.writeFileSync(
  templatePath,
  zip.generate({ type: "nodebuffer", compression: "DEFLATE" })
);

const placeholders = [...xml.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]);
console.log("Template prepared:", templatePath);
console.log("Placeholders:", [...new Set(placeholders)].sort().join(", "));
