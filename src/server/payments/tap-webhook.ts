import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logError } from "@/server/log";
import { applyPaidOrder, recordFailedPayment } from "./service";
import { TAP_FAILED_STATUSES, fromTapAmount, retrieveTapCharge, verifyTapSignature, type TapCharge } from "./tap";

/**
 * Tap payment confirmation — from the webhook (POST /api/webhooks/payments/tap) and from
 * the customer's return to the review page. Both paths re-fetch the charge from Tap's API
 * with the secret key, so neither a forged webhook nor a crafted return URL can mark an
 * order paid; the plan is applied once (applyPaidOrder is idempotent).
 */

export type TapOutcome = "paid" | "failed" | "pending" | "ignored";

function orderIdOf(charge: TapCharge): string | null {
  return charge.reference?.order || charge.metadata?.orderId || null;
}

/** Apply a charge (already fetched from Tap) to its INVTRA order. */
export async function settleTapCharge(charge: TapCharge, via: "webhook" | "return"): Promise<TapOutcome> {
  const orderId = orderIdOf(charge);
  const order = orderId ? await db.order.findUnique({ where: { id: orderId } }) : null;
  if (!order || order.provider !== "tap") {
    await logError("payments:tap", new Error("Tap charge does not match an INVTRA order"), { chargeId: charge.id, orderId, via }, "warn");
    return "ignored";
  }

  if (charge.status === "CAPTURED") {
    const amount = fromTapAmount(charge.amount, charge.currency);
    const currency = charge.currency?.toUpperCase();
    if (amount !== order.amount || currency !== order.currency) {
      // Never apply a plan for a charge that doesn't match the order — staff review it.
      await logError(
        "payments:amount_mismatch",
        new Error(`Tap charged ${amount} ${currency} for order ${order.id} (expected ${order.amount} ${order.currency})`),
        { orderId: order.id, chargeId: charge.id },
      );
      await recordFailedPayment(order.id, { provider: "tap", providerPaymentId: charge.id, raw: { mismatch: true, amount, currency } });
      return "failed";
    }
    await applyPaidOrder(order.id, {
      provider: "tap",
      providerPaymentId: charge.id,
      amount,
      currency,
      raw: { chargeId: charge.id, via, method: charge.source?.payment_method ?? null, live: charge.live_mode ?? null },
    });
    return "paid";
  }

  if (TAP_FAILED_STATUSES.has(charge.status)) {
    // Recorded for support; the order stays open so the customer can simply try again.
    if (order.status === "PENDING" && order.providerRef === charge.id) {
      const seen = await db.payment.findFirst({ where: { orderId: order.id, providerPaymentId: charge.id } });
      if (!seen) {
        await recordFailedPayment(order.id, {
          provider: "tap",
          providerPaymentId: charge.id,
          raw: { status: charge.status, response: charge.response ?? null, via },
        });
      }
    }
    return "failed";
  }
  return "pending";
}

export async function handleTapWebhook(rawBody: string, hashstring: string | null): Promise<{ status: number; body?: unknown }> {
  const secret = env().TAP_SECRET_KEY;
  if (!secret) {
    await logError("webhook:tap", new Error("Tap webhook received but TAP_SECRET_KEY is not configured"), undefined, "warn");
    return { status: 400, body: { error: "not_configured" } };
  }
  let posted: TapCharge;
  try {
    posted = JSON.parse(rawBody) as TapCharge;
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  if (!posted?.id || typeof posted.status !== "string") return { status: 400, body: { error: "invalid_payload" } };
  // Refunds are issued and recorded by staff (Admin → Payments); only charges are automated.
  if (!posted.id.startsWith("chg_")) return { status: 200, body: { received: true, ignored: true } };
  if (hashstring && !verifyTapSignature(posted, hashstring, secret)) {
    await logError("webhook:tap", new Error("Rejected Tap webhook: hashstring mismatch"), { chargeId: posted.id }, "warn");
    return { status: 400, body: { error: "invalid_signature" } };
  }

  const key = `tap:${posted.id}:${posted.status}`;
  try {
    await db.webhookEvent.create({ data: { provider: "tap", dedupeKey: key, payload: { id: posted.id, status: posted.status } } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    const prior = await db.webhookEvent.findUnique({ where: { dedupeKey: key } });
    if (prior?.processedAt) return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    const charge = await retrieveTapCharge(posted.id);
    const outcome = await settleTapCharge(charge, "webhook");
    await db.webhookEvent.update({ where: { dedupeKey: key }, data: { processedAt: new Date(), error: null } });
    return { status: 200, body: { received: true, outcome } };
  } catch (e) {
    await db.webhookEvent.update({ where: { dedupeKey: key }, data: { error: (e as Error).message.slice(0, 1000) } }).catch(() => undefined);
    await logError("webhook:tap", e, { chargeId: posted.id });
    return { status: 500, body: { error: "processing_failed" } };
  }
}

/**
 * The customer is back from Tap's payment page: look up their latest Tap order for the
 * event and ask Tap what happened. → "success" (plan active), "cancelled" (not paid) or
 * null (still processing — the webhook will finish it).
 */
export async function confirmTapReturn(eventId: string, userId: string): Promise<"success" | "cancelled" | null> {
  const order = await db.order.findFirst({
    where: { eventId, userId, provider: "tap", providerRef: { not: null }, createdAt: { gte: new Date(Date.now() - 3 * 86_400_000) } },
    orderBy: { updatedAt: "desc" },
  });
  if (!order?.providerRef) return null;
  if (order.status === "PAID") return "success";
  if (order.status !== "PENDING") return "cancelled";
  try {
    const outcome = await settleTapCharge(await retrieveTapCharge(order.providerRef), "return");
    return outcome === "paid" ? "success" : outcome === "failed" ? "cancelled" : null;
  } catch (e) {
    await logError("payments:tap", e, { orderId: order.id, via: "return" });
    return null;
  }
}
