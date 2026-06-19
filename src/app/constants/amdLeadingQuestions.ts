import type { LeadingQuestion } from "./leadingQuestions";

export const AMD_LEADING_QUESTIONS_TITLE =
  "AMD / PMD / PAB / PMA — Leading questions";

export const AMD_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "device-type",
    section: "Affected device",
    prompt: "What type of mobility device is it?",
    hint: "e.g. PMD, PAB, PMA",
  },
  {
    id: "device-model",
    section: "Affected device",
    prompt: "What is the device's model?",
  },
  {
    id: "battery-type",
    section: "Affected device",
    prompt: "What type of battery does the device use?",
    hint: "e.g. lithium-ion (Li-ion), lead acid",
  },
  {
    id: "battery-brand",
    section: "Affected device",
    prompt: "What is the battery's brand?",
  },
  {
    id: "battery-model",
    section: "Affected device",
    prompt: "What is the battery's model?",
  },
  {
    id: "battery-oem",
    section: "Affected device",
    prompt: "Was the battery provided by the Original Equipment Manufacturer (OEM)?",
  },
  {
    id: "modifications",
    section: "Affected device",
    prompt: "Have any modifications been made to the device?",
  },
  {
    id: "main-use",
    section: "Affected device",
    prompt: "What is the main use of the device?",
  },
  {
    id: "last-used-date",
    section: "Affected device",
    prompt: "When was the device last used?",
  },
  {
    id: "last-used-duration",
    section: "Affected device",
    prompt: "How long was the device used for before the incident?",
    hint: "e.g. 2 hours",
  },
  {
    id: "purchase-date",
    section: "Purchase history",
    prompt: "When was the device purchased?",
    hint: "e.g. 6 months ago, 18/02/2022, cannot be determined",
  },
  {
    id: "purchase-type",
    section: "Purchase history",
    prompt: "What was the purchase type?",
  },
  {
    id: "purchase-location",
    section: "Purchase history",
    prompt: "Where was the device purchased from?",
  },
  {
    id: "purchase-shop",
    section: "Purchase history",
    prompt: "What is the name of the retail shop or online platform?",
  },
  {
    id: "replacement-battery",
    section: "Replacement / add-on battery",
    prompt: "Have you purchased a replacement or add-on battery before?",
    hint: "If yes, ask for details",
  },
  {
    id: "safety-mark-plug",
    section: "Battery charger",
    prompt: "Does the battery charger plug have the Safety Mark logo?",
  },
  {
    id: "safety-mark-adapter",
    section: "Battery charger",
    prompt: "Does the power adapter of the battery charger have the Safety Mark logo?",
  },
  {
    id: "last-charge-date",
    section: "Battery charger",
    prompt: "When was the battery last charged?",
  },
  {
    id: "last-charge-time",
    section: "Battery charger",
    prompt: "What time was the battery last charged?",
    hint: "e.g. 2350hrs",
  },
  {
    id: "last-charge-duration",
    section: "Battery charger",
    prompt: "How long was the battery charged for?",
    hint: "e.g. 6 hours",
  },
  {
    id: "fire-location",
    section: "Events leading to fire",
    prompt: "Where did the fire occur?",
  },
  {
    id: "fire-spread",
    section: "Events leading to fire",
    prompt: "Did the fire spread beyond the device?",
  },
  {
    id: "device-status",
    section: "Events leading to fire",
    prompt: "What was the status of the device prior to the fire?",
  },
  {
    id: "other-information",
    section: "Events leading to fire",
    prompt: "Is there any other relevant information?",
  },
];
