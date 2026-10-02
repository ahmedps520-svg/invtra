import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { eventDesign } from "@/server/events/design";
import { assertOwnedUpload } from "@/server/uploads";
import { staleAcceptedCount } from "@/server/sending/service";
import { deepMerge, designPatchSchema, designSchema } from "@/lib/design/schema";
import { getTheme, isThemeKey } from "@/lib/themes/registry";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  themeKey: z.string().optional(),
  /** When switching theme: keep the customer's texts/sections but adopt the theme's palette & fonts. */
  resetStyle: z.boolean().optional(),
  design: designPatchSchema.optional(),
  imageMode: z.enum(["GENERATED", "CUSTOM"]).optional(),
  customImageKey: z.string().max(400).nullable().optional(),
  coverImageKey: z.string().max(400).nullable().optional(),
  logoKey: z.string().max(400).nullable().optional(),
  musicKey: z.string().max(400).nullable().optional(),
});

/** Save the design editor. Anything that changes the printed card bumps contentVersion. */
export const PATCH = route<Ctx>("events.design", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const body = await parseJson(req, bodySchema);

  let themeKey = event.themeKey;
  if (body.themeKey !== undefined) {
    if (!isThemeKey(body.themeKey)) throw badRequest("invalid_theme", "Unknown theme.");
    const row = await db.invitationTheme.findUnique({ where: { key: body.themeKey } });
    if (row && !row.isActive) throw badRequest("theme_unavailable", "This design is not available.");
    themeKey = body.themeKey;
  }
  let design = eventDesign(event);
  if (themeKey !== event.themeKey && body.resetStyle !== false) {
    const t = getTheme(themeKey).defaults;
    design = { ...design, palette: t.palette, fonts: t.fonts, animation: t.animation, card: { ...design.card, qr: { ...design.card.qr, style: t.card.qr.style } } };
  }
  if (body.design) design = designSchema.parse(deepMerge(design, body.design));
  if (design.background.imageKey) await assertOwnedUpload(user.id, event.id, design.background.imageKey, ["BACKGROUND", "COVER"]);

  const custom = body.customImageKey !== undefined ? await assertOwnedUpload(user.id, event.id, body.customImageKey, ["CUSTOM_INVITATION"]) : undefined;
  if (body.coverImageKey) await assertOwnedUpload(user.id, event.id, body.coverImageKey, ["COVER", "BACKGROUND"]);
  if (body.logoKey) await assertOwnedUpload(user.id, event.id, body.logoKey, ["LOGO"]);
  if (body.musicKey) await assertOwnedUpload(user.id, event.id, body.musicKey, ["MUSIC"]);
  const imageMode = body.imageMode ?? event.imageMode;

  const data: Prisma.EventUpdateInput = {
    themeKey,
    design: design as unknown as Prisma.InputJsonValue,
    imageMode,
    ...(custom !== undefined ? { customImageKey: custom?.key ?? null, customImageWidth: custom?.width ?? null, customImageHeight: custom?.height ?? null } : {}),
    ...(body.coverImageKey !== undefined ? { coverImageKey: body.coverImageKey } : {}),
    ...(body.logoKey !== undefined ? { logoKey: body.logoKey } : {}),
    ...(body.musicKey !== undefined ? { musicKey: body.musicKey } : {}),
  };
  const cardChanged =
    themeKey !== event.themeKey ||
    imageMode !== event.imageMode ||
    (custom !== undefined && (custom?.key ?? null) !== event.customImageKey) ||
    JSON.stringify(design) !== JSON.stringify(eventDesign(event));
  if (cardChanged) data.contentVersion = { increment: 1 };
  const updated = await db.event.update({ where: { id: event.id }, data });
  return ok({ design, themeKey, imageMode: updated.imageMode, cardChanged, staleAccepted: await staleAcceptedCount(updated) });
});
