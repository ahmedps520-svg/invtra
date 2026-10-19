import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Event } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, notFound, parseJson, requireApiUser, route } from "@/server/http";
import { findGuestAccess } from "@/server/events/cohosts";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { assertEventUpload } from "@/server/uploads";
import { previewResponse, renderProtectedPreview } from "@/server/render/preview";
import { normalizeDesign } from "@/lib/design/schema";
import { getTheme, isThemeKey } from "@/lib/themes/registry";

type Ctx = { params: Promise<{ id: string }> };

/** The host, a co-host or INVTRA staff. */
async function viewable(userId: string, role: string, eventId: string): Promise<Event> {
  if (role === "ADMIN") {
    const e = await db.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (e) return e;
  }
  const access = await findGuestAccess({ id: userId }, eventId);
  if (!access) throw notFound("Event");
  return access.event;
}

/**
 * Protected preview of the saved invitation: a small JPEG stamped "PREVIEW ONLY · LOW RESOLUTION".
 * This is all the browser gets of a design that hasn't been paid for.
 */
export const GET = route<Ctx>("events.preview", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await viewable(user.id, user.role, id);
  return previewResponse(await renderProtectedPreview(event));
});

const draftSchema = z.object({
  themeKey: z.string().max(40),
  design: z.unknown(),
  imageMode: z.enum(["GENERATED", "CUSTOM"]),
  customImageKey: z.string().max(400).nullable().optional(),
});

/** The same for the editor's unsaved draft, so changes show while editing. */
export const POST = route<Ctx>("events.preview.draft", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`preview:${user.id}`, 600, 600);
  const event = await viewable(user.id, user.role, id);
  const body = await parseJson(req, draftSchema);
  if (!isThemeKey(body.themeKey)) throw badRequest("invalid_theme", "Unknown theme.");
  const design = normalizeDesign(getTheme(body.themeKey).defaults, body.design);
  if (design.background.imageKey) await assertEventUpload(event.id, design.background.imageKey, ["BACKGROUND", "COVER"]);
  const custom = body.imageMode === "CUSTOM" && body.customImageKey ? await assertEventUpload(event.id, body.customImageKey, ["CUSTOM_INVITATION"]) : null;
  const jpeg = await renderProtectedPreview(event, {
    themeKey: body.themeKey,
    design: design as unknown as Event["design"],
    imageMode: custom ? "CUSTOM" : "GENERATED",
    customImageKey: custom?.key ?? null,
    customImageWidth: custom?.width ?? null,
    customImageHeight: custom?.height ?? null,
  });
  return previewResponse(jpeg, { cache: "private" });
});
