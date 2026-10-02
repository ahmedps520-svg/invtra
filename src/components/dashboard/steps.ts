/** The five-step invitation workflow, shared by the event layout and the events list. */
export const STEP_KEYS = ["event", "design", "guests", "review", "send"] as const;
export type StepKey = (typeof STEP_KEYS)[number];
export type StepState = Record<StepKey, boolean>;

export const STEP_PATHS: Record<StepKey, string> = {
  event: "details",
  design: "design",
  guests: "guests",
  review: "review",
  send: "send",
};

export function stepHref(eventId: string, step: StepKey | "overview"): string {
  const base = `/dashboard/events/${eventId}`;
  return step === "overview" ? base : `${base}/${STEP_PATHS[step]}`;
}

/** First step that still needs doing, or null when everything has been sent. */
export function nextStep(steps: StepState): StepKey | null {
  for (const k of STEP_KEYS) if (!steps[k]) return k;
  return null;
}

export function doneCount(steps: StepState): number {
  return STEP_KEYS.filter((k) => steps[k]).length;
}
