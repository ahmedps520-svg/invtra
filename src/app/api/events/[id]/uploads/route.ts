import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { badRequest, ok, requireApiUser, route } from "@/server/http";
import { getEditableEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { saveUpload, uploadView } from "@/server/uploads";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = ["COVER", "GALLERY", "LOGO", "BACKGROUND", "CUSTOM_INVITATION", "MUSIC", "REFERENCE"] as const;
/** Inspiration images for a custom design request. */
const MAX_REFERENCES = 5;

export const POST = route<Ctx>("events.upload", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getEditableEvent(user, id);
  await enforceRateLimit(`upload:${user.id}`, 120, 3600);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");
  if (!(file instanceof File)) throw badRequest("missing_file", "Choose a file to upload.");
  if (!(KINDS as readonly string[]).includes(kind)) throw badRequest("invalid_kind", "Unknown upload type.");
  if (kind === "REFERENCE" && (await db.upload.count({ where: { eventId: event.id, kind: "REFERENCE" } })) >= MAX_REFERENCES) {
    throw badRequest("too_many_files", `You can add up to ${MAX_REFERENCES} reference images.`);
  }
  const data = Buffer.from(await file.arrayBuffer());
  // Files belong to the event's host, also when INVTRA staff upload them while designing a custom event.
  const upload = await saveUpload({ userId: event.userId, eventId: event.id, kind: kind as (typeof KINDS)[number], data });
  return ok({ upload: await uploadView(upload) }, { status: 201 });
});
