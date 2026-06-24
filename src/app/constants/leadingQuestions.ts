export interface LeadingQuestion {
  id: string;
  section: string;
  prompt: string;
  hint?: string;
}

import {
  AMD_LEADING_QUESTIONS,
  AMD_LEADING_QUESTIONS_TITLE,
} from "./amdLeadingQuestions";
import {
  LPG_FIRE_LEADING_QUESTIONS,
  LPG_FIRE_LEADING_QUESTIONS_TITLE,
} from "./lpgFireLeadingQuestions";
import {
  VEHICLE_FIRE_LEADING_QUESTIONS,
  VEHICLE_FIRE_LEADING_QUESTIONS_TITLE,
} from "./vehicleFireLeadingQuestions";

export const LEADING_QUESTION_SETS = [
  {
    id: "amd",
    label: "Show AMD / PMD leading questions",
    title: AMD_LEADING_QUESTIONS_TITLE,
    questions: AMD_LEADING_QUESTIONS,
  },
  {
    id: "vehicle-fire",
    label: "Show vehicle fire leading questions",
    title: VEHICLE_FIRE_LEADING_QUESTIONS_TITLE,
    questions: VEHICLE_FIRE_LEADING_QUESTIONS,
  },
  {
    id: "lpg-town-gas",
    label: "Show LPG / Town Gas leading questions",
    title: LPG_FIRE_LEADING_QUESTIONS_TITLE,
    questions: LPG_FIRE_LEADING_QUESTIONS,
  },
] as const;

export function toEnglishQuestionInput(question: LeadingQuestion) {
  return {
    id: question.id,
    prompt: question.prompt,
    hint: question.hint,
    section: question.section,
  };
}

export function groupLeadingQuestionsBySection(
  questions: LeadingQuestion[]
): { section: string; questions: LeadingQuestion[] }[] {
  const sections: string[] = [];
  const grouped = new Map<string, LeadingQuestion[]>();

  for (const question of questions) {
    if (!grouped.has(question.section)) {
      grouped.set(question.section, []);
      sections.push(question.section);
    }
    grouped.get(question.section)!.push(question);
  }

  return sections.map((section) => ({
    section,
    questions: grouped.get(section)!,
  }));
}
