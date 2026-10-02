import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { resendToGuests } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("guests.resend-many", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`resend:${user.id}`, 60, 600);
  const event = await getOwnedEvent(user, id);
  const { ids } = await parseJson(req, z.object({ ids: z.array(z.string()).min(1).max(2000) }));
  return ok(await resendToGuests(user.id, event, ids));
});
