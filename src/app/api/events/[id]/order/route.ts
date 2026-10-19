import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { prepareOrder } from "@/server/orders/service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ code: z.string().trim().max(40).nullable().optional() });

/** The event's order at today's prices (with an optional discount code), ready to submit. */
export const POST = route<Ctx>("events.order", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`order:${user.id}`, 60, 600);
  const { code } = await parseJson(req, schema);
  const event = await getOwnedEvent(user, id);
  const order = await prepareOrder(user, event, { code });
  return ok({ order: { id: order.id, amount: order.amount, currency: order.currency, lines: order.lines, stage: order.stage, discount: order.discount } });
});
