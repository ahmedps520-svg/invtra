import type { NextRequest } from "next/server";
import { badRequest, ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { saveUpload, uploadView } from "@/server/uploads";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = ["COVER", "GALLERY", "LOGO", "BACKGROUND", "CUSTOM_INVITATION", "MUSIC"] as const;

export const POST = route<Ctx>("events.upload", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  await enforceRateLimit(`upload:${user.id}`, 120, 3600);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");
  if (!(file instanceof File)) throw badRequest("missing_file", "Choose a file to upload.");
  if (!(KINDS as readonly string[]).includes(kind)) throw badRequest("invalid_kind", "Unknown upload type.");
  const data = Buffer.from(await file.arrayBuffer());
  const upload = await saveUpload({ userId: user.id, eventId: event.id, kind: kind as (typeof KINDS)[number], data });
  return ok({ upload: await uploadView(upload) }, { status: 201 });
});
