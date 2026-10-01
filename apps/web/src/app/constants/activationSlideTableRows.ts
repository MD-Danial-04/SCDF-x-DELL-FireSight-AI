import type { ActivationSlideFieldKey } from "../types/activationSlides";

/** One data column or two (e.g. premises + UEN) per SCDF slide template */
export interface ActivationSlideTemplateRow {
  label: string;
  valueKeys: ActivationSlideFieldKey[];
}

/** Slide 1 table — matches Documents/Slide_template.pdf */
export const ACTIVATION_SLIDE_TEMPLATE_ROWS: ActivationSlideTemplateRow[] = [
  { label: "Appliance", valueKeys: ["callSign"] },
  { label: "Rank / Name of Inspecting Officer", valueKeys: ["sc"] },
  { label: "Rank / Name of Inspecting Officer", valueKeys: ["po"] },
  { label: "Date Dispatched", valueKeys: ["dateDispatched"] },
  { label: "Time Dispatched", valueKeys: ["timeDispatched"] },
  { label: "Time Arrived", valueKeys: ["timeArrived"] },
  { label: "Case ID", valueKeys: ["incidentNo"] },
  { label: "Address", valueKeys: ["incidentLocation"] },
  { label: "Premises Own By", valueKeys: ["premisesOwner", "premisesUen"] },
  { label: "Details Accompanying Person", valueKeys: ["accompanyingPerson", "accompanyingContact"] },
  { label: "Classification", valueKeys: ["classification"] },
  { label: "Case handed over to/liasion with", valueKeys: ["handedOver"] },
];

export const SLIDE1_TITLE = "Information";
