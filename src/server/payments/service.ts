import { Prisma, type Event, type Order, type PlanTier } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { badRequest, conflict, HttpError, notFound } from "@/server/http";
import { logError } from "@/server/log";
import { recordActivity } from "@/server/activity";
import { PLAN_ORDER, PLANS, upgradePrice, type Currency, PLAN_NAMES } from "@/lib/plans";
import { activeOffer, findOffer, isOfferActive, offerInfo, offerName } from "@/lib/offers";
import { nextReceiptNumber } from "./receipts";
import { enqueue } from "@/server/queue/queue";
import { paymentProvider, providerFor } from "./index";
import { manualInstructions } from "./manual";
import type { CheckoutUrls, PaidDetails } from "./types";

/**
 * Orders & payments.
 *
 *  - An order is created for one event and one plan; its price is the upgrade price from
 *    the event's current plan (Basic → Premium charges the difference).
 *  - `applyPaidOrder` is the single place an order becomes PAID — used by the Stripe
 *    webhook, the mock checkout and admins (manual payments). It is idempotent.
 */

type Tx = Prisma.TransactionClient;

export const SELF_SERVE_PLANS = ["BASIC", "PREMIUM"] as const;
export type SelfServePlan = (typeof SELF_SERVE_PLANS)[number];

/** A PENDING order for the same event + plan younger than this is reused instead of duplicated. */
const ORDER_REUSE_MS = 24 * 60 * 60 * 1000;

export function paymentCurrency(): Currency {
  return env().PAYMENT_CURRENCY;
}

export function checkoutUrls(eventId: string): CheckoutUrls {
  const base = `/dashboard/events/${encodeURIComponent(eventId)}/review`;
  return { successUrl: appUrl(`${base}?checkout=success`), cancelUrl: appUrl(`${base}?checkout=cancelled`) };
}

export function planRank(plan: PlanTier | null | undefined): number {
  return plan ? PLAN_ORDER.indexOf(plan) : -1;
}

export function higherPlan(a: PlanTier | null | undefined, b: PlanTier): PlanTier {
  return planRank(a) > planRank(b) ? (a as PlanTier) : b;
}

export const planLabel = (p: PlanTier) => PLAN_NAMES[p];

function json(v: unknown): Prisma.InputJsonValue | undefined {
  return v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);
}

function appendNote(existing: string | null, note: string | null | undefined): string | null {
  const n = note?.trim();
  if (!n) return existing;
  return existing ? `${existing}\n${n}`.slice(-2000) : n.slice(0, 2000);
}

async function lockOrder(tx: Tx, orderId: string): Promise<Order> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  return order;
}

async function expireCheckouts(orders: Pick<Order, "provider" | "providerRef">[]) {
  for (const o of orders) {
    const p = providerFor(o.provider);
    if (o.providerRef && p?.expireCheckout) await p.expireCheckout(o.providerRef);
  }
}

// ── Checkout ────────────────────────────────────────────────────────────────

/**
 * Create (or reuse) a PENDING order to move `event` to `plan`. Only Basic and Premium
 * are self-serve; Custom is arranged with sales and granted by an admin.
 */
/**
 * What the event's current plan counts for towards an upgrade, when it was bought with an
 * offer (null = its list price). Without this, 96 riyals + the Standard→Premium difference
 * would buy Premium far below its price.
 */
export async function planCredit(event: Pick<Event, "id" | "plan">): Promise<number | null> {
  if (!event.plan) return null;
  const last = await db.order.findFirst({ where: { eventId: event.id, status: "PAID", plan: event.plan }, orderBy: { paidAt: "desc" } });
  return last?.promo ? last.amount : null;
}

export async function createOrderForEvent(
  user: { id: string },
  event: Pick<Event, "id" | "userId" | "plan" | "deletedAt" | "deactivatedAt">,
  plan: PlanTier,
  opts: { offer?: string | null } = {},
): Promise<{ order: Order; reused: boolean }> {
  if (plan !== "BASIC" && plan !== "PREMIUM") {
    throw badRequest("plan_not_self_serve", "The Custom plan is arranged with our team — please contact us.");
  }
  if (event.userId !== user.id) throw notFound("Event");
  if (event.deletedAt || event.deactivatedAt) throw badRequest("event_inactive", "This event is not active.");
  const currency = paymentCurrency();
  let amount: number | null;
  let guestLimit = PLANS[plan].guestLimit ?? 0;
  let promo: string | null = null;
  if (opts.offer) {
    const offer = findOffer(opts.offer);
    if (!offer || !isOfferActive(offer)) throw badRequest("offer_ended", "This offer has ended.");
    if (plan !== offer.tier) throw badRequest("invalid_offer", "This offer is for a different plan.");
    if (event.plan) throw badRequest("offer_first_plan", "The offer is for events that don't have a plan yet.");
    amount = offer.prices[currency];
    guestLimit = offer.guestLimit;
    promo = offer.key;
  } else {
    amount = upgradePrice(event.plan, plan, currency, await planCredit(event));
  }
  if (amount === null || amount <= 0) {
    throw badRequest(
      "not_an_upgrade",
      event.plan === plan ? "This event already has this plan." : "This event already has a higher plan.",
    );
  }
  const provider = paymentProvider().name;

  const existing = await db.order.findFirst({
    where: {
      userId: user.id,
      eventId: event.id,
      plan,
      status: "PENDING",
      provider,
      amount,
      currency,
      guestLimit,
      promo,
      createdAt: { gte: new Date(Date.now() - ORDER_REUSE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { order: existing, reused: true };

  const order = await db.order.create({
    data: { userId: user.id, eventId: event.id, plan, guestLimit, amount, currency, provider, status: "PENDING", promo },
  });
  return { order, reused: false };
}

/** Create/reuse the order and hand the customer to the payment provider. */
export async function startCheckout(
  user: { id: string; email: string; name?: string | null },
  event: Pick<Event, "id" | "userId" | "plan" | "title" | "deletedAt" | "deactivatedAt">,
  plan: PlanTier,
  opts: { offer?: string | null } = {},
): Promise<{ redirectUrl: string; orderId: string }> {
  const { order, reused } = await createOrderForEvent(user, event, plan, opts);
  const provider = paymentProvider();

  // One open checkout per event: older pending orders (other plan) are withdrawn so a
  // customer can never pay twice for the same upgrade.
  const stale = await db.order.findMany({ where: { eventId: event.id, userId: user.id, status: "PENDING", id: { not: order.id } } });
  if (stale.length) {
    await db.order.updateMany({
      where: { id: { in: stale.map((o) => o.id) }, status: "PENDING" },
      data: { status: "CANCELLED", note: `Replaced by order ${order.id}` },
    });
    await expireCheckouts(stale);
  }
  // A reused order gets a fresh hosted session; the previous one must not stay payable.
  if (reused && order.providerRef) await expireCheckouts([order]);

  let result;
  try {
    result = await provider.createCheckout(order, checkoutUrls(event.id), {
      customerEmail: user.email,
      customerName: user.name ?? undefined,
      description: `INVTRA ${offerName(order.promo) ?? `${planLabel(plan)} plan`} — ${event.title}`.slice(0, 250),
    });
  } catch (e) {
    await logError("payments:checkout", e, { orderId: order.id, provider: provider.name });
    throw new HttpError(502, "payment_provider_error", "We couldn't start the payment right now. Please try again in a moment.");
  }
  if (result.providerRef !== undefined && result.providerRef !== order.providerRef) {
    await db.order.update({ where: { id: order.id }, data: { providerRef: result.providerRef } });
  }
  return { redirectUrl: result.redirectUrl, orderId: order.id };
}

// ── State transitions ───────────────────────────────────────────────────────

export type ApplyPaidResult = { order: Order; applied: boolean; duplicatePayment: boolean };

/**
 * Mark an order paid and apply its plan to the event — in one transaction:
 *   order → PAID (+ paidAt), Payment SUCCEEDED, event.plan (never downgraded),
 *   event.guestLimit = max(current, order.guestLimit), activity "plan.purchased".
 * Idempotent: an already-paid order is left untouched. A *different* provider payment
 * for an already-paid order (customer paid twice) is recorded and flagged for refund.
 */
export async function applyPaidOrder(orderId: string, details: PaidDetails): Promise<ApplyPaidResult> {
  const superseded: Order[] = [];
  const result = await db.$transaction(async (tx): Promise<ApplyPaidResult> => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "PAID") {
      let duplicatePayment = false;
      if (details.providerPaymentId) {
        const seen = await tx.payment.findFirst({ where: { orderId, providerPaymentId: details.providerPaymentId } });
        if (!seen) {
          duplicatePayment = true;
          await tx.payment.create({
            data: {
              orderId,
              provider: details.provider,
              providerPaymentId: details.providerPaymentId,
              amount: details.amount ?? order.amount,
              currency: details.currency ?? order.currency,
              status: "SUCCEEDED",
              raw: json({ duplicate: true, raw: details.raw ?? null }),
            },
          });
        }
      }
      return { order, applied: false, duplicatePayment };
    }
    if (order.status === "REFUNDED") throw conflict("order_refunded", "This order was refunded and can't be marked paid again.");

    const now = new Date();
    const receiptNumber = order.receiptNumber ?? (await nextReceiptNumber(tx, now));
    const paid = await tx.order.update({
      where: { id: orderId },
      data: { status: "PAID", paidAt: now, receiptNumber, note: appendNote(order.note, details.note) },
    });
    // The receipt goes out by email (and WhatsApp for payment-link orders) once this commits.
    await enqueue("payment.receipt", { orderId, channel: "email" }, { tx, eventId: order.eventId ?? undefined });
    if (order.payToken) {
      const phone = await tx.user.findUnique({ where: { id: order.userId }, select: { phone: true } });
      if (phone?.phone) await enqueue("payment.receipt", { orderId, channel: "whatsapp" }, { tx, eventId: order.eventId ?? undefined });
    }
    await tx.payment.create({
      data: {
        orderId,
        provider: details.provider,
        providerPaymentId: details.providerPaymentId ?? null,
        amount: details.amount ?? order.amount,
        currency: details.currency ?? order.currency,
        status: "SUCCEEDED",
        raw: json(details.raw),
      },
    });

    if (order.eventId) {
      const event = await tx.event.findUnique({ where: { id: order.eventId }, select: { id: true, plan: true, guestLimit: true } });
      if (event) {
        const plan = higherPlan(event.plan, order.plan);
        await tx.event.update({
          where: { id: event.id },
          data: { plan, guestLimit: Math.max(event.guestLimit, order.guestLimit) },
        });
        await recordActivity(tx, event.id, "plan.purchased", {
          plan: order.plan,
          orderId,
          amount: order.amount,
          currency: order.currency,
          guestLimit: order.guestLimit,
        });
        // Pending orders this payment made pointless (same or lower plan) are withdrawn.
        const pointless = await tx.order.findMany({
          where: { eventId: event.id, status: "PENDING", id: { not: orderId }, plan: { in: PLAN_ORDER.filter((p) => planRank(p) <= planRank(plan)) } },
        });
        if (pointless.length) {
          await tx.order.updateMany({
            where: { id: { in: pointless.map((o) => o.id) } },
            data: { status: "CANCELLED", note: `Superseded by paid order ${orderId}` },
          });
          superseded.push(...pointless);
        }
      }
    }
    return { order: paid, applied: true, duplicatePayment: false };
  });

  if (superseded.length) await expireCheckouts(superseded);
  if (result.duplicatePayment) {
    await logError(
      "payments:duplicate",
      new Error(`Order ${orderId} received a second payment (${details.providerPaymentId}) — refund the duplicate`),
      { orderId, provider: details.provider, providerPaymentId: details.providerPaymentId },
    );
  }
  return result;
}

/** Recompute an event's plan from its remaining PAID orders (after a refund). */
async function recomputeEventPlan(tx: Tx, eventId: string) {
  const paid = await tx.order.findMany({ where: { eventId, status: "PAID" }, select: { plan: true, guestLimit: true } });
  const plan = paid.reduce<PlanTier | null>((best, o) => (planRank(o.plan) > planRank(best) ? o.plan : best), null);
  const guestLimit = paid.reduce((m, o) => Math.max(m, o.guestLimit), 0);
  await tx.event.update({ where: { id: eventId }, data: { plan, guestLimit } });
  return { plan, guestLimit };
}

/**
 * Record that a paid order was refunded (the money itself is returned in the provider's
 * dashboard or by bank transfer). With `revokePlan` the event's plan is recomputed from
 * its remaining paid orders.
 */
export async function markOrderRefunded(
  orderId: string,
  opts: { note?: string | null; revokePlan?: boolean } = {},
): Promise<{ order: Order; changed: boolean; plan?: { plan: PlanTier | null; guestLimit: number } }> {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "REFUNDED") return { order, changed: false };
    if (order.status !== "PAID") throw conflict("order_not_paid", "Only paid orders can be refunded.");
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED", note: appendNote(order.note, opts.note) },
    });
    await tx.payment.updateMany({ where: { orderId, status: "SUCCEEDED" }, data: { status: "REFUNDED" } });
    let plan: { plan: PlanTier | null; guestLimit: number } | undefined;
    if (opts.revokePlan && order.eventId) {
      const exists = await tx.event.findUnique({ where: { id: order.eventId }, select: { id: true } });
      if (exists) plan = await recomputeEventPlan(tx, order.eventId);
    }
    return { order: updated, changed: true, plan };
  });
}

/** Cancel an unpaid order. Paid orders must be refunded instead. */
export async function cancelOrder(
  orderId: string,
  opts: { note?: string | null; expireCheckout?: boolean } = {},
): Promise<{ order: Order; changed: boolean }> {
  const result = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "CANCELLED") return { order, changed: false };
    if (order.status === "PAID" || order.status === "REFUNDED") {
      throw conflict("order_paid", "This order has been paid — mark it refunded instead of cancelling it.");
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", note: appendNote(order.note, opts.note) },
    });
    return { order: updated, changed: true };
  });
  if (result.changed && opts.expireCheckout !== false) await expireCheckouts([result.order]);
  return result;
}

/** A payment attempt failed (async payment method declined, test card declined...). */
export async function recordFailedPayment(
  orderId: string,
  details: { provider: string; providerPaymentId?: string | null; raw?: unknown; failOrder?: boolean },
) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    await tx.payment.create({
      data: {
        orderId,
        provider: details.provider,
        providerPaymentId: details.providerPaymentId ?? null,
        amount: order.amount,
        currency: order.currency,
        status: "FAILED",
        raw: json(details.raw),
      },
    });
    if (details.failOrder && order.status === "PENDING") {
      return tx.order.update({ where: { id: orderId }, data: { status: "FAILED" } });
    }
    return order;
  });
}

/**
 * Admin "grant plan" (complimentary / custom deal): sets the event's plan and guest
 * limit exactly and records a PAID zero-amount manual order with the note.
 */
export async function grantPlan(input: { eventId: string; plan: PlanTier; guestLimit: number; note: string; actorId: string }) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${input.eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event || event.deletedAt) throw notFound("Event");
    const guests = await tx.guest.count({ where: { eventId: event.id, isTest: false } });
    if (input.guestLimit < guests) {
      throw badRequest("guest_limit_too_low", `The event already has ${guests} guests — the limit can't be lower.`, {
        guestLimit: `At least ${guests}`,
      });
    }
    const now = new Date();
    const order = await tx.order.create({
      data: {
        userId: event.userId,
        eventId: event.id,
        plan: input.plan,
        guestLimit: input.guestLimit,
        amount: 0,
        currency: paymentCurrency(),
        provider: "manual",
        status: "PAID",
        paidAt: now,
        note: `Granted by admin: ${input.note}`.slice(0, 2000),
      },
    });
    await tx.payment.create({
      data: { orderId: order.id, provider: "manual", amount: 0, currency: order.currency, status: "SUCCEEDED", raw: json({ grant: true, actorId: input.actorId }) },
    });
    const updated = await tx.event.update({ where: { id: event.id }, data: { plan: input.plan, guestLimit: input.guestLimit } });
    await recordActivity(tx, event.id, "plan.purchased", { plan: input.plan, orderId: order.id, amount: 0, currency: order.currency, guestLimit: input.guestLimit, granted: true });
    return { order, event: updated, previous: { plan: event.plan, guestLimit: event.guestLimit } };
  });
}

// ── Customer-facing serialisation (contract for the billing UI) ─────────────

export type CustomerOrder = {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  plan: PlanTier;
  guestLimit: number;
  amount: number;
  currency: string;
  status: Order["status"];
  provider: string;
  createdAt: string;
  paidAt: string | null;
  instructions?: string;
  /** Where to pay (custom packages awaiting payment) or see the receipt (paid orders). */
  payUrl?: string;
  receiptUrl?: string;
  receiptNumber?: string | null;
  /** Bought with a limited-time offer (src/lib/offers.ts). */
  promo: string | null;
};

export function serializeCustomerOrder(order: Order & { event: { title: string } | null }): CustomerOrder {
  return {
    id: order.id,
    eventId: order.eventId,
    eventTitle: order.event?.title ?? null,
    plan: order.plan,
    guestLimit: order.guestLimit,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    provider: order.provider,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    promo: order.promo,
    ...(order.provider === "manual" && order.status === "PENDING" ? { instructions: manualInstructions() } : {}),
    ...(order.payToken && order.status === "PENDING" ? { payUrl: `/pay/${order.payToken}` } : {}),
    ...(order.status === "PAID" || order.status === "REFUNDED"
      ? { receiptUrl: order.payToken ? `/pay/${order.payToken}` : `/receipt/${order.id}`, receiptNumber: order.receiptNumber }
      : {}),
  };
}

export function planCatalogue() {
  const currency = paymentCurrency();
  return {
    currency,
    provider: env().PAYMENT_PROVIDER,
    /** A limited-time offer on sale right now (first plan for an event), or null. */
    offer: offerInfo(activeOffer(), currency),
    plans: PLAN_ORDER.map((tier) => {
      const p = PLANS[tier];
      return {
        tier,
        guestLimit: p.guestLimit,
        price: p.prices?.[currency] ?? null,
        premiumThemes: p.premiumThemes,
        contactSales: p.contactSales,
      };
    }),
  };
}
