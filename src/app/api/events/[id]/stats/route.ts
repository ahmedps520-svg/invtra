import { db } from "@/server/db";
import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { eventStats } from "@/server/events/service";
import { staleAcceptedCount } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string }> };

/** Live numbers for the event overview (polled by the dashboard). */
export const GET = route<Ctx>("events.stats", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const [stats, activity, batch, stale] = await Promise.all([
    eventStats(event.id),
    db.activity.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.sendBatch.findFirst({ where: { eventId: event.id, kind: { not: "TEST" } }, orderBy: { createdAt: "desc" } }),
    staleAcceptedCount(event),
  ]);
  return ok({ stats, activity, latestBatch: batch, staleAccepted: stale });
});
