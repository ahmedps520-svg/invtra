import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseQuery, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { followUpList } from "@/server/reminders/service";

type Ctx = { params: Promise<{ id: string }> };

/** Guests to remind from the host's own WhatsApp (day-before reminder or reply reminder). */
export const GET = route<Ctx>("events.followups", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const { kind } = parseQuery(req, z.object({ kind: z.enum(["reminder", "nudge"]) }));
  return ok({ guests: await followUpList(event, kind) });
});
