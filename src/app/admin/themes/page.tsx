import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/guards";
import { listThemes } from "@/server/admin/themes";
import { ThemeControls } from "@/components/admin/theme-controls";
import { PageHeader } from "@/components/admin/ui";
import { plural } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { CardPreview } from "@/components/invitation/card-preview";
import { themes as copy } from "@/lib/i18n/dictionaries/en/themes";

export const metadata: Metadata = { title: "Themes" };

export default async function ThemesPage() {
  await requireAdmin();
  const themes = await listThemes();

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Themes"
        description="Invitation themes are designed in code; here you control which are offered, which need Premium, and the order customers see them in."
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => (
          <article key={t.key} className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition ${t.isActive ? "" : "opacity-75"}`}>
            <div className="border-b border-line bg-ivory/70 p-5">
              <CardPreview themeKey={t.key} className="mx-auto max-w-[220px] rounded-lg shadow-lift" title={`${copy[t.key].name} theme preview`} />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-ink">{copy[t.key].name}</h2>
                  <p className="mt-0.5 text-[12.5px] text-ink-faint">Designed for {copy.recommendedFor[t.recommendedLanguage]}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {t.isActive ? <Badge tone="sage">Available</Badge> : <Badge>Hidden</Badge>}
                  {t.isPremium ? <Badge tone="bronze">Premium</Badge> : null}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{copy[t.key].description}</p>
              <p className="mt-3 text-[13px] text-ink-faint">
                {t.events ? (
                  <Link href={`/admin/events?theme=${t.key}`} className="underline-offset-4 hover:text-ink hover:underline">
                    Used by {plural(t.events, "event")}
                  </Link>
                ) : (
                  "Not used by any event yet"
                )}
                {!t.configured ? " · default settings" : ""}
              </p>
              <div className="mt-5 border-t border-line pt-5">
                <ThemeControls themeKey={t.key} isActive={t.isActive} isPremium={t.isPremium} sortOrder={t.sortOrder} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
