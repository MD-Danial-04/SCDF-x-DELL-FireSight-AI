import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { createEmptyReportFields } from "../types/fireReport";
import { createEmptyInterviewee } from "../types/interviewee";
import {
  INTERVIEWEE_SIGNATURE_MARKER,
  getStatementFilename,
  mapIntervieweeToStatement,
} from "./generateStatementDocx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(__dirname, "../../assets/templates/statement-form.docx");

describe("mapIntervieweeToStatement", () => {
  it("maps interviewee and report fields with defaults for recording metadata", () => {
    const report = createEmptyReportFields();
    report.incidentNo = "/20260608/1495";
    report.locationOfFire = "Block 1, Example Street";
    report.dateOfFire = "2026-06-08";
    report.investigatorNameRank = "SSGT Example";

    const interviewee = createEmptyInterviewee();
    interviewee.name = "John Tan";
    interviewee.designation = "Tenant";
    interviewee.nric = "S1234567A";
    interviewee.nationality = "Singaporean";
    interviewee.address = "Blk 1 Example Street";
    interviewee.contactMobile = "91234567";
    interviewee.contactHome = "67890123";
    interviewee.contactOffice = "61234567";
    interviewee.facts = "Upon arrival, white smoke was seen.";
    interviewee.recordedStartTime = "10:00";
    interviewee.recordedEndTime = "10:30";
    interviewee.languageSpoken = "English";

    const mapped = mapIntervieweeToStatement(interviewee, report);

    expect(mapped.name).toBe("John Tan");
    expect(mapped.incidentNo).toBe("/20260608/1495");
    expect(mapped.occupation).toBe("Tenant");
    expect(mapped.nric).toBe("S1234567A");
    expect(mapped.contactOffice).toBe("61234567");
    expect(mapped.recordedTime).toBe("Start: 10:00 End: 10:30");
    expect(mapped.recordedDate).toBe("08 June 2026");
    expect(mapped.interviewTakenPlace).toBe("");
    expect(mapped.recordedBy).toBe("SSGT Example");
    expect(mapped.facts).toBe("Upon arrival, white smoke was seen.");
  });

  it("uses interviewTakenPlace without falling back to location of fire", () => {
    const report = createEmptyReportFields();
    report.locationOfFire = "Block 1, Example Street";

    const interviewee = createEmptyInterviewee();
    interviewee.interviewTakenPlace = "SCDF Fire Station 8";

    const mapped = mapIntervieweeToStatement(interviewee, report);
    expect(mapped.interviewTakenPlace).toBe("SCDF Fire Station 8");
  });
});

describe("getStatementFilename", () => {
  it("builds a safe download filename", () => {
    expect(getStatementFilename("/20260608/1495", "John Tan")).toBe(
      "/20260608/1495_Statement_John_Tan.docx"
    );
  });
});

describe("Statement template field mapping", () => {
  it("maps every placeholder present in statement-form.docx", () => {
    const zip = new PizZip(fs.readFileSync(templatePath));
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";
    const placeholders = new Set(
      Array.from(documentXml.matchAll(/\{([^}]+)\}/g)).map((match) =>
        match[1].trim()
      )
    );

    expect(placeholders.size).toBeGreaterThan(0);

    const mapped = mapIntervieweeToStatement(
      createEmptyInterviewee(),
      createEmptyReportFields()
    );
    const mappedKeys = new Set(Object.keys(mapped));

    const unmapped = Array.from(placeholders).filter(
      (key) => key !== INTERVIEWEE_SIGNATURE_MARKER && !mappedKeys.has(key)
    );

    expect(unmapped).toEqual([]);
  });
});

describe("Statement template render", () => {
  it("produces a non-empty docx from the prepared template", () => {
    const report = createEmptyReportFields();
    report.incidentNo = "/20260608/1495";
    report.locationOfFire = "Block 1, Example Street";
    report.dateOfFire = "2026-06-08";

    const interviewee = createEmptyInterviewee();
    interviewee.name = "John Tan";
    interviewee.facts = "Facts revealed during interview.";

    const zip = new PizZip(fs.readFileSync(templatePath));
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });

    doc.render(mapIntervieweeToStatement(interviewee, report) as unknown as Record<string, string>);

    const output = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
    expect(output.length).toBeGreaterThan(1000);
    expect(output.subarray(0, 2).toString()).toBe("PK");
  });
});
