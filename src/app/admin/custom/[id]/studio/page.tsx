import type { Metadata } from "next";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { customStepPage } from "@/server/custom/pages";
import { cardContent, eventDesign } from "@/server/events/design";
import { STUDIO_UPLOAD_KINDS } from "@/server/studio/access";
import { uploadView } from "@/server/uploads";
import { getDictionary } from "@/lib/i18n";
import { ACTIVE_THEME_LIST } from "@/lib/themes/registry";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Studio · Custom event" };

/**
 * INVTRA Studio for a custom event: staff design the card freely (every piece of a design can be
 * moved, changed or removed; flowers, gold, photos, text and shapes added). Opens full screen.
 */
export default async function CustomStudioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { event } = await customStepPage(id, "studio");
  const design = eventDesign(event);
  const rows = await db.upload.findMany({
    where: { eventId: event.id, kind: { in: STUDIO_UPLOAD_KINDS } },
    orderBy: { createdAt: "desc" },
  });
  const uploads = await Promise.all(rows.map((u) => uploadView(u)));
  const names = getDictionary("en").themes as unknown as Record<string, { name?: string } | undefined>;
  const themes = ACTIVE_THEME_LIST.map((t) => ({ key: t.key, name: names[t.key]?.name ?? t.key, occasions: t.occasions }));
  const customImage =
    event.imageMode === "CUSTOM" && event.customImageKey
      ? { key: event.customImageKey, width: event.customImageWidth ?? 1080, height: event.customImageHeight ?? 1350 }
      : null;
  return (
    <Studio
      event={{
        id: event.id,
        title: event.title,
        type: event.type,
        language: event.language,
        themeKey: event.themeKey,
        qrOn: design.card.qr.enabled !== false && event.product !== "PHOTO_ONLY",
      }}
      design={design}
      content={cardContent(event, design)}
      canvas={design.canvas}
      uploads={uploads}
      themes={themes}
      backHref={`/admin/custom/${event.id}/design`}
      customImage={customImage}
    />
  );
}
