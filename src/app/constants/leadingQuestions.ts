export interface LeadingQuestion {
  id: string;
  section: string;
  prompt: string;
  hint?: string;
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
