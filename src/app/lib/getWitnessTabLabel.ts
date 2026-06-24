import type { Interviewee } from "../types/interviewee";

export function getWitnessTabLabel(interviewee: Interviewee, index: number): string {
  const base = `Witness ${index + 1}`;
  const name = interviewee.name.trim();
  return name ? `${base} — ${name}` : base;
}
