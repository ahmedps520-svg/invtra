import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { adminCancel, adminMarkPaid, adminRefund } from "@/server/admin/payments";
import { approveOrder, markOrderReady, rejectOrder, requestOrderInfo, retryDelivery } from "@/server/orders/service";
import { enforceRateLimit } from "@/server/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_paid"), reason: z.string().trim().min(3, "Add the payment reference").max(500) }),
  z.object({ action: z.literal("refund"), reason: z.string().trim().min(3, "Give a reason").max(500), revokePlan: z.boolean().default(false) }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(500).default("") }),
  // Payment verification (orders from the event wizard)
  z.object({
    action: z.literal("approve"),
    reason: z.string().trim().max(500).default(""),
    confirmed: z.literal(true, { errorMap: () => ({ message: "Confirm you've seen the money in the account" }) }),
  }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5, "Tell the customer why").max(1000) }),
  z.object({ action: z.literal("request_info"), reason: z.string().trim().min(5, "Say what you need").max(1000) }),
  z.object({ action: z.literal("mark_ready") }),
  z.object({ action: z.literal("retry_delivery") }),
]);

/** Admin order actions: payment verification, production and delivery, refunds and cancellations. */
export const POST = route<Ctx>("admin.orders.action", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  await enforceRateLimit(`admin-order:${admin.id}`, 120, 600);
  const input = await parseJson(req, schema);
  switch (input.action) {
    case "mark_paid": {
      const r = await adminMarkPaid(admin.id, id, input.reason);
      return ok({ message: r.applied ? "Order marked paid — plan activated" : "Order was already paid" });
    }
    case "refund": {
      const r = await adminRefund(admin.id, id, input.reason, input.revokePlan);
      return ok({ message: r.plan ? `Order refunded — event plan is now ${r.plan.plan ?? "none"}` : "Order marked refunded" });
    }
    case "cancel":
      await adminCancel(admin.id, id, input.reason);
      return ok({ message: "Order cancelled" });
    case "approve": {
      const r = await approveOrder(admin.id, id, input.reason);
      return ok({ message: r.applied ? "Payment approved — the customer is being sent their order" : "This order was already approved" });
    }
    case "reject": {
      const r = await rejectOrder(admin.id, id, input.reason);
      return ok({ message: r.changed ? "Payment rejected — the customer has been told why" : "This order was already rejected" });
    }
    case "request_info":
      await requestOrderInfo(admin.id, id, input.reason);
      return ok({ message: "Request sent to the customer" });
    case "mark_ready": {
      const r = await markOrderReady(admin.id, id);
      return ok({ message: r.changed ? "Marked ready — delivering to the customer" : "Already ready" });
    }
    case "retry_delivery": {
      const r = await retryDelivery(admin.id, id);
      return ok({ message: r.queued ? "Delivery queued again" : "Everything was already delivered" });
    }
  }
});
