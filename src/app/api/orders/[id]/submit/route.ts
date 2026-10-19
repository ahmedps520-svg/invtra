import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { submitOrder } from "@/server/orders/service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ reference: z.string().trim().max(120).nullable().optional() });

/** Submit the order: it waits for staff to confirm the transfer (it is never marked paid here). */
export const POST = route<Ctx>("orders.submit", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`order-submit:${user.id}`, 20, 600);
  const { reference } = await parseJson(req, schema);
  const { order } = await submitOrder(user, id, { reference });
  return ok({ order: { id: order.id, stage: order.stage, status: order.status } });
});
