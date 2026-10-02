import { db } from "@/server/db";
import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

export const DELETE = route<Ctx>("events.gallery.delete", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, imageId } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  await db.galleryImage.deleteMany({ where: { id: imageId, eventId: event.id } });
  return ok();
});
