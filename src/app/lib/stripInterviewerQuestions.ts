/**
 * Local, no-network removal of interviewer prompts from a transcript.
 *
 * Guided interviews format their transcript as `Q: <prompt>` / `A: <answer>`
 * blocks (see buildTranscriptFromResponses in types/interviewee.ts). This helper
 * drops the `Q:` question lines and unwraps the `A:` answer prefix so only the
 * interviewee's words remain. Used as a fast path for guided text and as an
 * offline fallback when the coordinator is not configured.
 *
 * It only touches lines it recognises as Q/A markers; free-form prose with no
 * markers is returned unchanged (the coordinator endpoint handles that case).
 */
export function stripQuestionLines(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    if (/^\s*Q:\s?/i.test(line)) {
      continue;
    }
    const answer = line.replace(/^\s*A:\s?/i, "");
    kept.push(answer);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
