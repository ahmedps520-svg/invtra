import type { Event, Guest, Invitation } from "@prisma/client";
import { db } from "@/server/db";
import { storage } from "@/server/storage";
import { renderSvgToPng } from "@/server/render/card";
import { buildCardSvg, buildCustomCardSvg, type CardImage } from "@/lib/card/build";
import { CARD_PHRASES } from "@/lib/invitation-copy";
import { cardContent, eventDesign, eventTheme } from "@/server/events/design";
import { invitationQrText, personalImageVersion, teaserImageVersion } from "./index";
import { eventForGuest, sectionFor } from "@/server/events/sections";
import { sectionDiffers } from "@/lib/sections";

type RenderEvent = Event;

/**
 * The card variant for a guest: their section's key when it prints a different time or
 * place (men's and women's cards differ), otherwise null (everyone shares the main card).
 */
export function cardVariant(event: RenderEvent, guest: Partial<Pick<Guest, "section">> | null | undefined): string | null {
  const s = sectionFor(event, guest);
  return s && sectionDiffers(s.details) ? s.key : null;
}

async function loadImage(key: string | null | undefined, width?: number | null, height?: number | null): Promise<CardImage | null> {
  if (!key) return null;
  const data = await storage().get(key);
  if (!data) return null;
  const mime = key.endsWith(".png") ? "image/png" : "image/jpeg";
  let w = width ?? 0;
  let h = height ?? 0;
  if (!w || !h) {
    const upload = await db.upload.findUnique({ where: { key }, select: { width: true, height: true } });
    w = upload?.width ?? 1080;
    h = upload?.height ?? 1350;
  }
  return { href: `data:${mime};base64,${data.toString("base64")}`, width: w, height: h };
}

/** Builds the card SVG for an event (optionally personalised for a guest). */
export async function buildEventCardSvg(
  event: RenderEvent,
  opts: { guest?: Pick<Guest, "name" | "allowedCount"> | null; qrText?: string | null; qrPlaceholder?: boolean },
): Promise<string> {
  const design = eventDesign(event);
  if (event.imageMode === "CUSTOM" && event.customImageKey) {
    const image = await loadImage(event.customImageKey, event.customImageWidth, event.customImageHeight);
    if (image) {
      const lang = event.language === "AR" ? "ar" : "en";
      return buildCustomCardSvg({
        image,
        design,
        qrText: opts.qrText,
        qrPlaceholder: opts.qrPlaceholder,
        caption: opts.qrText || opts.qrPlaceholder ? CARD_PHRASES[lang].scan : undefined,
      }).svg;
    }
  }
  const backgroundImage = design.background.mode === "image" ? await loadImage(design.background.imageKey) : null;
  return buildCardSvg({
    theme: eventTheme(event),
    design,
    language: event.language,
    content: cardContent(event, design),
    guest: opts.guest ?? null,
    qrText: opts.qrText ?? null,
    qrPlaceholder: opts.qrPlaceholder,
    backgroundImage,
  });
}

/**
 * The guest's personalised invitation image (with their unique QR). Rendered once
 * per content version and cached in object storage.
 */
export async function renderPersonalInvitation(
  event: RenderEvent,
  guest: Pick<Guest, "id" | "name" | "allowedCount"> & Partial<Pick<Guest, "section">>,
  invitation: Pick<Invitation, "id" | "token" | "imageKey" | "imageVersion">,
): Promise<{ key: string; version: string; png: Buffer }> {
  const variant = cardVariant(event, guest);
  const version = personalImageVersion(event, guest, invitation.token, variant);
  if (invitation.imageKey && invitation.imageVersion === version) {
    const cached = await storage().get(invitation.imageKey);
    if (cached) return { key: invitation.imageKey, version, png: cached };
  }
  const svg = await buildEventCardSvg(variant ? eventForGuest(event, guest) : event, { guest, qrText: invitationQrText(invitation.token) });
  const png = renderSvgToPng(svg);
  const key = `renders/${event.id}/${invitation.id}-${version}.png`;
  await storage().put(key, png, "image/png");
  if (invitation.imageKey && invitation.imageKey !== key) await storage().delete(invitation.imageKey).catch(() => undefined);
  await db.invitation.update({ where: { id: invitation.id }, data: { imageKey: key, imageVersion: version } });
  return { key, version, png };
}

/** Non-personal image (no QR) used as the header of the Accept/Decline message and for link previews. */
export async function renderTeaser(
  event: RenderEvent,
  guest?: Partial<Pick<Guest, "section">> | null,
): Promise<{ key: string; version: string; png: Buffer; variant: string | null }> {
  const variant = cardVariant(event, guest);
  const version = teaserImageVersion(event, variant);
  const key = `renders/${event.id}/teaser-${version}.png`;
  const cached = await storage().get(key);
  if (cached) return { key, version, png: cached, variant };
  const svg = await buildEventCardSvg(variant ? eventForGuest(event, guest) : event, { guest: null, qrText: null, qrPlaceholder: false });
  const png = renderSvgToPng(svg);
  await storage().put(key, png, "image/png");
  return { key, version, png, variant };
}
