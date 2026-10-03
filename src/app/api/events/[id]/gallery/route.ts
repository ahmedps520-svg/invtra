import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { badRequest, ok, parseJson, requireApiUser, route } from "@/server/http";
import { getEditableEvent } from "@/server/events/access";
import { assertEventUpload } from "@/server/uploads";
import { mediaUrl } from "@/server/storage";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("events.gallery.list", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getEditableEvent(user, id);
  const images = await db.galleryImage.findMany({ where: { eventId: event.id }, orderBy: { sortOrder: "asc" } });
  return ok({ images: await Promise.all(images.map(async (i) => ({ ...i, url: await mediaUrl(i.storageKey) }))) });
});

/** Add an uploaded GALLERY image to the event gallery. */
export const POST = route<Ctx>("events.gallery.add", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getEditableEvent(user, id);
  const { key, caption } = await parseJson(req, z.object({ key: z.string().max(400), caption: z.string().trim().max(200).optional() }));
  const upload = await assertEventUpload(event.id, key, ["GALLERY"]);
  if (!upload) throw badRequest("invalid_upload", "That file isn't available.");
  const count = await db.galleryImage.count({ where: { eventId: event.id } });
  if (count >= 40) throw badRequest("gallery_full", "A gallery can hold up to 40 photos.");
  const image = await db.galleryImage.create({
    data: { eventId: event.id, storageKey: upload.key, width: upload.width ?? 0, height: upload.height ?? 0, caption: caption || null, sortOrder: count },
  });
  return ok({ image: { ...image, url: await mediaUrl(image.storageKey) } }, { status: 201 });
});

/** Reorder: body { order: [imageId, ...] } */
export const PATCH = route<Ctx>("events.gallery.reorder", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getEditableEvent(user, id);
  const { order } = await parseJson(req, z.object({ order: z.array(z.string()).max(40) }));
  await db.$transaction(order.map((imageId, i) => db.galleryImage.updateMany({ where: { id: imageId, eventId: event.id }, data: { sortOrder: i } })));
  return ok();
});
