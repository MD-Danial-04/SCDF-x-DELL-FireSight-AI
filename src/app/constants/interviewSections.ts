import type {
  IntervieweeFieldKey,
  InterviewSectionId,
} from "../types/interviewee";

export interface IntervieweeFieldConfig {
  key: IntervieweeFieldKey;
  label: string;
  multiline?: boolean;
}

export const PERSONAL_FIELDS: IntervieweeFieldConfig[] = [
  { key: "name", label: "Name of Interviewee" },
  { key: "nameChinese", label: "Name in Chinese characters (if applicable)" },
  { key: "designation", label: "Designation / Occupation" },
  { key: "nric", label: "NRIC / FIN No." },
  { key: "passportNo", label: "Passport No." },
  { key: "nationality", label: "Nationality" },
  { key: "sex", label: "Sex (Male/Female)" },
  { key: "age", label: "Age" },
  { key: "dateAndPlaceOfBirth", label: "Date and Place of Birth" },
  { key: "maritalStatus", label: "Marital Status" },
  { key: "numberOfChildren", label: "No. of Children" },
  { key: "citizenshipCertNo", label: "Singapore Citizenship Certificate No." },
  { key: "vehicleNo", label: "Vehicle No." },
  { key: "address", label: "Address", multiline: true },
  { key: "placeOfEmployment", label: "Place of Employment" },
];

export const CONTACT_FIELDS: IntervieweeFieldConfig[] = [
  { key: "contactHome", label: "Contact No. (Home / Residence)" },
  { key: "contactMobile", label: "Contact No. (Mobile)" },
  { key: "contactOffice", label: "Contact No. (Office)" },
];

/**
 * Recording metadata. These are NOT parsed by the LLM:
 * start/end time, date and language are system-known (captured from the
 * recording timer, the system clock and the selected interview language),
 * while place / interpreted by / recorded by are manual inputs.
 */
export const RECORDING_METADATA_FIELDS: IntervieweeFieldConfig[] = [
  { key: "recordedStartTime", label: "Statement recorded - Start time" },
  { key: "recordedEndTime", label: "Statement recorded - End time" },
  { key: "recordedDate", label: "Statement recorded - Date" },
  { key: "interviewTakenPlace", label: "Interview taken at (place)" },
  { key: "languageSpoken", label: "Language Spoken" },
  { key: "interpretedBy", label: "Interpreted By (if applicable)" },
  { key: "recordedBy", label: "Recorded By (Rank, Name & Signature)" },
];

/** Recording-metadata fields the system fills in automatically. */
export const SYSTEM_RECORDING_FIELD_KEYS: IntervieweeFieldKey[] = [
  "recordedStartTime",
  "recordedEndTime",
  "recordedDate",
  "languageSpoken",
];

export type InterviewSectionKind = "profile" | "leading-questions";

export interface InterviewSection {
  id: InterviewSectionId;
  label: string;
  description: string;
  kind: InterviewSectionKind;
  /** Profile sections: the interviewee fields the NLP fills for this section. */
  fields?: IntervieweeFieldConfig[];
}

/**
 * The selectable menu of interview sections. Selecting a section determines
 * what the NLP fills out from that transcript page. Recording metadata is
 * intentionally absent - it is system-known, never LLM-parsed.
 */
export const INTERVIEW_SECTIONS: InterviewSection[] = [
  {
    id: "statement",
    label: "Statement recording",
    description:
      "Record the statement, answer the selected leading questions from the transcript, and get follow-up prompts.",
    kind: "leading-questions",
  },
  {
    id: "personal",
    label: "Personal details",
    description: "Fill the interviewee's personal particulars from the transcript.",
    kind: "profile",
    fields: PERSONAL_FIELDS,
  },
  {
    id: "contact",
    label: "Contact numbers",
    description: "Fill the interviewee's contact numbers from the transcript.",
    kind: "profile",
    fields: CONTACT_FIELDS,
  },
];

export function getInterviewSection(id: InterviewSectionId): InterviewSection {
  return (
    INTERVIEW_SECTIONS.find((section) => section.id === id) ??
    INTERVIEW_SECTIONS[0]
  );
}

export function getSectionFieldKeys(id: InterviewSectionId): IntervieweeFieldKey[] {
  return getInterviewSection(id).fields?.map((field) => field.key) ?? [];
}
