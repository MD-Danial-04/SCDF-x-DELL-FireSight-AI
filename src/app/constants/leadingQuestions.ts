import type { InterviewLanguage } from "../types/interviewee";

export type LocalizedText = Record<InterviewLanguage, string>;

export interface LeadingQuestion {
  id: string;
  section: LocalizedText;
  prompt: LocalizedText;
  hint?: LocalizedText;
}

export interface EnglishQuestionInput {
  id: string;
  prompt: string;
  hint?: string;
  section?: string;
}

export function loc(en: string, ms: string, ta: string, zh: string): LocalizedText {
  return { en, ms, ta, zh };
}

export function getLocalizedText(
  text: LocalizedText,
  lang: InterviewLanguage
): string {
  return text[lang];
}

export function toEnglishQuestionInput(q: LeadingQuestion): EnglishQuestionInput {
  return {
    id: q.id,
    prompt: q.prompt.en,
    hint: q.hint?.en,
    section: q.section.en,
  };
}

export function groupLeadingQuestionsBySection(
  questions: LeadingQuestion[]
): { section: LocalizedText; questions: LeadingQuestion[] }[] {
  const sections: string[] = [];
  const grouped = new Map<string, LeadingQuestion[]>();

  for (const question of questions) {
    const sectionKey = question.section.en;
    if (!grouped.has(sectionKey)) {
      grouped.set(sectionKey, []);
      sections.push(sectionKey);
    }
    grouped.get(sectionKey)!.push(question);
  }

  return sections.map((sectionKey) => ({
    section: grouped.get(sectionKey)![0].section,
    questions: grouped.get(sectionKey)!,
  }));
}
