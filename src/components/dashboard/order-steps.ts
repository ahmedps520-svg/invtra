import type { Product } from "@prisma/client";

/**
 * The order wizard, shown until the event is paid for:
 * product → details → design → features (not for Photo only) → review → payment.
 */
export const ORDER_STEP_KEYS = ["product", "details", "design", "features", "summary", "payment"] as const;
export type OrderStepKey = (typeof ORDER_STEP_KEYS)[number];
export type OrderStepState = Record<OrderStepKey, boolean>;

export function orderStepKeys(product: Product): OrderStepKey[] {
  return product === "PHOTO_ONLY" ? ORDER_STEP_KEYS.filter((k) => k !== "features") : [...ORDER_STEP_KEYS];
}

export function orderStepHref(eventId: string, step: OrderStepKey): string {
  return `/dashboard/events/${eventId}/${step}`;
}

/** First step that still needs doing (null once the order is submitted). */
export function nextOrderStep(steps: OrderStepState, product: Product): OrderStepKey | null {
  for (const k of orderStepKeys(product)) if (!steps[k]) return k;
  return null;
}

/** Dictionary label key for each step (the review step is called "Review"). */
export const ORDER_STEP_LABEL: Record<OrderStepKey, "product" | "details" | "design" | "features" | "review" | "payment"> = {
  product: "product",
  details: "details",
  design: "design",
  features: "features",
  summary: "review",
  payment: "payment",
};
