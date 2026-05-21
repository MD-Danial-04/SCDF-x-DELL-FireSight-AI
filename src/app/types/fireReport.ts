import { defaultCaseId } from "../lib/caseId";

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
  interviewee1Name: string;
  interviewee1Designation: string;
  interviewee1Nric: string;
  interviewee1Nationality: string;
  interviewee1Address: string;
  interviewee1ContactMobile: string;
  interviewee1ContactHome: string;
  interviewee1ContactOffice: string;
  interviewee1Facts: string;
  interviewee2Name: string;
  interviewee2Designation: string;
  interviewee2Nric: string;
  interviewee2Nationality: string;
  interviewee2Address: string;
  interviewee2ContactMobile: string;
  interviewee2ContactHome: string;
  interviewee2ContactOffice: string;
  interviewee2Facts: string;

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
    interviewee1Name: "",
    interviewee1Designation: "",
    interviewee1Nric: "",
    interviewee1Nationality: "",
    interviewee1Address: "",
    interviewee1ContactMobile: "",
    interviewee1ContactHome: "",
    interviewee1ContactOffice: "",
    interviewee1Facts: "",
    interviewee2Name: "",
    interviewee2Designation: "",
    interviewee2Nric: "",
    interviewee2Nationality: "",
    interviewee2Address: "",
    interviewee2ContactMobile: "",
    interviewee2ContactHome: "",
    interviewee2ContactOffice: "",
    interviewee2Facts: "",
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
  "interviewee1Facts",
];
