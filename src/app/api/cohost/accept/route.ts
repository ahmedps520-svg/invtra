import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { acceptInvite } from "@/server/events/cohosts";

/** The signed-in user accepts an invitation to keep a guest list, and is sent to it. */
export const POST = route("cohost.accept", async (req: NextRequest) => {
  const user = await requireApiUser();
  await enforceRateLimit(`cohost-accept:${user.id}`, 30, 600);
  const { token } = await parseJson(req, z.object({ token: z.string().min(10).max(120) }));
  const { eventId } = await acceptInvite(user, token);
  return ok({ redirectTo: `/dashboard/events/${eventId}/guests` });
});
