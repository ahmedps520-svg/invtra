import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { adminCancel, adminMarkPaid, adminRefund } from "@/server/admin/payments";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_paid"), reason: z.string().trim().min(3, "Add the payment reference").max(500) }),
  z.object({ action: z.literal("refund"), reason: z.string().trim().min(3, "Give a reason").max(500), revokePlan: z.boolean().default(false) }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(500).default("") }),
]);

/** Admin order actions: mark paid (manual payment), mark refunded, cancel. */
export const POST = route<Ctx>("admin.orders.action", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
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
  }
});
