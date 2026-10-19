import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { answerInfoRequest } from "@/server/orders/service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ note: z.string().trim().min(2, "Write a short reply").max(2000), reference: z.string().trim().max(120).nullable().optional() });

/** Answer staff's request for more information; the order goes back for verification. */
export const POST = route<Ctx>("orders.reply", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`order-reply:${user.id}`, 20, 600);
  const input = await parseJson(req, schema);
  const order = await answerInfoRequest(user, id, input);
  return ok({ order: { id: order.id, stage: order.stage } });
});
