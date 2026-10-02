import { db } from "@/server/db";
import { notFound, ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { storage } from "@/server/storage";

type Ctx = { params: Promise<{ id: string; uploadId: string }> };

export const DELETE = route<Ctx>("events.upload.delete", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, uploadId } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const upload = await db.upload.findFirst({ where: { id: uploadId, eventId: event.id, userId: user.id } });
  if (!upload) throw notFound("Upload");
  const inUse =
    [event.customImageKey, event.coverImageKey, event.logoKey, event.musicKey].includes(upload.key) ||
    JSON.stringify(event.design).includes(upload.key);
  if (inUse) return ok({ ok: false, inUse: true }, { status: 409 });
  await db.galleryImage.deleteMany({ where: { eventId: event.id, storageKey: upload.key } });
  await db.upload.delete({ where: { id: upload.id } });
  await storage().delete(upload.key).catch(() => undefined);
  return ok();
});
