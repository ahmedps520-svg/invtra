import type { Event } from "@prisma/client";
import { db } from "@/server/db";
import { cardContent } from "@/server/events/design";
import { cardPreviewProps } from "@/server/events/preview";
import { staleAcceptedCount } from "@/server/sending/service";
import { mediaUrl } from "@/server/storage";
import { uploadView } from "@/server/uploads";
import { planAllowsTheme } from "@/lib/plans";
import { THEME_KEYS, THEME_LIST, getTheme } from "@/lib/themes/registry";
import type { EditorProps } from "@/components/editor/types";

/**
 * Everything the design editor needs for an event — used by the host's Design step and by
 * staff designing a custom event. `premiumIncluded` overrides the plan check (a custom
 * package includes every design).
 */
export async function editorProps(
  event: Event,
  opts: { premiumIncluded?: boolean; nav?: EditorProps["nav"]; detailsHref?: string; advanced?: boolean } = {},
): Promise<EditorProps> {
  const [
    preview,
    uploadRows,
    galleryRows,
    themeRows,
    scheduleCount,
    staleAccepted,
  ] = await Promise.all([
    cardPreviewProps(event),
    db.upload.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
    }),
    db.galleryImage.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
    }),
    db.invitationTheme.findMany(),
    db.scheduleItem.count({ where: { eventId: event.id } }),
    staleAcceptedCount(event),
  ]);

  const design = preview.design;
  const rows = new Map(themeRows.map((r) => [r.key, r]));
  const theme = getTheme(event.themeKey);
  const order = (key: string) =>
    rows.get(key)?.sortOrder ??
    THEME_KEYS.indexOf(key as (typeof THEME_KEYS)[number]);
  // Designs made for this occasion come first (a newborn sees Teddy, Clouds, Moonlight…), then the rest.
  const fit = (t: (typeof THEME_LIST)[number]) => {
    const i = t.occasions.indexOf(event.type);
    return i < 0 ? 99 : Math.min(i, 2);
  };
  const themes = THEME_LIST.filter(
    (t) => (rows.get(t.key)?.isActive ?? true) || t.key === theme.key,
  )
    .sort((a, b) => fit(a) - fit(b) || order(a.key) - order(b.key))
    .map((t) => ({
      key: t.key,
      premium: rows.get(t.key)?.isPremium ?? t.premium,
      suggested: fit(t) <= 1,
    }));

  return {
    event: {
      id: event.id,
      type: event.type,
      language: event.language,
      hostNames: event.hostNames,
      hostNamesAr: event.hostNamesAr,
      plan: event.plan,
      hasSchedule: scheduleCount > 0,
      hasDetails: Boolean(
        event.dressCode ||
        event.dressCodeAr ||
        event.notes ||
        event.notesAr ||
        event.parkingInfo ||
        event.accommodationInfo ||
        event.specialInstructions,
      ),
      hasContact: Boolean(
        event.contactName || event.contactPhone || event.contactEmail,
      ),
    },
    contentByDigits: {
      arab: cardContent(event, { ...design, digits: "arab" }),
      latn: cardContent(event, { ...design, digits: "latn" }),
    },
    initial: {
      themeKey: theme.key,
      design,
      imageMode: event.imageMode,
      customImageKey: event.customImageKey,
      coverImageKey: event.coverImageKey,
      logoKey: event.logoKey,
      musicKey: event.musicKey,
    },
    uploads: await Promise.all(uploadRows.map(uploadView)),
    gallery: await Promise.all(
      galleryRows.map(async (g) => ({
        id: g.id,
        storageKey: g.storageKey,
        url: await mediaUrl(g.storageKey),
        width: g.width,
        height: g.height,
        caption: g.caption,
      })),
    ),
    themes,
    premiumIncluded: opts.premiumIncluded ?? planAllowsTheme(event.plan, true),
    staleAccepted,
    nav: opts.nav,
    detailsHref: opts.detailsHref,
    advanced: opts.advanced ?? (event.custom || event.plan === "CUSTOM"),
  };
}
