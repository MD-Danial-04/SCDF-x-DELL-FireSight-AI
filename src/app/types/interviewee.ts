import { createClientId } from "../lib/createClientId";

export type LeadingQuestionSet = "none" | "amd" | "vehicle-fire" | "lpg-town-gas";

export type InterviewLanguage = "en" | "ms" | "ta" | "zh";

export const INTERVIEW_LANGUAGE_OPTIONS: {
  value: InterviewLanguage;
  label: string;
}[] = [
  { value: "en", label: "English" },
  { value: "ms", label: "Malay (Bahasa Melayu)" },
  { value: "ta", label: "Tamil" },
  { value: "zh", label: "Mandarin (中文)" },
];

export const INTERVIEW_LANGUAGE_SPOKEN_LABELS: Record<InterviewLanguage, string> = {
  en: "English",
  ms: "Malay",
  ta: "Tamil",
  zh: "Mandarin",
};

export type InterviewSectionId = "personal" | "contact" | "statement";

export interface TranscriptPage {
  id: string;
  sectionId: InterviewSectionId;
  interviewLanguage: InterviewLanguage;
  leadingQuestionSet: LeadingQuestionSet;
  transcriptOriginal: string;
  transcriptEnglish: string;
  recordedStartTime: string;
  recordedEndTime: string;
  /**
   * Leading-question ids the investigator has manually marked as "asked"
   * during the live interview (independent of AI coverage).
   */
  askedQuestionIds?: string[];
  /** Fixed pages are always present and cannot be removed or re-sectioned. */
  fixed?: boolean;
}

/** Transcript sections that always exist (in order) for every interviewee. */
export const FIXED_TRANSCRIPT_SECTIONS: InterviewSectionId[] = [
  "personal",
  "contact",
  "statement",
];

export interface Interviewee {
  id: string;
  name: string;
  designation: string;
  nric: string;
  nationality: string;
  address: string;
  contactMobile: string;
  contactHome: string;
  contactOffice: string;
  facts: string;
  factsOriginal: string;
  interviewLanguage: InterviewLanguage;
  nameChinese: string;
  sex: string;
  age: string;
  dateAndPlaceOfBirth: string;
  passportNo: string;
  maritalStatus: string;
  numberOfChildren: string;
  citizenshipCertNo: string;
  vehicleNo: string;
  placeOfEmployment: string;
  recordedStartTime: string;
  recordedEndTime: string;
  recordedDate: string;
  interviewTakenPlace: string;
  signatureDataUrl: string;
  languageSpoken: string;
  interpretedBy: string;
  recordedBy: string;
  leadingQuestionSet: LeadingQuestionSet;
  transcriptPages: TranscriptPage[];
}

export type IntervieweeFieldKey = keyof Omit<
  Interviewee,
  "id" | "transcriptPages"
>;

export function createEmptyTranscriptPage(
  sectionId: InterviewSectionId,
  interviewLanguage: InterviewLanguage = "en",
  leadingQuestionSet: LeadingQuestionSet = "none",
  fixed = false
): TranscriptPage {
  return {
    id: createClientId(),
    sectionId,
    interviewLanguage,
    leadingQuestionSet,
    transcriptOriginal: "",
    transcriptEnglish: "",
    recordedStartTime: "",
    recordedEndTime: "",
    askedQuestionIds: [],
    fixed,
  };
}

/** Create the ordered set of fixed transcript pages every interviewee has. */
function createFixedTranscriptPages(
  interviewLanguage: InterviewLanguage = "en",
  leadingQuestionSet: LeadingQuestionSet = "none"
): TranscriptPage[] {
  return FIXED_TRANSCRIPT_SECTIONS.map((sectionId) =>
    createEmptyTranscriptPage(
      sectionId,
      interviewLanguage,
      sectionId === "statement" ? leadingQuestionSet : "none",
      true
    )
  );
}

export function createEmptyInterviewee(recordedBy = ""): Interviewee {
  return {
    id: createClientId(),
    name: "",
    designation: "",
    nric: "",
    nationality: "",
    address: "",
    contactMobile: "",
    contactHome: "",
    contactOffice: "",
    facts: "",
    factsOriginal: "",
    interviewLanguage: "en",
    nameChinese: "",
    sex: "",
    age: "",
    dateAndPlaceOfBirth: "",
    passportNo: "",
    maritalStatus: "",
    numberOfChildren: "",
    citizenshipCertNo: "",
    vehicleNo: "",
    placeOfEmployment: "",
    recordedStartTime: "",
    recordedEndTime: "",
    recordedDate: "",
    interviewTakenPlace: "",
    signatureDataUrl: "",
    languageSpoken: "",
    interpretedBy: "",
    recordedBy,
    leadingQuestionSet: "none",
    transcriptPages: createFixedTranscriptPages(),
  };
}

/** True when every fixed transcript section is present as a fixed page. */
export function hasAllFixedTranscriptPages(interviewee: Interviewee): boolean {
  const pages = interviewee.transcriptPages ?? [];
  return FIXED_TRANSCRIPT_SECTIONS.every((sectionId) =>
    pages.some((page) => page.sectionId === sectionId && page.fixed)
  );
}

/**
 * Ensures an interviewee always has the fixed transcript pages
 * (personal, contact, statement) present, in order, and marked fixed.
 *
 * Existing pages and their content are preserved: a page already matching a
 * fixed section is reused (and marked fixed), missing fixed sections are
 * created, and any extra user-added pages are kept after the fixed ones.
 *
 * Older reports stored the statement on the interviewee directly
 * (facts/factsOriginal + leadingQuestionSet); those seed the statement page
 * when no statement transcript page exists yet.
 */
export function ensureTranscriptPages(interviewee: Interviewee): Interviewee {
  const existing = interviewee.transcriptPages ?? [];

  if (hasAllFixedTranscriptPages(interviewee)) {
    return interviewee;
  }

  const usedIds = new Set<string>();
  const fixedPages: TranscriptPage[] = FIXED_TRANSCRIPT_SECTIONS.map(
    (sectionId) => {
      const match = existing.find(
        (page) => page.sectionId === sectionId && !usedIds.has(page.id)
      );
      if (match) {
        usedIds.add(match.id);
        return { ...match, fixed: true };
      }

      const created = createEmptyTranscriptPage(
        sectionId,
        interviewee.interviewLanguage,
        sectionId === "statement" ? interviewee.leadingQuestionSet : "none",
        true
      );

      if (sectionId === "statement") {
        return {
          ...created,
          transcriptOriginal: interviewee.factsOriginal ?? "",
          transcriptEnglish: interviewee.facts ?? "",
          recordedStartTime: interviewee.recordedStartTime ?? "",
          recordedEndTime: interviewee.recordedEndTime ?? "",
        };
      }

      return created;
    }
  );

  const extraPages = existing
    .filter((page) => !usedIds.has(page.id))
    .map((page) => ({ ...page, fixed: false }));

  return { ...interviewee, transcriptPages: [...fixedPages, ...extraPages] };
}
