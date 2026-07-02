import type { LeadingQuestion } from "../constants/leadingQuestions/types";
import { loc } from "../constants/leadingQuestions/types";

function mirrorEn(text: string): ReturnType<typeof loc> {
  return loc(text, text, text, text);
}

export function buildPmdFollowUpAfterAnswer(
  answers: Record<string, string>,
  lastQuestionId: string
): { question: LeadingQuestion; demoAnswer: string } | null {
  const deviceType = answers["device-type"]?.trim();
  const model = answers["device-model"]?.trim();
  const batteryType = answers["battery-type"]?.trim();

  switch (lastQuestionId) {
    case "device-type": {
      if (!deviceType) return null;
      return {
        question: {
          id: `generated-after-${lastQuestionId}`,
          section: mirrorEn("Affected device"),
          prompt: mirrorEn(
            `You identified it as a ${deviceType}. Was it registered with LTA, and who does it belong to?`
          ),
        },
        demoAnswer: "Registered with LTA under my name",
      };
    }
    case "device-model": {
      if (!model) return null;
      return {
        question: {
          id: `generated-after-${lastQuestionId}`,
          section: mirrorEn("Affected device"),
          prompt: mirrorEn(
            `The ${model} — any aftermarket parts, battery swaps, or modifications?`
          ),
        },
        demoAnswer: "No modifications, original battery from manufacturer",
      };
    }
    case "battery-type": {
      if (!batteryType) return null;
      const type = deviceType || "PMD";
      const modelLabel = model || "device";
      const isLithium = /lithium/i.test(batteryType);
      return {
        question: {
          id: `generated-after-${lastQuestionId}`,
          section: mirrorEn("Events leading to fire"),
          prompt: mirrorEn(
            isLithium
              ? `A ${type} (${modelLabel}) with a ${batteryType} battery was involved. Was it charging when the fire started, and did you notice anything unusual beforehand?`
              : `A ${type} (${modelLabel}) with a ${batteryType} battery was involved. What was the device doing immediately before the fire started?`
          ),
        },
        demoAnswer: isLithium
          ? "Charging overnight in the corridor; I smelled something sweet and saw the battery swelling before smoke appeared"
          : "It was stored in the lift lobby after use",
      };
    }
    default:
      return null;
  }
}
