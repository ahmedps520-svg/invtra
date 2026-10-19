import type { Event, Order } from "@prisma/client";
import { orderGaps } from "@/server/orders/service";
import type { OrderStepState } from "@/components/dashboard/order-steps";
import { db } from "@/server/db";
import { pickTemplate } from "@/server/whatsapp/compose";
import type { StepState } from "@/components/dashboard/steps";

/**
 * Completion of each workflow step (server side):
 *   event  — always (the event exists)
 *   design — a theme is chosen, or the custom image is uploaded in CUSTOM mode
 *   guests — at least one guest
 *   review — a plan covering the guest list and an approved message template
 *   send   — invitations have gone out at least once
 */
export function computeSteps(
  event: Pick<Event, "themeKey" | "imageMode" | "customImageKey" | "plan" | "guestLimit" | "firstSentAt">,
  guestCount: number,
  hasTemplate: boolean,
): StepState {
  return {
    event: true,
    design: event.imageMode === "CUSTOM" ? Boolean(event.customImageKey) : Boolean(event.themeKey),
    guests: guestCount > 0,
    review: guestCount > 0 && Boolean(event.plan) && event.guestLimit >= guestCount && hasTemplate,
    send: Boolean(event.firstSentAt),
  };
}

/** The order wizard's steps for an event that isn't paid for yet. */
export function computeOrderSteps(
  event: Pick<Event, "product" | "designSource" | "designBrief" | "imageMode" | "customImageKey" | "themeKey" | "features">,
  order: Pick<Order, "stage"> | null,
): OrderStepState {
  const submitted = Boolean(order && order.stage !== "DRAFT" && order.stage !== "REJECTED" && order.stage !== "CANCELLED");
  return {
    product: true,
    details: true,
    design: orderGaps(event).length === 0,
    features: event.product === "PHOTO_ONLY" || event.features !== null,
    summary: Boolean(order),
    payment: submitted,
  };
}

export async function loadSteps(event: Event) {
  const [guestCount, template] = await Promise.all([
    db.guest.count({ where: { eventId: event.id, isTest: false } }),
    pickTemplate(event, { locale: null }, "INVITATION"),
  ]);
  return { steps: computeSteps(event, guestCount, Boolean(template)), guestCount };
}
