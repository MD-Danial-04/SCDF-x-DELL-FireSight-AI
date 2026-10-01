/** Minimum time the extraction loading screen stays visible so it never flashes. */
export const MIN_LOADING_MS = 1500;

/** Random fake-load duration (1-3s) for demo / unconfigured flows with no live extraction. */
export function randomDemoDelayMs(): number {
  return 1000 + Math.random() * 2000;
}

/** Random fake transcribe duration (2-5s) for demo seeded answers. */
export function randomDemoSeededTranscribeDelayMs(): number {
  return 2000 + Math.random() * 3000;
}

/** Random follow-up generation duration (4-8s) for demo guided interview. */
export function randomDemoFollowUpDelayMs(): number {
  return 4000 + Math.random() * 4000;
}

/** Milliseconds still left before `MIN_LOADING_MS` has elapsed since `startedAt`. */
export function remainingMinDelayMs(startedAt: number): number {
  return Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
}
