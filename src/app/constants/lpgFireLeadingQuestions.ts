import type { LeadingQuestion } from "./leadingQuestions";
import { loc } from "./leadingQuestions";

export const LPG_FIRE_LEADING_QUESTIONS_TITLE = "LPG / Town Gas — Leading questions";

export const LPG_FIRE_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "stove-fuel",
    section: loc("Stove & fuel", "[MS] Stove & fuel", "[TA] Stove & fuel", "[ZH] Stove & fuel"),
    prompt: loc("What is the stove fueled by?", "[MS] What is the stove fueled by?", "[TA] What is the stove fueled by?", "[ZH] What is the stove fueled by?"),
    hint: loc("e.g. LPG, Town Gas", "[MS] e.g. LPG, Town Gas", "[TA] e.g. LPG, Town Gas", "[ZH] e.g. LPG, Town Gas"),
  },
  {
    id: "last-used",
    section: loc("Stove usage", "[MS] Stove usage", "[TA] Stove usage", "[ZH] Stove usage"),
    prompt: loc("When was the stove last used before the fire?", "[MS] When was the stove last used before the fire?", "[TA] When was the stove last used before the fire?", "[ZH] When was the stove last used before the fire?"),
    hint: loc("e.g. 25/12/2022 at 1230H", "[MS] e.g. 25/12/2022 at 1230H", "[TA] e.g. 25/12/2022 at 1230H", "[ZH] e.g. 25/12/2022 at 1230H"),
  },
  {
    id: "lighting-method",
    section: loc("Stove usage", "[MS] Stove usage", "[TA] Stove usage", "[ZH] Stove usage"),
    prompt: loc("What was used to light up the stove?", "[MS] What was used to light up the stove?", "[TA] What was used to light up the stove?", "[ZH] What was used to light up the stove?"),
  },
  {
    id: "elbow-joint",
    section: loc("Stove usage", "[MS] Stove usage", "[TA] Stove usage", "[ZH] Stove usage"),
    prompt: loc("Was there an elbow joint at the stove?", "[MS] Was there an elbow joint at the stove?", "[TA] Was there an elbow joint at the stove?", "[ZH] Was there an elbow joint at the stove?"),
  },
  {
    id: "ventilation",
    section: loc("Stove usage", "[MS] Stove usage", "[TA] Stove usage", "[ZH] Stove usage"),
    prompt: loc("Was the stove area well-ventilated?", "[MS] Was the stove area well-ventilated?", "[TA] Was the stove area well-ventilated?", "[ZH] Was the stove area well-ventilated?"),
  },
  {
    id: "multiple-attempts",
    section: loc("Stove usage", "[MS] Stove usage", "[TA] Stove usage", "[ZH] Stove usage"),
    prompt: loc("Were there multiple attempts to light up the stove?", "[MS] Were there multiple attempts to light up the stove?", "[TA] Were there multiple attempts to light up the stove?", "[ZH] Were there multiple attempts to light up the stove?"),
    hint: loc("e.g. 2 or more in total", "[MS] e.g. 2 or more in total", "[TA] e.g. 2 or more in total", "[ZH] e.g. 2 or more in total"),
  },
  {
    id: "abnormalities",
    section: loc("Before the fire", "[MS] Before the fire", "[TA] Before the fire", "[ZH] Before the fire"),
    prompt: loc("Were there any abnormalities of the gas and stove system observed before the fire?", "[MS] Were there any abnormalities of the gas and stove system observed before the fire?", "[TA] Were there any abnormalities of the gas and stove system observed before the fire?", "[ZH] Were there any abnormalities of the gas and stove system observed before the fire?"),
    hint: loc("e.g. hissing sounds, gas smell, larger fire size than normal", "[MS] e.g. hissing sounds, gas smell, larger fire size than normal", "[TA] e.g. hissing sounds, gas smell, larger fire size than normal", "[ZH] e.g. hissing sounds, gas smell, larger fire size than normal"),
  },
  {
    id: "tampering",
    section: loc("Before the fire", "[MS] Before the fire", "[TA] Before the fire", "[ZH] Before the fire"),
    prompt: loc("Were the gas and/or stove system(s) tampered with before the arrival of SCDF?", "[MS] Were the gas and/or stove system(s) tampered with before the arrival of SCDF?", "[TA] Were the gas and/or stove system(s) tampered with before the arrival of SCDF?", "[ZH] Were the gas and/or stove system(s) tampered with before the arrival of SCDF?"),
    hint: loc("e.g. gas system was disassembled or modified", "[MS] e.g. gas system was disassembled or modified", "[TA] e.g. gas system was disassembled or modified", "[ZH] e.g. gas system was disassembled or modified"),
  },
  {
    id: "faulty-equipment",
    section: loc("Findings", "[MS] Findings", "[TA] Findings", "[ZH] Findings"),
    prompt: loc("Any faulty equipment?", "[MS] Any faulty equipment?", "[TA] Any faulty equipment?", "[ZH] Any faulty equipment?"),
    hint: loc("e.g. stove, regulator, hose", "[MS] e.g. stove, regulator, hose", "[TA] e.g. stove, regulator, hose", "[ZH] e.g. stove, regulator, hose"),
  },
  {
    id: "other-information",
    section: loc("Findings", "[MS] Findings", "[TA] Findings", "[ZH] Findings"),
    prompt: loc("Is there any other relevant information?", "[MS] Is there any other relevant information?", "[TA] Is there any other relevant information?", "[ZH] Is there any other relevant information?"),
  },
];
