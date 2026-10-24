"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import type { EventType } from "@prisma/client";
import type { Locale } from "@/lib/i18n/config";
import { buttonClasses } from "@/components/ui/button";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleLang, sampleSrc } from "@/lib/marketing/samples";
import { DEMO_GUEST, withDigits } from "@/lib/marketing/demo-copy";
import { startHref } from "@/lib/marketing/links";
import type { ThemeKey } from "@/lib/themes/types";
import { Choices } from "./choices";

const LiveCard = dynamic(() => import("./live-card").then((m) => m.LiveCard), { ssr: false });

type Language = "EN" | "AR" | "BILINGUAL";

/**
 * "Make it personal", preset to one occasion: the visitor types a guest's name and picks a design,
 * language and numerals, and the real card (with that guest's own QR) updates as they go.
 */
export function PersonalPreview({
  occasion,
  designs,
  locale,
  signedIn,
  copy,
}: {
  occasion: EventType;
  designs: { key: ThemeKey; name: string }[];
  locale: Locale;
  signedIn: boolean;
  copy: {
    title: string;
    body: string;
    name: string;
    namePlaceholder: string;
    seats: string;
    fewer: string;
    more: string;
    design: string;
    language: string;
    languages: Record<Language, string>;
    numerals: string;
    numeralsNote: string;
    qrNote: string;
    start: string;
    example: string;
  };
}) {
  const id = useId();
  const [name, setName] = useState(DEMO_GUEST[locale]);
  const [seats, setSeats] = useState(2);
  const [theme, setTheme] = useState<ThemeKey>(designs[0].key);
  const [language, setLanguage] = useState<Language>(locale === "ar" ? "AR" : "EN");
  const [digits, setDigits] = useState<"arab" | "latn">("arab");
  const [live, setLive] = useState(false);
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setLive(true);
    set(v);
  };
  const guestName = name.trim().slice(0, 28) || DEMO_GUEST[locale];
  const qrText = useMemo(() => {
    const origin = typeof window === "undefined" ? "https://invtra.store" : window.location.origin;
    return `${origin}/designs/${theme}/demo?${new URLSearchParams({ guest: guestName, seats: String(seats), lang: language }).toString()}`;
  }, [guestName, seats, language, theme]);
  const designName = designs.find((d) => d.key === theme)?.name ?? "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] md:gap-10">
      <div className="relative mx-auto w-full max-w-[22rem]">
        <span className="absolute -top-3 start-4 z-10 rounded-full border border-hairline bg-cream px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-gold-deep uppercase rtl:text-[12px]">
          {copy.example}
        </span>
        <div className="ivx-foil relative aspect-[4/5] overflow-hidden rounded-[5px] bg-cream-deep shadow-lift ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample in this occasion's wording */}
          <img src={sampleSrc(theme, sampleLang(language), occasion)} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" className="block h-full w-full" />
          {live ? (
            <div className="absolute inset-0">
              <LiveCard
                theme={theme}
                language={language}
                digits={digits}
                occasion={occasion}
                guest={{ name: guestName, allowedCount: seats }}
                qrText={qrText}
                title={`${copy.design}: ${designName}`}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="ivx-paper ivx-grain p-5 sm:p-6">
        <div className="relative">
          <h2 className="font-display text-[1.75rem] leading-tight text-ink">{copy.title}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{copy.body}</p>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div>
              <label htmlFor={`${id}-name`} className="text-[13px] font-medium text-ink">
                {copy.name}
              </label>
              <input
                id={`${id}-name`}
                value={name}
                maxLength={28}
                autoComplete="off"
                placeholder={copy.namePlaceholder}
                onChange={(e) => touch(setName)(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-hairline bg-[#fffcf6] px-4 text-[16px] text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
            </div>
            <div>
              <span id={`${id}-seats`} className="text-[13px] font-medium text-ink">
                {copy.seats}
              </span>
              <div role="group" aria-labelledby={`${id}-seats`} className="mt-1.5 flex h-12 items-center rounded-xl border border-hairline bg-[#fffcf6]">
                <button type="button" aria-label={copy.fewer} disabled={seats <= 1} onClick={() => touch(setSeats)(seats - 1)} className="flex size-11 items-center justify-center text-ink-soft disabled:opacity-35">
                  <Minus className="size-4" />
                </button>
                <output aria-live="polite" className="w-5 text-center text-[16px] tabular-nums text-ink">
                  {locale === "ar" ? withDigits(String(seats), "arab") : seats}
                </output>
                <button type="button" aria-label={copy.more} disabled={seats >= 9} onClick={() => touch(setSeats)(seats + 1)} className="flex size-11 items-center justify-center text-ink-soft disabled:opacity-35">
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </div>
          {designs.length > 1 ? (
            <Choices label={copy.design} value={theme} onChange={touch(setTheme)} options={designs.map((d) => ({ value: d.key, label: d.name }))} className="mt-5" scroll />
          ) : null}
          <div className="mt-4 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
            <Choices
              label={copy.language}
              value={language}
              onChange={touch(setLanguage)}
              options={(["AR", "EN", "BILINGUAL"] as Language[]).map((l) => ({ value: l, label: copy.languages[l], lang: l === "AR" ? "ar" : undefined }))}
              segmented
            />
            <Choices
              label={copy.numerals}
              value={digits}
              onChange={touch(setDigits)}
              disabled={language === "EN"}
              hint={copy.numeralsNote}
              options={[
                { value: "arab", label: "١٢", lang: "ar" },
                { value: "latn", label: "12" },
              ]}
              segmented
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <p className="text-[12px] text-ink-faint">{copy.qrNote}</p>
            <Link href={startHref(signedIn, { theme, occasion })} className={buttonClasses("primary", "md", "group h-11")}>
              {copy.start}
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
