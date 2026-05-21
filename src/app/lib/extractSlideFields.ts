import type { ActivationSlideData } from "../types/activationSlides";
import {
  extractCallSign,
  extractClassification,
  extractHandover,
  extractNarrativeClauses,
  extractStationFromCallSign,
  extractStopLocationAddress,
  matchOne,
} from "./extractReportFields";
import { inferRotaFromDate } from "./inferRota";

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatPersonName(raw: string): string {
  const withoutMr = raw.trim().replace(/^Mr\.?\s*/i, "");
  const name =
    withoutMr.charAt(0).toUpperCase() + withoutMr.slice(1).toLowerCase();
  return `Mr. ${name}`;
}

/** Parse safety officer (or similar) from field notes: "Zaini, 91472832,, safety officer". */
export function extractAccompanyingFromFieldNotes(fieldNotes: string): {
  accompanyingPerson: string;
  accompanyingContact: string;
} {
  const lines = fieldNotes.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!/safety\s+officer/i.test(line)) continue;

    const match = line.match(/^([^,]+),\s*(\d{6,})[\s,]*(?:,\s*)?(.+)$/i);
    if (match) {
      const [, namePart, phone, rolePart] = match;
      const person = `${formatPersonName(namePart)}, ${titleCaseWords(rolePart)}`;
      return { accompanyingPerson: person, accompanyingContact: phone.trim() };
    }
  }

  return { accompanyingPerson: "", accompanyingContact: "" };
}

export function extractSlideFields(
  stopMessage: string,
  incidentTypeName?: string,
  fieldNotes?: string,
  dutyDateIso?: string
): Partial<ActivationSlideData> {
  const t = stopMessage.replace(/\s+/g, " ").trim();
  if (!t && !fieldNotes?.trim()) return {};

  const callSign = extractCallSign(t);
  const caseType = matchOne(t, /case of\s+(.+?)(?:\.|upon arrival)/i);
  const blockNumber = matchOne(t, /block\s+(\d+)/i);
  const fireLocation = matchOne(t, /fire found in\s+(.+?)(?:\.|cd\s|case\s)/i);
  const stopAddress = extractStopLocationAddress(t);
  const classification =
    extractClassification(t) || caseType || incidentTypeName || "";
  const handedOver = extractHandover(t);
  const station = extractStationFromCallSign(callSign);
  const rota = dutyDateIso ? inferRotaFromDate(dutyDateIso) : "";

  const locationParts = [
    blockNumber ? `Blk ${blockNumber}` : "",
    fireLocation,
  ].filter(Boolean);
  const incidentLocation =
    locationParts.join(", ") ||
    stopAddress ||
    (/(?:stop at|stop for) location/i.test(t) ? "As per stop message" : "");

  const narrative = extractNarrativeClauses(t);
  const otherRemarks = narrative || (t.length > 280 ? `${t.slice(0, 280)}…` : t);

  const accompanying = fieldNotes?.trim()
    ? extractAccompanyingFromFieldNotes(fieldNotes)
    : { accompanyingPerson: "", accompanyingContact: "" };

  return {
    callSign,
    station,
    rota,
    incidentLocation,
    classification,
    handedOver,
    otherRemarks,
    accompanyingPerson: accompanying.accompanyingPerson,
    accompanyingContact: accompanying.accompanyingContact,
  };
}

export function mergeSlideFields(
  base: ActivationSlideData,
  extracted: Partial<ActivationSlideData>
): ActivationSlideData {
  const merged = { ...base };
  for (const [key, value] of Object.entries(extracted)) {
    if (value && typeof value === "string") {
      (merged as Record<string, string>)[key] = value;
    }
  }
  return merged;
}
