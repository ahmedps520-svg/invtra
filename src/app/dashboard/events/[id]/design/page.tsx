import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { findOwnedEvent } from "@/server/events/access";
import { cardContent } from "@/server/events/design";
import { cardPreviewProps } from "@/server/events/preview";
import { staleAcceptedCount } from "@/server/sending/service";
import { mediaUrl } from "@/server/storage";
import { uploadView } from "@/server/uploads";
import { getI18n } from "@/server/i18n";
import { pickNamespaces } from "@/lib/i18n";
import { planAllowsTheme } from "@/lib/plans";
import { THEME_KEYS, THEME_LIST, getTheme } from "@/lib/themes/registry";
import { I18nProvider } from "@/components/i18n/provider";
import { DesignEditor } from "@/components/editor/design-editor";
import type { EditorProps } from "@/components/editor/types";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.editor.meta.title };
}

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/design`);
  const event = await findOwnedEvent(user.id, id);
  if (!event) notFound();

  const [{ locale }, preview, uploadRows, galleryRows, themeRows, scheduleCount, staleAccepted] = await Promise.all([
    getI18n(),
    cardPreviewProps(event),
    db.upload.findMany({ where: { eventId: event.id, userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.galleryImage.findMany({ where: { eventId: event.id }, orderBy: { sortOrder: "asc" } }),
    db.invitationTheme.findMany(),
    db.scheduleItem.count({ where: { eventId: event.id } }),
    staleAcceptedCount(event),
  ]);

  const design = preview.design;
  const rows = new Map(themeRows.map((r) => [r.key, r]));
  const theme = getTheme(event.themeKey);
  const order = (key: string) => rows.get(key)?.sortOrder ?? THEME_KEYS.indexOf(key as (typeof THEME_KEYS)[number]);
  // Designs made for this occasion come first (a newborn sees Teddy, Clouds, Moonlight…), then the rest.
  const fit = (t: (typeof THEME_LIST)[number]) => {
    const i = t.occasions.indexOf(event.type);
    return i < 0 ? 99 : Math.min(i, 2);
  };
  const themes = THEME_LIST.filter((t) => (rows.get(t.key)?.isActive ?? true) || t.key === theme.key)
    .sort((a, b) => fit(a) - fit(b) || order(a.key) - order(b.key))
    .map((t) => ({ key: t.key, premium: rows.get(t.key)?.isPremium ?? t.premium, suggested: fit(t) <= 1 }));

  const props: EditorProps = {
    event: {
      id: event.id,
      type: event.type,
      language: event.language,
      hostNames: event.hostNames,
      hostNamesAr: event.hostNamesAr,
      plan: event.plan,
      hasSchedule: scheduleCount > 0,
      hasDetails: Boolean(
        event.dressCode || event.dressCodeAr || event.notes || event.notesAr || event.parkingInfo || event.accommodationInfo || event.specialInstructions,
      ),
      hasContact: Boolean(event.contactName || event.contactPhone || event.contactEmail),
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
    premiumIncluded: planAllowsTheme(event.plan, true),
    staleAccepted,
  };

  return (
    <I18nProvider locale={locale} dict={pickNamespaces(locale, ["editor", "themes"])}>
      <DesignEditor {...props} />
    </I18nProvider>
  );
}
