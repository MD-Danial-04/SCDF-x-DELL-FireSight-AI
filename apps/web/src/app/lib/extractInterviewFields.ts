import type { InterviewDetailsResult, InterviewExtractableField } from "../types/inference";

function pickFirstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

export function extractInterviewFields(transcript: string): InterviewDetailsResult {
  const text = transcript.trim();
  const nricMatch = text.match(/\b([STFG]\d{7}[A-Z])\b/i);
  const mobileMatch = text.match(/\b([89]\d{7})\b/);
  const name = pickFirstMatch(text, [
    /\bmy name is ([A-Za-z][A-Za-z\s.'-]{1,80})/i,
    /\bi am ([A-Za-z][A-Za-z\s.'-]{1,80})/i,
  ]);
  const designation = pickFirstMatch(text, [
    /\b(?:occupation|job|designation)\s*(?:is|:)\s*([A-Za-z][A-Za-z\s.'-]{1,80})/i,
  ]);
  const address = pickFirstMatch(text, [
    /\b(?:address|staying at|residing at)\s*(?:is|:)?\s*([A-Za-z0-9#,\-./\s]{5,120})/i,
  ]);

  const fields: Partial<Record<InterviewExtractableField, string>> = {};
  const confidence: Partial<Record<InterviewExtractableField, number>> = {};

  if (name) {
    fields.name = name.replace(/\s+/g, " ").trim();
    confidence.name = 0.7;
  }
  if (nricMatch?.[1]) {
    fields.nric = nricMatch[1].toUpperCase();
    confidence.nric = 0.9;
  }
  if (mobileMatch?.[1]) {
    fields.contactMobile = mobileMatch[1];
    confidence.contactMobile = 0.8;
  }
  if (designation) {
    fields.designation = designation.replace(/\s+/g, " ").trim();
    confidence.designation = 0.65;
  }
  if (address) {
    fields.address = address.replace(/\s+/g, " ").trim();
    confidence.address = 0.6;
  }

  return {
    fields,
    confidence,
    source: "regex_fallback",
  };
}
