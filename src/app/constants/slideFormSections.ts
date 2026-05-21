import type { ActivationSlideFieldKey } from "../types/activationSlides";

export type SlideFieldInputType = "text" | "date" | "time" | "textarea";

export interface SlideFormFieldConfig {
  key: ActivationSlideFieldKey;
  label: string;
  extractable?: boolean;
  inputType?: SlideFieldInputType;
  placeholder?: string;
  colSpan?: 1 | 2;
}

export interface SlideFormSection {
  id: string;
  title: string;
  description: string;
  fields: SlideFormFieldConfig[];
}

export const SLIDE_FORM_SECTIONS: SlideFormSection[] = [
  {
    id: "general",
    title: "General Information",
    description: "Enter operational details",
    fields: [
      { key: "station", label: "Station", extractable: true, placeholder: "e.g., 11" },
      { key: "rota", label: "Rota", extractable: true, placeholder: "e.g., 1" },
      { key: "dutyDate", label: "Duty Date", inputType: "date" },
      {
        key: "callSign",
        label: "Appliance (call sign)",
        extractable: true,
        placeholder: "e.g., PL411E",
      },
      { key: "sc", label: "Rank / Name — Inspecting Officer (1)", placeholder: "e.g., SGT(2) Tan A" },
      { key: "po", label: "Rank / Name — Inspecting Officer (2)", placeholder: "e.g., SGT(3) Muhammed B" },
    ],
  },
  {
    id: "incident",
    title: "Incident Details",
    description: "Fill in incident-specific information",
    fields: [
      {
        key: "incidentNo",
        label: "Case ID",
        placeholder: "e.g., 20260520XXXX",
      },
      { key: "dateDispatched", label: "Date Dispatched", inputType: "date" },
      { key: "timeDispatched", label: "Time Dispatched", inputType: "time" },
      { key: "timeArrived", label: "Time Arrived", inputType: "time" },
      {
        key: "incidentLocation",
        label: "Address",
        extractable: true,
        placeholder: "e.g., 123 Teck Street",
        colSpan: 2,
      },
      {
        key: "premisesOwner",
        label: "Premises Own By",
        extractable: true,
        placeholder: "e.g., Unity Pte. Ltd.",
      },
      {
        key: "premisesUen",
        label: "Premises' UEN",
        extractable: true,
        placeholder: "e.g., T09LL0001B",
      },
    ],
  },
  {
    id: "accompanying",
    title: "Accompanying Person Information",
    description: "Details of accompanying personnel",
    fields: [
      {
        key: "accompanyingPerson",
        label: "Accompanying Person",
        extractable: true,
        placeholder: "e.g., Mr. Devan, Safety Officer",
      },
      {
        key: "accompanyingContact",
        label: "Contact Number",
        extractable: true,
        placeholder: "e.g., 92345678",
      },
    ],
  },
  {
    id: "classification",
    title: "Classification & Handover",
    description: "Incident classification and case details",
    fields: [
      {
        key: "classification",
        label: "Classification",
        extractable: true,
        placeholder: "e.g., False alarm malfunction of detector at lift lobby",
        colSpan: 2,
      },
      {
        key: "handedOver",
        label: "Case handed over to / liaison with",
        extractable: true,
        placeholder: "e.g., SGT T123456 (Boon Lay NPC)",
        colSpan: 2,
      },
      {
        key: "otherRemarks",
        label: "Other Remarks",
        extractable: true,
        inputType: "textarea",
        placeholder: "Enter other remarks here",
        colSpan: 2,
      },
    ],
  },
];

export const SLIDE_EXTRACTABLE_KEYS: ActivationSlideFieldKey[] = [
  "station",
  "rota",
  "callSign",
  "incidentLocation",
  "premisesOwner",
  "premisesUen",
  "accompanyingPerson",
  "accompanyingContact",
  "classification",
  "handedOver",
  "otherRemarks",
];

export function getDefaultOpenSlideSections(): string[] {
  return ["general", "incident"];
}
