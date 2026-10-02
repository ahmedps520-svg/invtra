import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, conflict, ok, parseJson, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { applyPaidOrder, checkoutUrls, recordFailedPayment } from "@/server/payments/service";
import { cardDeclined, loadMockOrder, luhnValid, MOCK_DECLINE_CARD, mockPaymentId } from "@/server/payments/mock-checkout";

type Ctx = { params: Promise<{ orderId: string }> };

const schema = z.object({
  card: z.string().max(40).optional(),
  name: z.string().max(120).optional(),
});

/** TEST MODE: simulate a successful card payment for the signed-in customer's own order. */
export const POST = route<Ctx>("billing.mock.complete", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { orderId } = await ctx.params;
  await enforceRateLimit(`mockpay:${user.id}`, 30, 600);
  const input = await parseJson(req, schema);
  const order = await loadMockOrder(user.id, orderId);
  const urls = order.eventId ? checkoutUrls(order.eventId) : null;
  const successUrl = urls?.successUrl ?? "/dashboard/billing";

  if (order.status === "PAID") return ok({ redirectUrl: successUrl, status: "PAID" });
  if (order.status !== "PENDING") throw conflict("order_closed", `This order is ${order.status.toLowerCase()} and can no longer be paid.`);

  const digits = (input.card ?? "4242424242424242").replace(/\D/g, "");
  if (!luhnValid(digits)) throw badRequest("invalid_card", "Enter a valid test card number.", { card: "Invalid card number" });
  if (digits === MOCK_DECLINE_CARD) {
    await recordFailedPayment(order.id, { provider: "mock", providerPaymentId: mockPaymentId(), raw: { test: true, declined: true, last4: digits.slice(-4) } });
    throw cardDeclined();
  }

  await applyPaidOrder(order.id, {
    provider: "mock",
    providerPaymentId: mockPaymentId(),
    raw: { test: true, last4: digits.slice(-4), cardholder: input.name?.trim() || null },
  });
  return ok({ redirectUrl: successUrl, status: "PAID" });
});
