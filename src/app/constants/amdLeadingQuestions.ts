import type { LeadingQuestion } from "./leadingQuestions";
import { loc } from "./leadingQuestions";

export const AMD_LEADING_QUESTIONS_TITLE = "AMD / PMD / PAB / PMA — Leading questions";

export const AMD_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "device-type",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("What type of mobility device is it?", "[MS] What type of mobility device is it?", "[TA] What type of mobility device is it?", "[ZH] What type of mobility device is it?"),
    hint: loc("e.g. PMD, PAB, PMA", "[MS] e.g. PMD, PAB, PMA", "[TA] e.g. PMD, PAB, PMA", "[ZH] e.g. PMD, PAB, PMA"),
  },
  {
    id: "device-model",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("What is the device's model?", "[MS] What is the device's model?", "[TA] What is the device's model?", "[ZH] What is the device's model?"),
  },
  {
    id: "battery-type",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("What type of battery does the device use?", "[MS] What type of battery does the device use?", "[TA] What type of battery does the device use?", "[ZH] What type of battery does the device use?"),
    hint: loc("e.g. lithium-ion (Li-ion), lead acid", "[MS] e.g. lithium-ion (Li-ion), lead acid", "[TA] e.g. lithium-ion (Li-ion), lead acid", "[ZH] e.g. lithium-ion (Li-ion), lead acid"),
  },
  {
    id: "battery-brand",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("What is the battery's brand?", "[MS] What is the battery's brand?", "[TA] What is the battery's brand?", "[ZH] What is the battery's brand?"),
  },
  {
    id: "battery-model",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("What is the battery's model?", "[MS] What is the battery's model?", "[TA] What is the battery's model?", "[ZH] What is the battery's model?"),
  },
  {
    id: "battery-oem",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("Was the battery provided by the Original Equipment Manufacturer (OEM)?", "[MS] Was the battery provided by the Original Equipment Manufacturer (OEM)?", "[TA] Was the battery provided by the Original Equipment Manufacturer (OEM)?", "[ZH] Was the battery provided by the Original Equipment Manufacturer (OEM)?"),
  },
  {
    id: "modifications",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("Have any modifications been made to the device?", "[MS] Have any modifications been made to the device?", "[TA] Have any modifications been made to the device?", "[ZH] Have any modifications been made to the device?"),
  },
  {
    id: "main-use",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("What is the main use of the device?", "[MS] What is the main use of the device?", "[TA] What is the main use of the device?", "[ZH] What is the main use of the device?"),
  },
  {
    id: "last-used-date",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("When was the device last used?", "[MS] When was the device last used?", "[TA] When was the device last used?", "[ZH] When was the device last used?"),
  },
  {
    id: "last-used-duration",
    section: loc("Affected device", "[MS] Affected device", "[TA] Affected device", "[ZH] Affected device"),
    prompt: loc("How long was the device used for before the incident?", "[MS] How long was the device used for before the incident?", "[TA] How long was the device used for before the incident?", "[ZH] How long was the device used for before the incident?"),
    hint: loc("e.g. 2 hours", "[MS] e.g. 2 hours", "[TA] e.g. 2 hours", "[ZH] e.g. 2 hours"),
  },
  {
    id: "purchase-date",
    section: loc("Purchase history", "[MS] Purchase history", "[TA] Purchase history", "[ZH] Purchase history"),
    prompt: loc("When was the device purchased?", "[MS] When was the device purchased?", "[TA] When was the device purchased?", "[ZH] When was the device purchased?"),
    hint: loc("e.g. 6 months ago, 18/02/2022, cannot be determined", "[MS] e.g. 6 months ago, 18/02/2022, cannot be determined", "[TA] e.g. 6 months ago, 18/02/2022, cannot be determined", "[ZH] e.g. 6 months ago, 18/02/2022, cannot be determined"),
  },
  {
    id: "purchase-type",
    section: loc("Purchase history", "[MS] Purchase history", "[TA] Purchase history", "[ZH] Purchase history"),
    prompt: loc("What was the purchase type?", "[MS] What was the purchase type?", "[TA] What was the purchase type?", "[ZH] What was the purchase type?"),
  },
  {
    id: "purchase-location",
    section: loc("Purchase history", "[MS] Purchase history", "[TA] Purchase history", "[ZH] Purchase history"),
    prompt: loc("Where was the device purchased from?", "[MS] Where was the device purchased from?", "[TA] Where was the device purchased from?", "[ZH] Where was the device purchased from?"),
  },
  {
    id: "purchase-shop",
    section: loc("Purchase history", "[MS] Purchase history", "[TA] Purchase history", "[ZH] Purchase history"),
    prompt: loc("What is the name of the retail shop or online platform?", "[MS] What is the name of the retail shop or online platform?", "[TA] What is the name of the retail shop or online platform?", "[ZH] What is the name of the retail shop or online platform?"),
  },
  {
    id: "replacement-battery",
    section: loc("Replacement / add-on battery", "[MS] Replacement / add-on battery", "[TA] Replacement / add-on battery", "[ZH] Replacement / add-on battery"),
    prompt: loc("Have you purchased a replacement or add-on battery before?", "[MS] Have you purchased a replacement or add-on battery before?", "[TA] Have you purchased a replacement or add-on battery before?", "[ZH] Have you purchased a replacement or add-on battery before?"),
    hint: loc("If yes, ask for details", "[MS] If yes, ask for details", "[TA] If yes, ask for details", "[ZH] If yes, ask for details"),
  },
  {
    id: "safety-mark-plug",
    section: loc("Battery charger", "[MS] Battery charger", "[TA] Battery charger", "[ZH] Battery charger"),
    prompt: loc("Does the battery charger plug have the Safety Mark logo?", "[MS] Does the battery charger plug have the Safety Mark logo?", "[TA] Does the battery charger plug have the Safety Mark logo?", "[ZH] Does the battery charger plug have the Safety Mark logo?"),
  },
  {
    id: "safety-mark-adapter",
    section: loc("Battery charger", "[MS] Battery charger", "[TA] Battery charger", "[ZH] Battery charger"),
    prompt: loc("Does the power adapter of the battery charger have the Safety Mark logo?", "[MS] Does the power adapter of the battery charger have the Safety Mark logo?", "[TA] Does the power adapter of the battery charger have the Safety Mark logo?", "[ZH] Does the power adapter of the battery charger have the Safety Mark logo?"),
  },
  {
    id: "last-charge-date",
    section: loc("Battery charger", "[MS] Battery charger", "[TA] Battery charger", "[ZH] Battery charger"),
    prompt: loc("When was the battery last charged?", "[MS] When was the battery last charged?", "[TA] When was the battery last charged?", "[ZH] When was the battery last charged?"),
  },
  {
    id: "last-charge-time",
    section: loc("Battery charger", "[MS] Battery charger", "[TA] Battery charger", "[ZH] Battery charger"),
    prompt: loc("What time was the battery last charged?", "[MS] What time was the battery last charged?", "[TA] What time was the battery last charged?", "[ZH] What time was the battery last charged?"),
    hint: loc("e.g. 2350hrs", "[MS] e.g. 2350hrs", "[TA] e.g. 2350hrs", "[ZH] e.g. 2350hrs"),
  },
  {
    id: "last-charge-duration",
    section: loc("Battery charger", "[MS] Battery charger", "[TA] Battery charger", "[ZH] Battery charger"),
    prompt: loc("How long was the battery charged for?", "[MS] How long was the battery charged for?", "[TA] How long was the battery charged for?", "[ZH] How long was the battery charged for?"),
    hint: loc("e.g. 6 hours", "[MS] e.g. 6 hours", "[TA] e.g. 6 hours", "[ZH] e.g. 6 hours"),
  },
  {
    id: "fire-location",
    section: loc("Events leading to fire", "[MS] Events leading to fire", "[TA] Events leading to fire", "[ZH] Events leading to fire"),
    prompt: loc("Where did the fire occur?", "[MS] Where did the fire occur?", "[TA] Where did the fire occur?", "[ZH] Where did the fire occur?"),
  },
  {
    id: "fire-spread",
    section: loc("Events leading to fire", "[MS] Events leading to fire", "[TA] Events leading to fire", "[ZH] Events leading to fire"),
    prompt: loc("Did the fire spread beyond the device?", "[MS] Did the fire spread beyond the device?", "[TA] Did the fire spread beyond the device?", "[ZH] Did the fire spread beyond the device?"),
  },
  {
    id: "device-status",
    section: loc("Events leading to fire", "[MS] Events leading to fire", "[TA] Events leading to fire", "[ZH] Events leading to fire"),
    prompt: loc("What was the status of the device prior to the fire?", "[MS] What was the status of the device prior to the fire?", "[TA] What was the status of the device prior to the fire?", "[ZH] What was the status of the device prior to the fire?"),
  },
  {
    id: "other-information",
    section: loc("Events leading to fire", "[MS] Events leading to fire", "[TA] Events leading to fire", "[ZH] Events leading to fire"),
    prompt: loc("Is there any other relevant information?", "[MS] Is there any other relevant information?", "[TA] Is there any other relevant information?", "[ZH] Is there any other relevant information?"),
  },
];
