import { describe, expect, it } from "vitest";
import { createEmptyInterviewee } from "../../types/interviewee";
import { getWitnessTabLabel } from "../getWitnessTabLabel";

describe("getWitnessTabLabel", () => {
  it("returns numbered label when name is empty", () => {
    const interviewee = createEmptyInterviewee();
    expect(getWitnessTabLabel(interviewee, 0)).toBe("Witness 1");
    expect(getWitnessTabLabel(interviewee, 2)).toBe("Witness 3");
  });

  it("includes name when filled", () => {
    const interviewee = createEmptyInterviewee();
    interviewee.name = "John Tan";
    expect(getWitnessTabLabel(interviewee, 1)).toBe("Witness 2 — John Tan");
  });
});
