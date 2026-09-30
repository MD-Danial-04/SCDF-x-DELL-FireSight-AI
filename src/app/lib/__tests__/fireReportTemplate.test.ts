import fs from "node:fs";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { createEmptyReportFields } from "../../types/fireReport";
import { extractReportFields } from "../extractReportFields";

const templatePath = new URL("../../../assets/templates/fire-investigation-report.docx", import.meta.url);

function render(data: Record<string, unknown>) {
  const doc = new Docxtemplater(new PizZip(fs.readFileSync(templatePath)), {
    paragraphLoop: true, linebreaks: true, nullGetter: () => "",
  });
  doc.render(data);
  return doc.getZip().file("word/document.xml")!.asText();
}

describe("demo report template", () => {
  it("renders every mapped field, escapes input, and retains the demo title and disclaimer", () => {
    const xml = new PizZip(fs.readFileSync(templatePath)).file("word/document.xml")!.asText();
    const fields = [...xml.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
    const defaults = createEmptyReportFields();
    expect(fields).toHaveLength(36);
    for (const field of fields) expect(defaults).toHaveProperty(field);
    const data = Object.fromEntries(fields.map((field) => [field, `LIVE_${field} & <verified>`]));
    const result = render(data);
    for (const field of fields) expect(result).toContain(`LIVE_${field} &amp; &lt;verified&gt;`);
    expect(result).toContain("Fire Investigation Summary");
    expect(result).toContain("It does not represent an official investigation report.");
    expect(result).not.toMatch(/DEMO-2026-001|2026-09-01|\[Block Number\]|\[Appliance Call Sign\]|\{\w+\}/);
  });

  it("populates a parsed stop message and supports multiline findings", () => {
    const message = "LF812 stop at location at 123 Example Road. Case of rubbish fire. Upon arrival, white smoke seen. Upon investigation, fire found in CRC of block 123 involving rubbish contents. CD extinguished fire using 1x hosereel. Case classified as C2 accidental due to naked light. Case handed over to SGT Example T12345 from Example NPC.";
    const extracted = extractReportFields(message);
    expect(extracted.applianceCallSign).toBe("LF812");
    expect(extracted.ignitionSource).toBe("naked light");
    const result = render({ ...createEmptyReportFields(), ...extracted, burnPatterns: "First observation\nSecond observation" });
    expect(result).toContain("LF812");
    expect(result).toContain("naked light");
    expect(result).toContain("Example NPC");
    expect(result).toContain("First observation");
    expect(result).toContain("Second observation");
    expect(result).toMatch(/<w:br\s*\/>/);
  });

  it("clears sample incident values when fields are empty", () => {
    const result = render({});
    expect(result).not.toMatch(/DEMO-2026-001|2026-09-01|\[Block Number\]|\[Appliance Call Sign\]|fire mod|undefined|\{\w+\}/);
  });
});
