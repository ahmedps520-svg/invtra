import type { Event } from "@prisma/client";
import { db } from "@/server/db";
import { mediaUrl } from "@/server/storage";
import type { CardContent, CardImage, CardLanguage } from "@/lib/card/build";
import type { InvitationDesign } from "@/lib/design/schema";
import { cardContent, eventDesign } from "./design";

export interface CardPreviewProps {
  themeKey: string;
  design: InvitationDesign;
  language: CardLanguage;
  content: CardContent;
  backgroundImage: CardImage | null;
  customImage: CardImage | null;
}

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

/** Everything <CardPreview> needs to draw an event's invitation in the browser. */
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
