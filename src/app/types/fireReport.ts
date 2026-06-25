import { defaultCaseId } from "../lib/caseId";
import { createEmptyInterviewee, type Interviewee } from "./interviewee";

export interface FireReportData {
  // 1 GENERAL INFORMATION
  investigatorNameRank: string;
  placeOfAttachment: string;
  incidentNo: string;
  locationOfFire: string;
  dateOfFire: string;
  timeOfCall: string;
  station: string;
  coverage: string;

  // 2 INCIDENT INFORMATION
  fireInvolved: string;
  incidentPhotosRef: string;
  methodOfExtinguishment: string;
  damagesSustained: string;
  damagesPhotoRef: string;
  applianceCallSign: string;
  classification: string;
  handoverOfficer: string;
  handoverNpc: string;

  // 3 TENANT
  tenantName: string;
  tenantDesignation: string;
  tenantNric: string;
  tenantNationality: string;
  tenantAddress: string;
  tenantContactMobile: string;
  tenantContactHome: string;
  tenantContactOffice: string;
  tenantInterviewTranscript: string;

  // 4 INSURANCE
  insuranceInsured: string;
  insuranceSum: string;
  insuranceNotes: string;

  // 5 INVESTIGATION & FINDINGS
  probableCause: string;
  ignitionSource: string;
  ignitionFuel: string;
  eventsCircumstances: string;
  areaOfFireOrigin: string;
  areaOfOriginPhotoRef: string;
  burnPatterns: string;
  burnPatternsPhotoRef: string;
  evidentiaryFactors: string;
  evidentiaryPhotoRef: string;
  interviewees: Interviewee[];

  // 6 INJURY
  injuryName: string;
  injuryPin: string;
  injuryAddress: string;
  injuryType: string;

  // 7 OTHER INFORMATION
  otherInformation: string;

  // 8 ATTACHMENTS
  annexReferenceSource: string;
  selectedAnnexes: string;
  annexAttachmentList: string;
  annexLayoutPlan: string;
  annexPhotographs: string;

  // 9 SIGN-OFF
  preparedBy: string;
  vettedBy: string;
  approvedBy: string;
  acceptedBy: string;
  reportDate: string;
}

export type FireReportFieldKey = keyof FireReportData;

export function createEmptyReportFields(): FireReportData {
  const today = new Date().toISOString().slice(0, 10);
  const id = defaultCaseId(today);
  return {
    investigatorNameRank: "",
    placeOfAttachment: "",
    incidentNo: id,
    locationOfFire: "",
    dateOfFire: today,
    timeOfCall: "",
    station: "",
    coverage: "",
    fireInvolved: "",
    incidentPhotosRef: "See Annex A and Photos X to XX",
    methodOfExtinguishment: "",
    damagesSustained: "",
    damagesPhotoRef: "See Photo X",
    applianceCallSign: "",
    classification: "",
    handoverOfficer: "",
    handoverNpc: "",
    tenantName: "",
    tenantDesignation: "",
    tenantNric: "",
    tenantNationality: "",
    tenantAddress: "",
    tenantContactMobile: "",
    tenantContactHome: "",
    tenantContactOffice: "",
    tenantInterviewTranscript: "",
    insuranceInsured: "No",
    insuranceSum: "",
    insuranceNotes: "No details were available at the time of this report.",
    probableCause: "",
    ignitionSource: "",
    ignitionFuel: "",
    eventsCircumstances: "",
    areaOfFireOrigin: "",
    areaOfOriginPhotoRef: "See Photo X",
    burnPatterns: "",
    burnPatternsPhotoRef: "See Photo X",
    evidentiaryFactors: "",
    evidentiaryPhotoRef: "See Photo X",
    interviewees: [createEmptyInterviewee()],
    injuryName: "Nil",
    injuryPin: "Nil",
    injuryAddress: "Nil",
    injuryType: "Nil",
    otherInformation: "",
    annexReferenceSource: "Annexes (A-G).pptx",
    selectedAnnexes: "A,B",
    annexAttachmentList: "Annex A – Layout Plan of the Affected Area\nAnnex B – Photographs",
    annexLayoutPlan: "Annex A – Layout Plan of the Affected Area",
    annexPhotographs: "Annex B – Photographs",
    preparedBy: "",
    vettedBy: "",
    approvedBy: "",
    acceptedBy: "",
    reportDate: today,
  };
}

/** Keys auto-filled from stop message extraction */
export const EXTRACTABLE_KEYS: FireReportFieldKey[] = [
  "applianceCallSign",
  "locationOfFire",
  "fireInvolved",
  "methodOfExtinguishment",
  "damagesSustained",
  "probableCause",
  "ignitionSource",
  "ignitionFuel",
  "eventsCircumstances",
  "areaOfFireOrigin",
  "classification",
  "handoverOfficer",
  "handoverNpc",
];
