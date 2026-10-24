import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { heroMotif } from "@/lib/card/hero-motifs";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import type { Locale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/routing";
import { getOccasionPage } from "@/lib/seo/occasion-pages";
import { Carousel } from "./carousel";
import { SectionHeading } from "./section-heading";
import { CONTAINER } from "./styles";

/** Little line drawings for the occasions whose designs have no illustration of their own. */
const DRAWN: Record<string, (c: string) => string> = {
  rings: (c) =>
    `<svg viewBox="0 0 120 80" fill="none" stroke="${c}" stroke-width="2.2"><circle cx="48" cy="48" r="20"/><circle cx="72" cy="48" r="20"/><path d="M60 14l6 7-6 7-6-7z" fill="${c}" fill-opacity=".25"/><path d="M60 8v3M50 12l2 2M70 12l-2 2" stroke-linecap="round"/></svg>`,
  cap: (c) =>
    `<svg viewBox="0 0 120 80" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"><path d="M60 16l44 17-44 17-44-17z"/><path d="M34 41v14c0 6 12 11 26 11s26-5 26-11V41"/><path d="M104 33v20" stroke-linecap="round"/><circle cx="104" cy="56" r="3" fill="${c}"/></svg>`,
  gala: (c) =>
    `<svg viewBox="0 0 120 80" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"><path d="M60 10l5 17 17 5-17 5-5 17-5-17-17-5 17-5z" fill="${c}" fill-opacity=".18"/><path d="M92 46l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M28 44l2.4 6.6L37 53l-6.6 2.4L28 62l-2.4-6.6L19 53l6.6-2.4z"/></svg>`,
  any: (c) =>
    `<svg viewBox="0 0 120 80" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M60 14v52M34 40h52M42 22l36 36M78 22L42 58"/><circle cx="60" cy="40" r="7" fill="${c}" fill-opacity=".2"/></svg>`,
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** The design's muted colour, moved toward its ink until it reads at 4.5:1 on the tile (WCAG AA). */
function readable(muted: string, ink: string, bg: string): string {
  const [m, k] = [rgb(muted), rgb(ink)];
  for (let t = 0; t <= 1; t += 0.1) {
    const c = `#${m.map((v, i) => Math.round(v + (k[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
    if (contrast(c, bg) >= 4.5) return c;
  }
  return ink;
}

/** Each tile is drawn in the design made for it. */
const TILES: { slug: string; theme: ThemeKey; drawn?: keyof typeof DRAWN; size: number }[] = [
  { slug: "wedding", theme: "royal", size: 72 },
  { slug: "engagement", theme: "romantic", drawn: "rings", size: 120 },
  { slug: "henna-night", theme: "henna", size: 112 },
  { slug: "newborn", theme: "teddy", size: 200 },
  { slug: "baby-shower", theme: "clouds", size: 190 },
  { slug: "aqiqah", theme: "moonlight", size: 170 },
  { slug: "birthday", theme: "confetti", size: 210 },
  { slug: "graduation", theme: "modern", drawn: "cap", size: 120 },
  { slug: "anniversary", theme: "garden", size: 200 },
  { slug: "ramadan-eid", theme: "lantern", size: 190 },
  { slug: "corporate", theme: "luxury", drawn: "gala", size: 120 },
];

/** "Not just weddings" — every occasion INVTRA designs for (anchor: #occasions). */
export function Occasions({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.marketing.occasions;
  const h = dict.marketing.home.occasions;
  const any = getTheme("minimal").defaults.palette;

  const tiles = TILES.map((tile) => {
    const palette = getTheme(tile.theme).defaults.palette;
    const motif = getTheme(tile.theme).page.motif;
    const art = tile.drawn ? DRAWN[tile.drawn](palette.accent) : motif ? heroMotif(motif, palette).svg : "";
    const page = getOccasionPage(tile.slug)!;
    return (
      <Link
        key={tile.slug}
        href={localePath(locale, `/invitations/${tile.slug}`)}
        className="group relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[1.375rem] p-6 ring-1 ring-black/5 transition-[translate,box-shadow] duration-500 ease-luxe hover:-translate-y-1 hover:shadow-lift"
        style={{ background: palette.background, color: palette.text }}
      >
        <div className="flex h-32 items-center justify-center">
          <div
            aria-hidden="true"
            className="transition-transform duration-700 ease-luxe group-hover:scale-[1.05] [&>svg]:h-auto [&>svg]:w-full"
            style={{ width: tile.size, maxWidth: "86%" }}
            dangerouslySetInnerHTML={{ __html: art }}
          />
        </div>
        <h3 className="mt-4 font-display text-[1.6rem] leading-tight">{page[locale].nav}</h3>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed" style={{ color: readable(palette.muted, palette.text, palette.background) }}>
          {h.bodies[tile.slug]}
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium">
          {h.cta}
          <ArrowRight
            className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            style={{ color: palette.accent }}
          />
        </span>
      </Link>
    );
  });

  tiles.push(
    <Link
      key="any"
      href={localePath(locale, "/invitations")}
      className="group relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[1.375rem] border border-dashed border-gold/60 p-6 transition-[translate,box-shadow] duration-500 ease-luxe hover:-translate-y-1 hover:shadow-lift"
      style={{ background: any.background }}
    >
      <div className="flex h-32 items-center justify-center">
        <div aria-hidden="true" className="w-[110px] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: DRAWN.any("#b0905a") }} />
      </div>
      <h3 className="mt-4 font-display text-[1.6rem] leading-tight text-ink">{h.any.title}</h3>
      <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-soft">{h.any.body}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-gold-deep">
        {t.page.all}
        <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
      </span>
    </Link>,
  );

  return (
    <section id="occasions" aria-labelledby="occasions-title" className="scroll-mt-20 py-16 sm:py-28">
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow={t.eyebrow}
          title={
            <span id="occasions-title">
              {t.title} <span className="text-gold-deep italic rtl:not-italic">{t.titleAccent}</span>
            </span>
          }
          body={t.body}
        />
        <Carousel
          className="mt-12 sm:mt-14"
          labels={{ previous: h.previous, next: h.next, goTo: h.goTo }}
          itemClassName="w-[78%] sm:w-[46%] md:w-[38%]"
          gridClassName="lg:grid-cols-4 lg:gap-5"
        >
          {tiles}
        </Carousel>
      </div>
    </section>
  );
}
