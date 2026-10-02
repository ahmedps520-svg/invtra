"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { buttonClasses } from "@/components/ui/button";

export type ShowcaseItem = {
  key: string;
  name: string;
  premium: boolean;
  language: "EN" | "AR" | "BILINGUAL";
  languageLabel: string;
};

/** Horizontally scrolling gallery of the live-rendered invitation themes. */
export function DesignsShowcase({ items, premiumLabel }: { items: ShowcaseItem[]; premiumLabel: string }) {
  const { dict, dir } = useI18n();
  const t = dict.marketing.designs;
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = Math.abs(el.scrollLeft); // negative in RTL
    setEdges({ start: x < 8, end: x > max - 8 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const raf = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const scroll = (towards: "start" | "end") => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = (card?.getBoundingClientRect().width ?? 280) + 24;
    const sign = (towards === "end" ? 1 : -1) * (dir === "rtl" ? -1 : 1);
    el.scrollBy({ left: sign * step * 2, behavior: "smooth" });
  };

  return (
    <div>
      <ul
        ref={track}
        className="scrollbar-none flex snap-x snap-mandatory gap-6 overflow-x-auto px-[max(1.25rem,calc((100vw-80rem)/2+2rem))] pb-10 pt-2 scroll-px-[max(1.25rem,calc((100vw-80rem)/2+2rem))] sm:gap-8"
      >
        {items.map((it) => (
          <li key={it.key} className="w-[72vw] max-w-[290px] shrink-0 snap-start sm:w-[290px]">
            <Link href={`/designs/${it.key}`} className="group block rounded-lg outline-offset-4">
              <div className="relative overflow-hidden rounded-[6px] bg-paper shadow-soft ring-1 ring-black/5 transition-all duration-700 ease-luxe group-hover:-translate-y-1.5 group-hover:shadow-lift">
                <CardPreview themeKey={it.key} language={it.language} title={it.name} />
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="font-display text-2xl leading-none text-ink">{it.name}</span>
                {it.premium ? (
                  <span className="rounded-full border border-bronze-200 bg-bronze-50 px-2.5 py-0.5 text-[11px] font-medium text-bronze-700">
                    {premiumLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] text-ink-faint">{it.languageLabel}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/designs" className={buttonClasses("outline", "md", "group")}>
          {t.cta}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scroll("start")}
            disabled={edges.start}
            aria-label={t.previous}
            className="flex size-11 items-center justify-center rounded-full border border-line-strong text-ink transition hover:border-bronze-400 hover:bg-paper disabled:pointer-events-none disabled:opacity-35"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => scroll("end")}
            disabled={edges.end}
            aria-label={t.next}
            className="flex size-11 items-center justify-center rounded-full border border-line-strong text-ink transition hover:border-bronze-400 hover:bg-paper disabled:pointer-events-none disabled:opacity-35"
          >
            <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
