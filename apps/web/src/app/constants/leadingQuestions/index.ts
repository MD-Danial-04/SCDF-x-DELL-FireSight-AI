import { AMD_LEADING_QUESTIONS, AMD_LEADING_QUESTIONS_TITLE } from "./amd";
import { LPG_FIRE_LEADING_QUESTIONS, LPG_FIRE_LEADING_QUESTIONS_TITLE } from "./lpg";
import {
  VEHICLE_FIRE_LEADING_QUESTIONS,
  VEHICLE_FIRE_LEADING_QUESTIONS_TITLE,
} from "./vehicleFire";

export type {
  EnglishQuestionInput,
  LeadingQuestion,
  LocalizedText,
} from "./types";
export {
  getLocalizedText,
  groupLeadingQuestionsBySection,
  loc,
  toEnglishQuestionInput,
} from "./types";

export {
  AMD_LEADING_QUESTIONS,
  AMD_LEADING_QUESTIONS_TITLE,
} from "./amd";
export {
  LPG_FIRE_LEADING_QUESTIONS,
  LPG_FIRE_LEADING_QUESTIONS_TITLE,
} from "./lpg";
export {
  VEHICLE_FIRE_LEADING_QUESTIONS,
  VEHICLE_FIRE_LEADING_QUESTIONS_TITLE,
} from "./vehicleFire";

export type LeadingQuestionSetId = "amd" | "vehicle-fire" | "lpg-town-gas";

export const LEADING_QUESTION_SETS = [
  {
    id: "amd" as const,
    label: "Show AMD / PMD leading questions",
    title: AMD_LEADING_QUESTIONS_TITLE,
    questions: AMD_LEADING_QUESTIONS,
  },
  {
    id: "vehicle-fire" as const,
    label: "Show vehicle fire leading questions",
    title: VEHICLE_FIRE_LEADING_QUESTIONS_TITLE,
    questions: VEHICLE_FIRE_LEADING_QUESTIONS,
  },
  {
    id: "lpg-town-gas" as const,
    label: "Show LPG / Town Gas leading questions",
    title: LPG_FIRE_LEADING_QUESTIONS_TITLE,
    questions: LPG_FIRE_LEADING_QUESTIONS,
  },
] as const;
