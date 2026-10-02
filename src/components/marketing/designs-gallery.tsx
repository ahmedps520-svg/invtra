"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, Eye } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { buttonClasses } from "@/components/ui/button";
import { Segmented } from "@/components/ui/toggle";
import { fmt } from "@/lib/i18n/config";
import type { CardLanguage } from "@/lib/card/build";
import { OCCASION_GROUP_KEYS, type OccasionGroup } from "@/lib/events/types";
import { cn } from "@/lib/utils";

export type GalleryItem = {
  key: string;
  name: string;
  description: string;
  premium: boolean;
  recommendedLanguage: CardLanguage;
  useHref: string;
  /** Occasion families the design suits → rank (0 = designed first and foremost for it). */
  occasions: Partial<Record<OccasionGroup, number>>;
};

type Filter = OccasionGroup | "all";

/** All invitation themes, rendered live, with a preview-language switch. */
export function DesignsGallery({
  items,
  labels,
  extra,
  initialOccasion = "all",
}: {
  items: GalleryItem[];
  initialOccasion?: Filter;
  /** Rendered as the closing tile of the grid. */
  extra?: ReactNode;
  labels: { premium: string; languages: Record<CardLanguage, string>; languageNames: Record<CardLanguage, string> };
}) {
  const { dict, locale } = useI18n();
  const t = dict.marketing.designsPage;
  const [language, setLanguage] = useState<CardLanguage>(locale === "ar" ? "AR" : "EN");
  const [occasion, setOccasion] = useState<Filter>(initialOccasion);
  const shown =
    occasion === "all"
      ? items
      : items.filter((it) => it.occasions[occasion] !== undefined).sort((a, b) => a.occasions[occasion]! - b.occasions[occasion]!);
  const choose = (next: Filter) => {
    setOccasion(next);
    // Keep the address shareable without a navigation.
    window.history.replaceState(null, "", next === "all" ? "/designs" : `/designs?occasion=${next}`);
  };

  return (
    <div>
      <div role="radiogroup" aria-label={t.filters.label} className="mb-10 flex flex-wrap justify-center gap-2">
        {(["all", ...OCCASION_GROUP_KEYS] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={occasion === f}
            onClick={() => choose(f)}
            className={cn(
              "rounded-full border px-4 py-2 text-[13.5px] font-medium transition-all duration-300 ease-luxe",
              occasion === f ? "border-ink bg-ink text-ivory shadow-soft" : "border-line-strong bg-paper/70 text-ink-soft hover:border-bronze-400 hover:text-ink",
            )}
          >
            {t.filters[f]}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        <span id="preview-language" className="text-[12px] text-ink-faint">
          {t.languageLabel}
        </span>
        <div aria-labelledby="preview-language" role="group">
          <Segmented<CardLanguage>
            value={language}
            onChange={setLanguage}
            options={(["EN", "AR", "BILINGUAL"] as const).map((v) => ({
              value: v,
              label: (
                <span lang={v === "AR" ? "ar" : v === "EN" ? "en" : undefined} className="px-1">
                  {labels.languages[v]}
                </span>
              ),
            }))}
          />
        </div>
      </div>

      <ul className="mt-14 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
        {shown.map((it) => (
          <li key={it.key} className="group flex flex-col">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-line bg-sand/70 px-[12%] py-[10%] transition-colors duration-700 ease-luxe group-hover:bg-mist/70">
              <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0" />
              <div
                key={language}
                className="relative animate-fade-up overflow-hidden rounded-[4px] shadow-lift ring-1 ring-black/5 transition-transform duration-700 ease-luxe group-hover:-translate-y-1.5"
              >
                <CardPreview themeKey={it.key} language={language} title={fmt(t.previewOf, { name: it.name })} />
              </div>
              {it.premium ? (
                <span className="absolute end-4 top-4 rounded-full border border-bronze-200 bg-paper/90 px-2.5 py-0.5 text-[11px] font-medium text-bronze-700 backdrop-blur">
                  {labels.premium}
                </span>
              ) : null}
            </div>

            <div className="mt-6 flex flex-1 flex-col">
              <h2 className="font-display text-[1.9rem] leading-none text-ink">{it.name}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{it.description}</p>
              <p className="mt-3 text-[12.5px] text-ink-faint">
                {fmt(t.designedFor, { language: labels.languageNames[it.recommendedLanguage] })}
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5 pt-1">
                <Link href={it.useHref} className={buttonClasses("primary", "md", "group/btn")}>
                  {t.use}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5 rtl:rotate-180 rtl:group-hover/btn:-translate-x-0.5" />
                </Link>
                <Link
                  href={`/designs/${it.key}`}
                  className={cn(buttonClasses("outline", "md"))}
                  aria-label={`${t.preview} — ${it.name}`}
                >
                  <Eye className="size-4" strokeWidth={1.5} />
                  {t.preview}
                </Link>
              </div>
            </div>
          </li>
        ))}
        {extra ? <li className="sm:col-span-2 lg:col-span-2">{extra}</li> : null}
      </ul>
    </div>
  );
}
