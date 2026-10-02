import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { HttpError, notFound } from "@/server/http";

/**
 * Shared guards for the TEST MODE checkout (page + API). The mock checkout exists only
 * when PAYMENT_PROVIDER=mock, and only the order's owner may use it.
 */
export function mockCheckoutEnabled() {
  return env().PAYMENT_PROVIDER === "mock";
}

export async function loadMockOrder(userId: string, orderId: string) {
  if (!mockCheckoutEnabled()) throw notFound("Order");
  const order = await db.order.findFirst({
    where: { id: orderId, userId, provider: "mock" },
    include: { event: { select: { id: true, title: true, hostNames: true, plan: true, deletedAt: true } }, user: { select: { email: true, name: true } } },
  });
  if (!order) throw notFound("Order");
  return order;
}

/** Stripe-style test cards: 4242… succeeds, 4000 0000 0000 0002 is declined. */
export const MOCK_DECLINE_CARD = "4000000000000002";

export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function mockPaymentId() {
  return `mockpay_${randomBytes(10).toString("hex")}`;
}

export const cardDeclined = () => new HttpError(402, "card_declined", "The card was declined (test card 4000 0000 0000 0002).");
