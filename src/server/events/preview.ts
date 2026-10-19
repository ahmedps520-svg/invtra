import type { Event } from "@prisma/client";
import { db } from "@/server/db";
import { mediaUrl } from "@/server/storage";
import type { CardImage } from "@/lib/card/build";
import type { CardPreviewProps, CardView } from "@/lib/card/view";
import { isUnlocked, PREVIEW_WIDTH } from "@/server/render/preview";
import { cardContent, eventDesign } from "./design";

export type { CardPreviewProps, CardView };

async function image(key: string | null | undefined, w?: number | null, h?: number | null): Promise<CardImage | null> {
  if (!key) return null;
  const href = await mediaUrl(key);
  if (!href) return null;
  if (!w || !h) {
    const u = await db.upload.findUnique({ where: { key }, select: { width: true, height: true } });
    w = u?.width ?? 1080;
    h = u?.height ?? 1350;
  }
  return { href, width: w, height: h };
}

/**
 * How pages may show the event's invitation. Until an order is approved only the protected preview
 * image is offered — the card's drawing and the original images stay on the server. Staff pages
 * pass `full` (admins can always see what they're checking).
 */
export async function cardView(event: Event, opts: { full?: boolean } = {}): Promise<CardView> {
  if (opts.full || isUnlocked(event)) return { locked: false, ...(await cardPreviewProps(event)) };
  const custom = event.imageMode === "CUSTOM" && event.customImageWidth && event.customImageHeight;
  const height = custom ? Math.round((PREVIEW_WIDTH * event.customImageHeight!) / event.customImageWidth!) : 675;
  return { locked: true, src: `/api/events/${event.id}/preview?v=${event.contentVersion}-${event.updatedAt.getTime()}`, width: PREVIEW_WIDTH, height };
}

/** Everything <CardPreview> needs to draw an event's invitation in the browser (paid-for events and staff only). */
export async function cardPreviewProps(event: Event): Promise<CardPreviewProps> {
  const design = eventDesign(event);
  return {
    themeKey: event.themeKey,
    design,
    language: event.language,
    content: cardContent(event, design),
    backgroundImage: design.background.mode === "image" ? await image(design.background.imageKey) : null,
    customImage: event.imageMode === "CUSTOM" ? await image(event.customImageKey, event.customImageWidth, event.customImageHeight) : null,
  };
}
