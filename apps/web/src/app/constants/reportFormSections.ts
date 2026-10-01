import type { FireReportFieldKey } from "../types/fireReport";

export interface ReportFormFieldConfig {
  key: FireReportFieldKey;
  label: string;
  multiline?: boolean;
  extractable?: boolean;
}

export interface ReportFormSectionConfig {
  id: string;
  title: string;
  defaultOpen?: boolean;
  subsections?: { title: string; fields: ReportFormFieldConfig[] }[];
  fields?: ReportFormFieldConfig[];
}

export const TENANT_PERSONAL_FIELDS: ReportFormFieldConfig[] = [
  { key: "tenantName", label: "Name" },
  { key: "tenantDesignation", label: "Designation" },
  { key: "tenantNric", label: "NRIC / FIN No." },
  { key: "tenantNationality", label: "Nationality" },
  { key: "tenantAddress", label: "Address", multiline: true },
];

export const TENANT_CONTACT_FIELDS: ReportFormFieldConfig[] = [
  { key: "tenantContactMobile", label: "Contact No. (Mobile)" },
  { key: "tenantContactHome", label: "Contact No. (Home)" },
  { key: "tenantContactOffice", label: "Contact No. (Office)" },
];

export const REPORT_FORM_SECTIONS: ReportFormSectionConfig[] = [
  {
    id: "1",
    title: "1 GENERAL INFORMATION",
    defaultOpen: true,
    fields: [
      { key: "investigatorNameRank", label: "Name / Rank / Appointment" },
      { key: "placeOfAttachment", label: "Place of Attachment for Lead Fire Investigator" },
      { key: "incidentNo", label: "Incident No." },
      { key: "locationOfFire", label: "Location of Fire", extractable: true },
      { key: "dateOfFire", label: "Date of Fire" },
      { key: "timeOfCall", label: "Time of Call" },
      { key: "station", label: "Station" },
      { key: "coverage", label: "Coverage" },
    ],
  },
  {
    id: "2",
    title: "2 INCIDENT INFORMATION",
    defaultOpen: true,
    fields: [
      { key: "fireInvolved", label: "Fire Involved", extractable: true },
      { key: "incidentPhotosRef", label: "Photo/s No. (Annex A and Photos)" },
      { key: "methodOfExtinguishment", label: "Method of Extinguishment", extractable: true, multiline: true },
      { key: "damagesSustained", label: "Damages Sustained", extractable: true },
      { key: "damagesPhotoRef", label: "Damages – Photo/s No." },
      { key: "applianceCallSign", label: "Appliance Call Sign", extractable: true },
      { key: "classification", label: "Classification", extractable: true },
      { key: "handoverOfficer", label: "Handover Officer", extractable: true },
      { key: "handoverNpc", label: "Handover NPC", extractable: true },
    ],
  },
  {
    id: "3",
    title: "3 PARTICULARS ON TENANT OF THE AFFECTED PREMISES/ENTITY",
    fields: [...TENANT_PERSONAL_FIELDS, ...TENANT_CONTACT_FIELDS],
  },
  {
    id: "4",
    title: "4 INSURANCE COVERAGE",
    fields: [
      { key: "insuranceInsured", label: "Is the affected premises/entity insured? (Yes/No)" },
      { key: "insuranceSum", label: "If yes, sum insured (S$)" },
      { key: "insuranceNotes", label: "Insurance notes", multiline: true },
    ],
  },
  {
    id: "5",
    title: "5 INVESTIGATION & FINDINGS",
    subsections: [
      {
        title: "A Probable Cause of Fire",
        fields: [
          { key: "probableCause", label: "Probable Cause of Fire", extractable: true, multiline: true },
          { key: "ignitionSource", label: "The Ignition Source", extractable: true },
          { key: "ignitionFuel", label: "The Ignition Fuel/s", extractable: true },
          { key: "eventsCircumstances", label: "Events/circumstances leading to the incident", extractable: true, multiline: true },
        ],
      },
      {
        title: "B Area/Point of Fire Origin",
        fields: [
          { key: "areaOfFireOrigin", label: "Area of Fire Origin", extractable: true, multiline: true },
          { key: "areaOfOriginPhotoRef", label: "Photo/s No." },
        ],
      },
      {
        title: "C Burn Pattern/s",
        fields: [
          { key: "burnPatterns", label: "Type of Burn Pattern/s Observed", multiline: true },
          { key: "burnPatternsPhotoRef", label: "Photo/s No." },
        ],
      },
      {
        title: "D Evidentiary Factors",
        fields: [
          { key: "evidentiaryFactors", label: "Type of evidence found at the scene", multiline: true },
          { key: "evidentiaryPhotoRef", label: "Photo/s No." },
        ],
      },
    ],
  },
  {
    id: "6",
    title: "6 INFORMATION ON INJURY",
    fields: [
      { key: "injuryName", label: "Name of the person injured" },
      { key: "injuryPin", label: "PIN/FIN" },
      { key: "injuryAddress", label: "Address" },
      { key: "injuryType", label: "Type of Injury sustained" },
    ],
  },
  {
    id: "7",
    title: "7 OTHER INFORMATION",
    fields: [
      { key: "otherInformation", label: "Other Information", multiline: true },
    ],
  },
  {
    id: "8",
    title: "8 ATTACHMENTS",
    fields: [
      { key: "annexLayoutPlan", label: "Annex A – Location Plan (label)" },
      { key: "annexPhotographs", label: "Annex B – Site Plan (label)" },
    ],
  },
  {
    id: "9",
    title: "9 SIGN-OFF",
    fields: [
      { key: "preparedBy", label: "Report Prepared by" },
      { key: "vettedBy", label: "Report Vetted and Approved by" },
      { key: "approvedBy", label: "Approved by (Commander)" },
      { key: "acceptedBy", label: "Report Accepted by (FIU)" },
      { key: "reportDate", label: "Date" },
    ],
  },
];

export const PRR_FORM_SECTIONS: ReportFormSectionConfig[] = [
  {
    id: "1",
    title: "GENERAL INFORMATION",
    defaultOpen: true,
    fields: [
      { key: "incidentNo", label: "Incident No." },
      { key: "locationOfFire", label: "Location of Fire", extractable: true },
      { key: "dateOfFire", label: "Date of Fire" },
      { key: "timeOfCall", label: "Time of Call" },
      { key: "station", label: "Station" },
      { key: "coverage", label: "Coverage" },
    ],
  },
  {
    id: "2",
    title: "INCIDENT INFORMATION",
    fields: [
      { key: "fireInvolved", label: "Fire Involved", extractable: true },
      { key: "methodOfExtinguishment", label: "Method of Extinguishment", extractable: true, multiline: true },
      { key: "damagesSustained", label: "Damages Sustained", extractable: true },
      { key: "probableCause", label: "Probable Cause of Fire", extractable: true, multiline: true },
    ],
  },
  {
    id: "6",
    title: "INFORMATION ON INJURY",
    fields: [
      { key: "injuryName", label: "Name of the person injured" },
      { key: "injuryPin", label: "PIN/FIN" },
      { key: "injuryType", label: "Type of Injury sustained" },
    ],
  },
  {
    id: "9",
    title: "SIGN-OFF",
    fields: [
      { key: "preparedBy", label: "Report Prepared by" },
    ],
  },
];

export function getDefaultOpenSections(): string[] {
  return [];
}

export function getAllSectionFields(section: ReportFormSectionConfig): ReportFormFieldConfig[] {
  if (section.fields) return section.fields;
  return section.subsections?.flatMap((sub) => sub.fields) ?? [];
}
