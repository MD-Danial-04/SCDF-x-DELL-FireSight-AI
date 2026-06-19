export type LeadingQuestionSet = "none" | "amd" | "vehicle-fire" | "lpg-town-gas";

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
