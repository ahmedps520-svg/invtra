import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { OccasionGroup } from "@/lib/events/types";
import { heroMotif } from "@/lib/card/hero-motifs";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { CONTAINER } from "./styles";

type Key = keyof Dictionary["marketing"]["occasions"]["items"];

/** Each occasion tile is drawn in the design made for it, with that design's illustration. */
const TILES: { key: Key; theme: ThemeKey; group: OccasionGroup; size: number }[] = [
  { key: "newborn", theme: "teddy", group: "baby", size: 236 },
  { key: "shower", theme: "clouds", group: "baby", size: 220 },
  { key: "aqiqah", theme: "moonlight", group: "baby", size: 200 },
  { key: "weddings", theme: "royal", group: "weddings", size: 116 },
  { key: "henna", theme: "henna", group: "weddings", size: 124 },
  { key: "birthdays", theme: "confetti", group: "celebrations", size: 240 },
  { key: "ramadan", theme: "lantern", group: "community", size: 220 },
  { key: "anniversaries", theme: "garden", group: "weddings", size: 230 },
];

/** "Not just weddings" — the occasions INVTRA designs for (anchor: #occasions). */
export function Occasions({ dict }: { dict: Dictionary }) {
  const t = dict.marketing.occasions;
  return (
    <section id="occasions" aria-labelledby="occasions-title" className="scroll-mt-20 border-t border-line/70 py-24 sm:py-32">
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow={t.eyebrow}
          title={
            <span id="occasions-title">
              {t.title} <span className="text-bronze-600 italic rtl:not-italic">{t.titleAccent}</span>
            </span>
          }
          body={t.body}
        />

        <ul className="mt-14 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {TILES.map((tile, i) => {
            const palette = getTheme(tile.theme).defaults.palette;
            const art = heroMotif(getTheme(tile.theme).page.motif!, palette);
            const copy = t.items[tile.key];
            return (
              <li key={tile.key}>
                <Reveal delay={(i % 4) * 70} className="h-full">
                  <Link
                    href={`/designs?occasion=${tile.group}`}
                    className="group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] p-6 ring-1 ring-black/5 transition-all duration-500 ease-luxe hover:-translate-y-1 hover:shadow-lift"
                    style={{ background: palette.background, color: palette.text }}
                  >
                    <div className="flex h-36 items-center justify-center">
                      <div
                        aria-hidden="true"
                        className="transition-transform duration-700 ease-luxe group-hover:scale-[1.04]"
                        style={{ width: tile.size, maxWidth: "88%" }}
                        dangerouslySetInnerHTML={{ __html: art.svg }}
                      />
                    </div>
                    <h3 className="mt-5 font-display text-[1.6rem] leading-tight">{copy.title}</h3>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed" style={{ color: palette.muted }}>
                      {copy.body}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium">
                      {t.cta}
                      <ArrowRight
                        className={cn("size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5")}
                        style={{ color: palette.accent }}
                      />
                    </span>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>

        <Reveal className="mt-10 text-center">
          <p className="font-display text-xl text-ink-soft italic rtl:not-italic">{t.more}</p>
        </Reveal>
      </div>
    </section>
  );
}
