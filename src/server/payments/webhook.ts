import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logError } from "@/server/log";
import { applyPaidOrder, cancelOrder, markOrderRefunded, recordFailedPayment } from "./service";
import { verifyStripeSignature } from "./stripe";

/**
 * Stripe webhook processing (POST /api/webhooks/payments/stripe).
 *
 *  - The signature is verified on the raw body before anything is parsed (400 if not).
 *  - Every event is processed at most once (WebhookEvent.dedupeKey = "stripe:<event id>").
 *  - A processing failure answers 500 so Stripe retries; the de-duplication row makes
 *    retries safe.
 */

type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
};

type StripeCharge = {
  id: string;
  object: "charge";
  payment_intent?: string | null;
  refunded?: boolean;
  amount_refunded?: number;
};

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<{ status: number; body?: unknown }> {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    await logError("webhook:stripe", new Error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured"), undefined, "warn");
    return { status: 400, body: { error: "not_configured" } };
  }
  const check = verifyStripeSignature(rawBody, signature, secret);
  if (!check.ok) {
    await logError("webhook:stripe", new Error(`Rejected Stripe webhook: ${check.reason} signature`), undefined, "warn");
    return { status: 400, body: { error: "invalid_signature" } };
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  if (!event?.id || typeof event.type !== "string") return { status: 400, body: { error: "invalid_event" } };

  const key = `stripe:${event.id}`;
  try {
    await db.webhookEvent.create({
      data: { provider: "stripe", dedupeKey: key, payload: { type: event.type, object: (event.data?.object ?? null) as Prisma.InputJsonValue } },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    const prior = await db.webhookEvent.findUnique({ where: { dedupeKey: key } });
    if (prior?.processedAt) return { status: 200, body: { received: true, duplicate: true } };
    if (prior && !prior.error && Date.now() - prior.createdAt.getTime() < 60_000) return { status: 409, body: { error: "in_progress" } };
  }

  try {
    await processEvent(event);
    await db.webhookEvent.update({ where: { dedupeKey: key }, data: { processedAt: new Date(), error: null } });
    return { status: 200, body: { received: true } };
  } catch (e) {
    await db.webhookEvent.update({ where: { dedupeKey: key }, data: { error: (e as Error).message.slice(0, 1000) } }).catch(() => undefined);
    await logError("webhook:stripe", e, { eventId: event.id, type: event.type });
    return { status: 500, body: { error: "processing_failed" } };
  }
}

function orderIdOf(session: StripeCheckoutSession): string | null {
  return session.metadata?.orderId || session.client_reference_id || null;
}

async function processEvent(event: StripeEvent) {
  const obj = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = obj as unknown as StripeCheckoutSession;
      // Delayed payment methods complete first with "unpaid"; async_payment_succeeded follows.
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
      await settleSession(session, event);
      return;
    }
    case "checkout.session.async_payment_failed": {
      const session = obj as unknown as StripeCheckoutSession;
      const order = await findStripeOrder(session);
      if (!order) return;
      await recordFailedPayment(order.id, { provider: "stripe", providerPaymentId: session.payment_intent ?? null, raw: { eventId: event.id, sessionId: session.id }, failOrder: true });
      return;
    }
    case "checkout.session.expired": {
      const session = obj as unknown as StripeCheckoutSession;
      const order = await findStripeOrder(session);
      // Only the order's *current* session cancels it — a reused order gets a new session
      // and the old one expiring must not cancel the order.
      if (!order || order.status !== "PENDING" || order.providerRef !== session.id) return;
      await cancelOrder(order.id, { note: "Stripe checkout session expired", expireCheckout: false });
      return;
    }
    case "charge.refunded": {
      const charge = obj as unknown as StripeCharge;
      if (!charge.refunded || !charge.payment_intent) return; // partial refunds are handled by staff
      const payment = await db.payment.findFirst({ where: { provider: "stripe", providerPaymentId: charge.payment_intent } });
      if (!payment) return;
      await markOrderRefunded(payment.orderId, { note: `Refunded in Stripe (${charge.id})` });
      return;
    }
    default:
      return; // not an event INVTRA acts on
  }
}

async function findStripeOrder(session: StripeCheckoutSession) {
  const orderId = orderIdOf(session);
  if (!orderId) return null;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.provider !== "stripe") return null;
  return order;
}

async function settleSession(session: StripeCheckoutSession, event: StripeEvent) {
  const order = await findStripeOrder(session);
  if (!order) {
    await logError("webhook:stripe", new Error("Paid Stripe session does not match an INVTRA order"), { sessionId: session.id, eventId: event.id }, "warn");
    return;
  }
  const amount = session.amount_total ?? null;
  const currency = session.currency?.toUpperCase() ?? null;
  if (amount !== order.amount || currency !== order.currency) {
    // Never apply a plan for a charge that doesn't match the order — staff review it.
    await logError(
      "payments:amount_mismatch",
      new Error(`Stripe charged ${amount} ${currency} for order ${order.id} (expected ${order.amount} ${order.currency})`),
      { orderId: order.id, sessionId: session.id, eventId: event.id },
    );
    await recordFailedPayment(order.id, { provider: "stripe", providerPaymentId: session.payment_intent ?? session.id, raw: { mismatch: true, amount, currency, sessionId: session.id } });
    return;
  }
  await applyPaidOrder(order.id, {
    provider: "stripe",
    providerPaymentId: session.payment_intent ?? session.id,
    amount,
    currency,
    raw: { eventId: event.id, sessionId: session.id, paymentIntent: session.payment_intent ?? null },
  });
}
