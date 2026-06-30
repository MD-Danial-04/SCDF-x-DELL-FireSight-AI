import type { IncidentCategory } from "./incidentTemplates";
import type { LeadingQuestion } from "./leadingQuestions/types";
import { loc } from "./leadingQuestions/types";

export interface DemoGuidedInterview {
  title: string;
  questions: LeadingQuestion[];
  fixedAnswers: string[];
}

export interface DemoScenario {
  id: string;
  label: string;
  incidentTypeId: string;
  stopMessage: string;
  fieldNotes: string;
  /** When true, stop message appears only after simulated recording. */
  recordFirst?: boolean;
  /** Demo-only premises lookup for activation slides (7 Gul Ave). */
  premisesOwner?: string;
  premisesUen?: string;
  /** Show fire investigation report in generate section (demo-only override). */
  requiresFireReport?: boolean;
  /** Pre-seeded guided interview with fixed answers (no inference). */
  guidedInterview?: DemoGuidedInterview;
}

const FIRE_WITNESS_DEMO_QUESTIONS: LeadingQuestion[] = [
  {
    id: "witness-what-saw",
    section: loc("Witness account", "Keterangan saksi", "சாட்சியாளர்", "目击者陈述"),
    prompt: loc(
      "What did you see when you noticed the fire?",
      "Apa yang anda lihat apabila anda perasan kebakaran?",
      "What did you see when you noticed the fire?",
      "What did you see when you noticed the fire?"
    ),
  },
  {
    id: "witness-when-doing",
    section: loc("Witness account", "Keterangan saksi", "சாட்சியாளர்", "目击者陈述"),
    prompt: loc(
      "When did you first notice the fire and what were you doing at the time?",
      "Bilakah anda mula-mula perasan kebakaran dan apa yang anda lakukan pada masa itu?",
      "When did you first notice the fire and what were you doing at the time?",
      "When did you first notice the fire and what were you doing at the time?"
    ),
  },
  {
    id: "witness-anyone-nearby",
    section: loc("Witness account", "Keterangan saksi", "சாட்சியாளர்", "目击者陈述"),
    prompt: loc(
      "Did you see anyone near the rubbish bin before the fire started?",
      "Adakah anda nampak sesiapa berhampiran tong sampah sebelum kebakaran bermula?",
      "Did you see anyone near the rubbish bin before the fire started?",
      "Did you see anyone near the rubbish bin before the fire started?"
    ),
  },
];

export const FIRE_MOD_RUBBISH_DEMO_SCENARIO: DemoScenario = {
  id: "fire-mod-rubbish",
  label: "Fire (Moderate) — Rubbish Chute — demo",
  incidentTypeId: "fire-moderate-rubbish",
  stopMessage:
    "PL221 Stop for 7 Ubi Avenue case of fire minor. Fire involved discarded items inside a rubbish bin. Scdf extinguished fire using 1x hosereel, no damages as a result from the fire. Case classified as c2 accidental due to drop light. Case handed over to SSS MICHAEL T03438 jurong west npc",
  fieldNotes: "",
  recordFirst: true,
  guidedInterview: {
    title: "Fire witness — Leading questions",
    questions: FIRE_WITNESS_DEMO_QUESTIONS,
    fixedAnswers: [
      "I saw smoke coming from the rubbish bin near the loading bay. There were small flames inside the bin.",
      "Around 2pm. I was walking back from lunch when I smelled something burning.",
      "No, I didn't see anyone nearby. The area was quiet when I passed by.",
    ],
  },
};

export const FAM_DEMO_SCENARIO: DemoScenario = {
  id: "fam",
  label: "False Alarm Malfunction (FAM)",
  incidentTypeId: "false-alarm-malfunction",
  stopMessage:
    "LF812 prepare for stop message. LF812 stop for location at 7 Gul Ave. Case classified as False alarm malfunction of manual Call point, at zone 7. Upon investigation No smoke no fire. Liase w Mr zaini, saferty officer. Case handed over to S3 alsyraf waT190350 from Nanyang NPC",
  fieldNotes: `T241253 J5R Nanyang NPC , S3 alsyraf, 190350
91686941 , saleem, petroling officer , prosegur
Zaini, 91472832,, safety officer`,
  recordFirst: true,
  premisesOwner: "Unity Pte. Ltd.",
  premisesUen: "T09LL0001B",
  requiresFireReport: true,
};

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  "fire-mod-rubbish": FIRE_MOD_RUBBISH_DEMO_SCENARIO,
  fam: FAM_DEMO_SCENARIO,
};

/** Select value for demo rows (prefix demo-). */
export const DEMO_SELECT_OPTIONS: {
  selectId: string;
  scenario: DemoScenario;
  category: IncidentCategory;
}[] = [
  { selectId: "demo-fire-mod-rubbish", scenario: FIRE_MOD_RUBBISH_DEMO_SCENARIO, category: "fire" },
  { selectId: "demo-fam", scenario: FAM_DEMO_SCENARIO, category: "false-alarm" },
];

export function isDemoSelectId(value: string): boolean {
  return value.startsWith("demo-");
}

export function getDemoScenarioBySelectId(selectId: string): DemoScenario | undefined {
  if (!isDemoSelectId(selectId)) return undefined;
  return DEMO_SCENARIOS[selectId.slice("demo-".length)];
}

export function getDemoScenarioById(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS[id];
}

export function buildDemoGuidedInterviewMode(
  scenario: DemoScenario
): { questions: LeadingQuestion[]; title: string; demoMode: { fixedAnswers: Record<string, { original: string; english: string }> } } | undefined {
  const guided = scenario.guidedInterview;
  if (!guided || guided.questions.length === 0) return undefined;

  const fixedAnswers: Record<string, { original: string; english: string }> = {};
  guided.questions.forEach((question, index) => {
    const answer = guided.fixedAnswers[index]?.trim() ?? "";
    if (!answer) return;
    fixedAnswers[question.id] = { original: answer, english: answer };
  });

  return {
    questions: guided.questions,
    title: guided.title,
    demoMode: { fixedAnswers },
  };
}
