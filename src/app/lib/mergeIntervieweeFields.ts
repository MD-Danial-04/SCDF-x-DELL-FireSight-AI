import type { InterviewDetailsResult } from "../types/inference";
import type { Interviewee, IntervieweeFieldKey } from "../types/interviewee";

const INTERVIEW_DETAIL_FIELD_KEYS: IntervieweeFieldKey[] = [
  "name",
  "nameChinese",
  "designation",
  "nric",
  "passportNo",
  "nationality",
  "sex",
  "age",
  "dateAndPlaceOfBirth",
  "maritalStatus",
  "numberOfChildren",
  "citizenshipCertNo",
  "vehicleNo",
  "address",
  "placeOfEmployment",
  "contactHome",
  "contactMobile",
  "contactOffice",
  "interviewTakenPlace",
  "interpretedBy",
];

export interface MergeIntervieweeFieldsResult {
  interviewee: Interviewee;
  extractedKeys: Set<IntervieweeFieldKey>;
}

export function mergeIntervieweeFields(
  interviewee: Interviewee,
  extracted: InterviewDetailsResult | null | undefined,
  allowedKeys?: Iterable<IntervieweeFieldKey>
): MergeIntervieweeFieldsResult {
  if (!extracted?.fields) {
    return { interviewee, extractedKeys: new Set() };
  }

  const allowList = allowedKeys ? new Set(allowedKeys) : null;
  let changed = false;
  const next: Interviewee = { ...interviewee };
  const extractedKeys = new Set<IntervieweeFieldKey>();

  for (const key of INTERVIEW_DETAIL_FIELD_KEYS) {
    if (allowList && !allowList.has(key)) {
      continue;
    }
    const currentValue = `${next[key] ?? ""}`.trim();
    const incomingValue = `${extracted.fields[key] ?? ""}`.trim();
    if (currentValue || !incomingValue) {
      continue;
    }
    next[key] = incomingValue as Interviewee[typeof key];
    extractedKeys.add(key);
    changed = true;
  }

  return {
    interviewee: changed ? next : interviewee,
    extractedKeys,
  };
}
