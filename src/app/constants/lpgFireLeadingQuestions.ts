import type { LeadingQuestion } from "./leadingQuestions";

export const LPG_FIRE_LEADING_QUESTIONS_TITLE =
  "LPG / Town Gas — Leading questions";

export const LPG_FIRE_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "stove-fuel",
    section: "Stove & fuel",
    prompt: "What is the stove fueled by?",
    hint: "e.g. LPG, Town Gas",
  },
  {
    id: "last-used",
    section: "Stove usage",
    prompt: "When was the stove last used before the fire?",
    hint: "e.g. 25/12/2022 at 1230H",
  },
  {
    id: "lighting-method",
    section: "Stove usage",
    prompt: "What was used to light up the stove?",
  },
  {
    id: "elbow-joint",
    section: "Stove usage",
    prompt: "Was there an elbow joint at the stove?",
  },
  {
    id: "ventilation",
    section: "Stove usage",
    prompt: "Was the stove area well-ventilated?",
  },
  {
    id: "multiple-attempts",
    section: "Stove usage",
    prompt: "Were there multiple attempts to light up the stove?",
    hint: "e.g. 2 or more in total",
  },
  {
    id: "abnormalities",
    section: "Before the fire",
    prompt:
      "Were there any abnormalities of the gas and stove system observed before the fire?",
    hint: "e.g. hissing sounds, gas smell, larger fire size than normal",
  },
  {
    id: "tampering",
    section: "Before the fire",
    prompt:
      "Were the gas and/or stove system(s) tampered with before the arrival of SCDF?",
    hint: "e.g. gas system was disassembled or modified",
  },
  {
    id: "faulty-equipment",
    section: "Findings",
    prompt: "Any faulty equipment?",
    hint: "e.g. stove, regulator, hose",
  },
  {
    id: "other-information",
    section: "Findings",
    prompt: "Is there any other relevant information?",
  },
];
