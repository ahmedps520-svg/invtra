import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { sendTest } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("events.send-test", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`send-test:${user.id}`, 6, 600);
  const event = await getOwnedEvent(user, id);
  const { phone } = await parseJson(req, z.object({ phone: z.string().trim().min(5).max(32) }));
  const { batch, guest } = await sendTest(user.id, event, phone, user.name);
  return ok({ batch, guest: { id: guest.id, phone: guest.phone } }, { status: 201 });
});
