import type { FireReportData } from "../types/fireReport";

export function matchOne(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  return m?.[1]?.trim() ?? "";
}

export function extractNarrativeClauses(text: string): string {
  const clauses: string[] = [];
  const uponArrival = matchOne(text, /(upon arrival[^.]*\.)/i);
  const uponInvestigation = matchOne(text, /(upon investigation[^.]*\.)/i);
  if (uponArrival) clauses.push(uponArrival);
  if (uponInvestigation) clauses.push(uponInvestigation);
  return clauses.join(" ");
}

/** Appliance call sign — supports "stop at/for location" and repeated unit IDs (e.g. LF812). */
export function extractCallSign(text: string): string {
  const repeated = [...text.matchAll(/([A-Z]{1,3}\d{2,4}[A-Z]?)\s+stop\s+(?:at|for)\s+location/gi)];
  if (repeated.length > 0) {
    return repeated[repeated.length - 1][1].trim();
  }
  const stopForAddress = matchOne(text, /^(.+?)\s+stop\s+for\s+\d/i);
  if (stopForAddress) return stopForAddress;
  return matchOne(text, /^(.+?)\s+stop\s+(?:at|for)\s+location/i);
}

/** Address after "stop at/for location at …" or "stop for [address] case of". */
export function extractStopLocationAddress(text: string): string {
  return (
    matchOne(text, /stop\s+(?:at|for)\s+location\s+at\s+(.+?)(?:\.\s|case\s)/i) ||
    matchOne(text, /stop\s+for\s+(.+?)\s+case\s+of/i) ||
    matchOne(text, /stop\s+at\s+location(?:,\s*)?(.+?)(?:\.|upon)/i)
  );
}

export function extractClassification(text: string): string {
  return matchOne(
    text,
    /classified as\s+(.+?)(?:\.\s+upon|\.\s+case|\s+due to)/i
  );
}

/** Normalize "Nanyang npc" → "Nanyang NPC". */
export function normalizeNpcName(name: string): string {
  const trimmed = name.trim().replace(/\s*npc\s*$/i, "").trim();
  if (!trimmed) return "";
  return /\bNPC$/i.test(trimmed) ? trimmed.replace(/\bNPC$/i, "NPC") : `${trimmed} NPC`;
}

/** Clean handover officer: drop "wa" before Tango ID, capitalize name (e.g. S3 Alsyraf T190350). */
export function formatHandoverOfficer(raw: string): string {
  let s = raw.trim().replace(/\bwa(T\d+)/gi, "T$1");

  const withTango = s.match(/^(\S+)\s+(.+?)\s+(T\d+)$/i);
  if (withTango) {
    const [, rank, namePart, tango] = withTango;
    const formattedName = namePart
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return `${rank.toUpperCase()} ${formattedName} ${tango.toUpperCase()}`;
  }

  return s.replace(/\b([a-z][a-z]+)\b/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Handover line: "S3 Alsyraf T190350 - Nanyang NPC". */
export function extractHandover(text: string): string {
  const officer = matchOne(text, /handed over to\s+(.+?)(?:\s+from|\s*\.)/i);
  const npcRaw =
    matchOne(text, /from\s+(.+?)\s+NPC/i) ||
    matchOne(text, /from\s+(.+?)(?:\s*\.|$)/i);
  const npc = npcRaw ? normalizeNpcName(npcRaw) : "";
  const formattedOfficer = officer ? formatHandoverOfficer(officer) : "";
  if (formattedOfficer && npc) return `${formattedOfficer} - ${npc}`;
  return formattedOfficer || npc;
}

/** First two digits from the numeric part of an appliance call sign (e.g. LF812 → 81). */
export function extractStationFromCallSign(callSign: string): string {
  const digits = callSign.replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(0, 2) : "";
}

export function extractReportFields(
  stopMessage: string,
  incidentTypeName?: string
): Partial<FireReportData> {
  const t = stopMessage.replace(/\s+/g, " ").trim();
  if (!t) return {};

  const applianceCallSign = extractCallSign(t);
  const caseType = matchOne(t, /case of\s+(.+?)(?:\.|upon arrival)/i);
  const stopAddress = extractStopLocationAddress(t);
  const blockNumber = matchOne(t, /block\s+(\d+)/i);
  const smoke = matchOne(t, /(white smoke|black smoke)/i);
  const fireLocation = matchOne(
    t,
    /fire found in\s+(.+?)(?:\.|cd\s|case\s)/i
  );
  const suppression =
    matchOne(
      t,
      /(?:extinguished|(?:CD|Scdf))\s+.+?(?:using\s+)?(\d+x\s+[\w\s]+?)(?:\.|case\s)/i
    ) || matchOne(t, /using\s+(\d+x\s+[\w\s]+)/i);
  const classification = extractClassification(t);
  const cause = matchOne(t, /due to\s+(.+?)(?:\.|case\s)/i);
  const handoverOfficer = matchOne(t, /handed over to\s+(.+?)(?:\s+from|\s*\.)/i);
  const npcRaw =
    matchOne(t, /from\s+(.+?)\s+NPC/i) ||
    matchOne(t, /from\s+(.+?)(?:\s*\.|$)/i);
  const handoverNpc = npcRaw ? normalizeNpcName(npcRaw) : "";

  const locationParts = [
    blockNumber ? `Blk ${blockNumber}` : "",
    fireLocation,
    smoke ? `(${smoke})` : "",
  ].filter(Boolean);

  const locationOfFire =
    locationParts.join(", ") ||
    stopAddress ||
    (/(?:stop at|stop for) location/i.test(t) ? "As per stop message" : "");

  const methodOfExtinguishment = [applianceCallSign, suppression]
    .filter(Boolean)
    .join(" — ");

  const eventsCircumstances = t;
  const areaOfFireOrigin = fireLocation || (blockNumber ? `CRC of block ${blockNumber}` : "");

  return {
    applianceCallSign,
    locationOfFire,
    fireInvolved: caseType || incidentTypeName || "",
    methodOfExtinguishment,
    damagesSustained: fireLocation ? `${fireLocation} contents` : "",
    probableCause: classification || cause,
    ignitionSource: cause || classification,
    ignitionFuel: fireLocation || caseType,
    eventsCircumstances,
    areaOfFireOrigin,
    classification,
    handoverOfficer,
    handoverNpc,
  };
}

export function mergeReportFields(
  base: FireReportData,
  extracted: Partial<FireReportData>
): FireReportData {
  const merged = { ...base };
  for (const [key, value] of Object.entries(extracted)) {
    if (value && typeof value === "string") {
      (merged as Record<string, string>)[key] = value;
    }
  }
  return merged;
}
