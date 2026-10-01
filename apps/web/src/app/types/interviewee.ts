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

export type InterviewSectionId = "personal" | "statement";

/**
 * Older drafts stored a separate "contact" section page. It has since been
 * merged into the personal section; this literal is kept only for migrating
 * those drafts.
 */
export const LEGACY_CONTACT_SECTION_ID = "contact";

/**
 * A single question/answer segment captured during a guided interview. Each
 * answer is recorded and transcribed on its own so the transcript can be shown
 * per question and mapped back to the leading-question checklist.
 */
export interface QuestionResponse {
  /** Leading-question id, or a generated id for an AI follow-up. */
  questionId: string;
  /** Snapshot of the English prompt that was asked (for the report transcript). */
  promptEnglish: string;
  transcriptOriginal: string;
  transcriptEnglish: string;
  /** Transcription job id for this answer segment, if any. */
  jobId?: string;
  /** True when this came from an AI-suggested follow-up question. */
  isFollowUp?: boolean;
}

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
  /**
   * Per-question answer segments captured by the guided interview view. The
   * flat transcriptOriginal/transcriptEnglish above remain the source of truth
   * for the report and DOCX export; this preserves the question mapping so the
   * guided view can be resumed and re-rendered.
   */
  questionResponses?: QuestionResponse[];
  /** Fixed pages are always present and cannot be removed or re-sectioned. */
  fixed?: boolean;
}

/**
 * Build the flat original/English transcript from per-question answer segments.
 * Empty answers are skipped. Each kept answer is rendered as `Q: ...` / `A: ...`
 * so downstream extraction, analysis and DOCX export keep working unchanged.
 */
export function buildTranscriptFromResponses(
  responses: QuestionResponse[]
): { original: string; english: string } {
  const originalParts: string[] = [];
  const englishParts: string[] = [];

  for (const response of responses) {
    const original = response.transcriptOriginal.trim();
    const english = response.transcriptEnglish.trim();
    if (!original && !english) continue;
    const prompt = response.promptEnglish.trim();
    originalParts.push(prompt ? `Q: ${prompt}\nA: ${original || english}` : original || english);
    englishParts.push(prompt ? `Q: ${prompt}\nA: ${english || original}` : english || original);
  }

  return {
    original: originalParts.join("\n\n"),
    english: englishParts.join("\n\n"),
  };
}

/** Transcript sections that always exist (in order) for every interviewee. */
export const FIXED_TRANSCRIPT_SECTIONS: InterviewSectionId[] = [
  "personal",
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

function joinTranscript(a: string, b: string): string {
  const base = (a ?? "").trim();
  const next = (b ?? "").trim();
  if (!base) return next;
  if (!next) return base;
  return `${base}\n\n${next}`;
}

/** True when any page uses the legacy "contact" section id. */
export function hasLegacyContactPage(interviewee: Interviewee): boolean {
  return (interviewee.transcriptPages ?? []).some(
    (page) => (page.sectionId as string) === LEGACY_CONTACT_SECTION_ID
  );
}

/**
 * Merge legacy "contact" pages into the personal page (their only unique data
 * is transcript text; extracted contact numbers already live on the
 * interviewee object), then drop the contact pages.
 */
function collapseLegacyContactPages(pages: TranscriptPage[]): TranscriptPage[] {
  const contactPages = pages.filter(
    (page) => (page.sectionId as string) === LEGACY_CONTACT_SECTION_ID
  );
  if (contactPages.length === 0) return pages;

  const mergedOriginal = contactPages.reduce(
    (acc, page) => joinTranscript(acc, page.transcriptOriginal),
    ""
  );
  const mergedEnglish = contactPages.reduce(
    (acc, page) => joinTranscript(acc, page.transcriptEnglish),
    ""
  );

  let mergedIntoPersonal = false;
  return pages
    .filter((page) => (page.sectionId as string) !== LEGACY_CONTACT_SECTION_ID)
    .map((page) => {
      if (page.sectionId === "personal" && !mergedIntoPersonal) {
        mergedIntoPersonal = true;
        return {
          ...page,
          transcriptOriginal: joinTranscript(
            page.transcriptOriginal,
            mergedOriginal
          ),
          transcriptEnglish: joinTranscript(
            page.transcriptEnglish,
            mergedEnglish
          ),
        };
      }
      return page;
    });
}

/**
 * Ensures an interviewee always has the fixed transcript pages
 * (personal, statement) present, in order, and marked fixed.
 *
 * Existing pages and their content are preserved: a page already matching a
 * fixed section is reused (and marked fixed), missing fixed sections are
 * created, and any extra user-added pages are kept after the fixed ones.
 *
 * Legacy "contact" pages are merged into the personal page and removed.
 *
 * Older reports stored the statement on the interviewee directly
 * (facts/factsOriginal + leadingQuestionSet); those seed the statement page
 * when no statement transcript page exists yet.
 */
export function ensureTranscriptPages(interviewee: Interviewee): Interviewee {
  const legacyContact = hasLegacyContactPage(interviewee);

  // Nothing to migrate: keep the same reference so render stays stable.
  if (hasAllFixedTranscriptPages(interviewee) && !legacyContact) {
    return interviewee;
  }

  const existing = legacyContact
    ? collapseLegacyContactPages(interviewee.transcriptPages ?? [])
    : interviewee.transcriptPages ?? [];

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
