import { db } from "@/server/db";
import { notFound, ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";

type Ctx = { params: Promise<{ id: string; batchId: string }> };

/** Progress of a send batch ("Sending invitations… 87 / 184"). Polled by the Send page. */
export const GET = route<Ctx>("events.batch", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, batchId } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const batch = await db.sendBatch.findFirst({ where: { id: batchId, eventId: event.id } });
  if (!batch) throw notFound("Batch");
  const processed = batch.sent + batch.failed + batch.skipped;
  return ok({ batch: { ...batch, processed, done: batch.status === "COMPLETED" || batch.status === "CANCELLED" } });
});
