import type { IncidentCategory } from "./incidentTemplates";

export interface DemoScenario {
  id: string;
  label: string;
  incidentTypeId: string;
  stopMessage: string;
  fieldNotes: string;
  /** Demo-only premises lookup for activation slides (7 Gul Ave). */
  premisesOwner?: string;
  premisesUen?: string;
  /** Show fire investigation report in generate section (demo-only override). */
  requiresFireReport?: boolean;
}

export const FIRE_MOD_RUBBISH_DEMO_SCENARIO: DemoScenario = {
  id: "fire-mod-rubbish",
  label: "Fire (Moderate) — Rubbish Chute — demo",
  incidentTypeId: "fire-moderate-rubbish",
  stopMessage:
    "FIRE MOD C2 ACCIDENTAL, RUBBISH CHUTE:\nStop at location case of fire mod. Upon arrival, white smoke seen in the lift shaft. Upon investigation, Fire found in CRC of block 856 involving rubbish contents. CD extinguished fire using 1x hosereel. Case classified as c2 accidental due to naked light. Case handed over to ASP John Tan from Nanyang NPC",
  fieldNotes: "",
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
