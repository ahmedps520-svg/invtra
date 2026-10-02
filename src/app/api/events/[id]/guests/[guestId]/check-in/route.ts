import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { notFound, ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { recordActivity } from "@/server/activity";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

/** Door check-in (or undo). */
export const POST = route<Ctx>("guests.check-in", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id, guestId } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id } });
  if (!guest) throw notFound("Guest");
  const { count, undo } = await parseJson(req, z.object({ count: z.number().int().min(1).max(50).optional(), undo: z.boolean().optional() }));
  const updated = await db.guest.update({
    where: { id: guest.id },
    data: undo ? { checkedInAt: null, checkedInCount: null } : { checkedInAt: new Date(), checkedInCount: count ?? guest.attendingCount ?? guest.allowedCount, lastActivityAt: new Date() },
  });
  if (!undo) await recordActivity(db, event.id, "guest.checked_in", { name: guest.name, count: updated.checkedInCount }, guest.id);
  return ok({ guest: { id: updated.id, checkedInAt: updated.checkedInAt, checkedInCount: updated.checkedInCount } });
});
