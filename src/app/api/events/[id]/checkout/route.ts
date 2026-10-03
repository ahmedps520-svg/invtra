import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { SELF_SERVE_PLANS, startCheckout } from "@/server/payments/service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ plan: z.enum(SELF_SERVE_PLANS), offer: z.string().max(40).nullish() });

/** Start buying (or upgrading to) a plan for this event → { redirectUrl, orderId }. */
export const POST = route<Ctx>("events.checkout", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`checkout:${user.id}`, 20, 600);
  const { plan, offer } = await parseJson(req, schema);
  const event = await getOwnedEvent(user, id);
  const result = await startCheckout(user, event, plan, { offer });
  return ok(result, { status: 201 });
});
