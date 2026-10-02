import { ok, requireApiUser, route } from "@/server/http";
import { cancelOrder, checkoutUrls } from "@/server/payments/service";
import { loadMockOrder } from "@/server/payments/mock-checkout";

type Ctx = { params: Promise<{ orderId: string }> };

/** TEST MODE: the customer abandoned the checkout. */
export const POST = route<Ctx>("billing.mock.cancel", async (_req, ctx) => {
  const user = await requireApiUser();
  const { orderId } = await ctx.params;
  const order = await loadMockOrder(user.id, orderId);
  if (order.status === "PENDING") await cancelOrder(order.id, { note: "Cancelled at checkout" });
  const cancelUrl = order.eventId ? checkoutUrls(order.eventId).cancelUrl : "/dashboard/billing";
  return ok({ redirectUrl: cancelUrl, status: order.status === "PENDING" ? "CANCELLED" : order.status });
});
