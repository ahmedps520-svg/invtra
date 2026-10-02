import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { cancelEventBatch } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string; batchId: string }> };

export const POST = route<Ctx>("events.batch.cancel", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, batchId } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  return ok({ batch: await cancelEventBatch(event.id, batchId) });
});
