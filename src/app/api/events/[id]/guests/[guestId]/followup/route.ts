import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getGuestAccess, guestInScope } from "@/server/events/cohosts";
import { rateLimit } from "@/server/security/rate-limit";
import { tooManyRequests } from "@/server/http";
import { markFollowUp } from "@/server/reminders/service";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

/** The host opened WhatsApp to remind this guest from their own phone. */
export const POST = route<Ctx>("guests.followup", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  if (!(await rateLimit(`followup:${user.id}`, 600, 600)).ok) throw tooManyRequests();
  const { id, guestId } = await ctx.params;
  const access = await getGuestAccess(user, id);
  await guestInScope(access, guestId);
  const { kind } = await parseJson(req, z.object({ kind: z.enum(["reminder", "nudge"]) }));
  return ok(await markFollowUp(access.event, guestId, kind));
});
