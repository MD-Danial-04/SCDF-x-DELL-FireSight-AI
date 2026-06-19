import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { createEmptyReportFields } from "../types/fireReport";
import {
  formatPrrDate,
  formatPrrTimeOfCall,
  getPrrFilename,
  mapFireReportToPrr,
} from "./generatePrrDocx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(__dirname, "../../assets/templates/prr-report.docx");

describe("formatPrrDate", () => {
  it("formats ISO dates as DD Month YYYY", () => {
    expect(formatPrrDate("2026-06-08")).toBe("08 June 2026");
  });

  it("returns empty string for blank input", () => {
    expect(formatPrrDate("")).toBe("");
  });

  it("returns original value when not parseable", () => {
    expect(formatPrrDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatPrrTimeOfCall", () => {
  it("appends hrs when missing", () => {
    expect(formatPrrTimeOfCall("22:16:40")).toBe("22:16:40 hrs");
  });

  it("keeps existing hrs suffix", () => {
    expect(formatPrrTimeOfCall("22:16:40 hrs")).toBe("22:16:40 hrs");
  });
});

describe("mapFireReportToPrr", () => {
  it("maps fire report fields and defaults injury values to NIL", () => {
    const data = createEmptyReportFields();
    data.incidentNo = "/20260608/1495";
    data.locationOfFire = "Block 1, Example Street";
    data.dateOfFire = "2026-06-08";
    data.timeOfCall = "22:16:40";
    data.station = "Changi";
    data.coverage = "Changi Fire Station";
    data.fireInvolved = "Rubbish bin contents";
    data.methodOfExtinguishment = "Buckets of water";
    data.probableCause = "Accidental";
    data.damagesSustained = "Bin contents damaged";
    data.preparedBy = "SSGT Example";

    const mapped = mapFireReportToPrr(data);

    expect(mapped).toEqual({
      incidentNo: "/20260608/1495",
      locationOfFire: "Block 1, Example Street",
      dateOfFire: "08 June 2026",
      timeOfCall: "22:16:40 hrs",
      station: "Changi",
      coverage: "Changi Fire Station",
      fireInvolved: "Rubbish bin contents",
      methodOfExtinguishment: "Buckets of water",
      probableCause: "Accidental",
      damagesSustained: "Bin contents damaged",
      injuryName: "NIL",
      injuryPin: "NIL",
      injuryType: "NIL",
      preparedBy: "SSGT Example",
    });
  });
});

describe("getPrrFilename", () => {
  it("builds a safe download filename", () => {
    expect(getPrrFilename("/20260608/1495")).toBe("/20260608/1495_PRR.docx");
  });
});

describe("PRR template render", () => {
  it("produces a non-empty docx from the prepared template", () => {
    const data = createEmptyReportFields();
    data.incidentNo = "/20260608/1495";
    data.locationOfFire = "Block 1, Example Street";
    data.dateOfFire = "2026-06-08";
    data.timeOfCall = "22:16:40";
    data.preparedBy = "SSGT Example";

    const zip = new PizZip(fs.readFileSync(templatePath));
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });

    doc.render(mapFireReportToPrr(data) as unknown as Record<string, string>);

    const output = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
    expect(output.length).toBeGreaterThan(1000);
    expect(output.subarray(0, 2).toString()).toBe("PK");
  });
});
