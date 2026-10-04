import type { NextRequest } from "next/server";
import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { startNudges } from "@/server/reminders/service";

type Ctx = { params: Promise<{ id: string }> };

/** Remind guests who haven't replied, through INVTRA's WhatsApp (Accept / Decline buttons). */
export const POST = route<Ctx>("events.nudge", async (_req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  return ok(await startNudges(event));
});
