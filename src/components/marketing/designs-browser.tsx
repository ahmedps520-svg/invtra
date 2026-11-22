"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/routing";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc, type SampleLang } from "@/lib/marketing/samples";
import { DESIGN_STYLES, type DesignStyle } from "@/lib/marketing/design-style-list";
import type { OccasionGroup } from "@/lib/events/types";
import { cn } from "@/lib/utils";
import { Carousel } from "./carousel";

export type BrowserItem = {
  key: string;
  name: string;
  premium: boolean;
  style: DesignStyle;
  language: "EN" | "AR" | "BILINGUAL";
  groups: OccasionGroup[];
  /** The group of the occasion the design is mainly made for. */
  primary: OccasionGroup | null;
};

type Lang = BrowserItem["language"];

/** The homepage starts with eight designs, the designs page with a page of them; "Show more" adds a page. */
const PREVIEW_COUNT = 8;
const PAGE = 24;

/** The catalogue with filters: a swipe carousel on phones, a grid on larger screens. */
export function DesignsBrowser({
  items,
  locale,
  copy,
  initialGroup = null,
  capped = true,
}: {
  items: BrowserItem[];
  locale: Locale;
  initialGroup?: OccasionGroup | null;
  /** Start with eight designs instead of a full page (homepage). */
  capped?: boolean;
  copy: {
    occasion: string;
    occasions: Record<"all" | OccasionGroup, string>;
    style: string;
    styles: Record<DesignStyle, string>;
    language: string;
    languages: Record<Lang, string>;
    premium: string;
    premiumBadge: string;
    all: string;
    clear: string;
    count: string;
    none: string;
    previous: string;
    next: string;
    goTo: string;
    filters: string;
    showMore: string;
  };
}) {
  const first = capped ? PREVIEW_COUNT : PAGE;
  const [group, setGroupState] = useState<OccasionGroup | null>(initialGroup);
  const [style, setStyleState] = useState<DesignStyle | null>(null);
  const [language, setLanguageState] = useState<Lang | null>(null);
  const [premium, setPremiumState] = useState(false);
  const [limit, setLimit] = useState(first);
  // A new filter starts again from the first page.
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimit(first);
  };
  const setGroup = reset(setGroupState);
  const setStyle = reset(setStyleState);
  const setLanguage = reset(setLanguageState);
  const setPremium = reset(setPremiumState);

  const shown = useMemo(() => {
    const out = items.filter(
      (it) => (!group || it.groups.includes(group)) && (!style || it.style === style) && (!language || it.language === language) && (!premium || it.premium),
    );
    // With an occasion picked, designs made mainly for it come first (sort is stable, so the showcase order holds within).
    return group ? out.sort((a, b) => Number(b.primary === group) - Number(a.primary === group)) : out;
  }, [items, group, style, language, premium]);
  const filtered = Boolean(group || style || language || premium);
  const clear = () => {
    setGroupState(null);
    setStyleState(null);
    setLanguageState(null);
    setPremiumState(false);
    setLimit(first);
  };
  const visible = shown.slice(0, limit);
  const more = Math.min(PAGE, shown.length - visible.length);
  const preview = (l: Lang): SampleLang => (l === "BILINGUAL" ? "bi" : l === "AR" || locale === "ar" ? "ar" : "en");

  return (
    <div>
      <div role="group" aria-label={copy.filters} className="space-y-2.5">
        <Chips
          label={copy.occasion}
          options={(["weddings", "baby", "celebrations", "community"] as OccasionGroup[]).map((g) => ({ value: g, label: copy.occasions[g] }))}
          value={group}
          onChange={setGroup}
          allLabel={copy.occasions.all}
        />
        <div className="scrollbar-none ivx-fade-end -mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 pe-10 sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
          <ChipRow label={copy.style} options={DESIGN_STYLES.map((s) => ({ value: s, label: copy.styles[s] }))} value={style} onChange={setStyle} />
          <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-hairline" />
          <ChipRow
            label={copy.language}
            options={(["AR", "EN", "BILINGUAL"] as Lang[]).map((l) => ({ value: l, label: copy.languages[l] }))}
            value={language}
            onChange={setLanguage}
          />
          <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-hairline" />
          <button type="button" aria-pressed={premium} onClick={() => setPremium(!premium)} className={chip(premium)}>
            {copy.premium}
          </button>
        </div>
        <div className="flex min-h-8 items-center justify-between gap-3 pt-1 text-[13px] text-ink-faint">
          <span aria-live="polite">{copy.count.replace("{n}", String(shown.length))}</span>
          {filtered ? (
            <button type="button" onClick={clear} className="font-medium text-gold-deep underline-offset-4 hover:underline">
              {copy.clear}
            </button>
          ) : null}
        </div>
      </div>

      {shown.length ? (
        <Carousel
          key={[group, style, language, premium].join(",")}
          className="mt-5"
          labels={{ previous: copy.previous, next: copy.next, goTo: copy.goTo }}
          itemClassName="w-[70%] sm:w-[42%] md:w-[32%]"
          gridClassName="lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10"
        >
          {visible.map((it) => (
            <Link key={it.key} href={localePath(locale, `/designs/${it.key}`)} className="group block rounded-lg outline-offset-4">
              <div className="relative overflow-hidden rounded-[5px] bg-cream-deep shadow-soft ring-1 ring-black/5 transition-[translate,box-shadow] duration-700 ease-luxe group-hover:-translate-y-1.5 group-hover:shadow-lift">
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                <img src={sampleSrc(it.key, preview(it.language))} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt={it.name} loading="lazy" decoding="async" className="block h-auto w-full" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="font-display text-[1.45rem] leading-none text-ink">{it.name}</span>
                {it.premium ? (
                  <span className="rounded-full border border-gold/40 bg-gold-soft/60 px-2.5 py-0.5 text-[11px] font-medium text-gold-deep">{copy.premiumBadge}</span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] text-ink-faint">
                {copy.styles[it.style]} · {copy.languages[it.language]}
              </p>
            </Link>
          ))}
        </Carousel>
      ) : null}
      {more > 0 ? (
        <div className="mt-8 flex justify-center lg:mt-10">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="h-11 rounded-full border border-hairline bg-[#fffcf6] px-6 text-[14px] font-medium text-ink transition hover:border-gold"
          >
            {copy.showMore.replace("{n}", String(more))}
          </button>
        </div>
      ) : null}
      {shown.length ? null : (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hairline px-6 py-14 text-center">
          <p className="font-display text-2xl text-ink">{copy.none}</p>
          <button type="button" onClick={clear} className="h-11 rounded-full border border-hairline px-5 text-[14px] text-ink transition hover:border-gold">
            {copy.clear}
          </button>
        </div>
      )}
    </div>
  );
}

const chip = (on: boolean) =>
  cn(
    "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[14px] transition-colors duration-300",
    on ? "bg-ink text-cream" : "border border-hairline bg-[#fffcf6] text-ink-soft hover:border-gold hover:text-ink",
  );

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)} className={chip(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  allLabel,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allLabel: string;
}) {
  return (
    <div role="group" aria-label={label} className="scrollbar-none ivx-fade-end -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 pe-10 sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={chip(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
