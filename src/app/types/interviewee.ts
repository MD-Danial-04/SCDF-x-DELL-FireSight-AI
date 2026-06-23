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
}

export type IntervieweeFieldKey = keyof Omit<Interviewee, "id">;

export function createEmptyInterviewee(recordedBy = ""): Interviewee {
  return {
    id: crypto.randomUUID(),
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
  };
}
