import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { getTheme } from "@/lib/themes/registry";
import type { Locale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/routing";
import { getOccasionPage } from "@/lib/seo/occasion-pages";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc } from "@/lib/marketing/samples";
import { Carousel } from "./carousel";
import { SectionHeading } from "./section-heading";
import { CONTAINER } from "./styles";

/** A little line drawing for the "any occasion" tile. */
const DRAWN: Record<string, (c: string) => string> = {
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

/** The occasions, each shown on the painted design its page features. */
const TILES = ["wedding", "engagement", "henna-night", "newborn", "baby-shower", "aqiqah", "birthday", "graduation", "anniversary", "ramadan-eid", "corporate"];

/** "Not just weddings" — every occasion INVTRA designs for (anchor: #occasions). */
export function Occasions({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.marketing.occasions;
  const h = dict.marketing.home.occasions;
  const any = getTheme("peony").defaults.palette;

  const tiles = TILES.map((slug) => {
    const page = getOccasionPage(slug)!;
    const theme = getTheme(page.theme);
    const palette = theme.defaults.palette;
    return (
      <Link
        key={slug}
        href={localePath(locale, `/invitations/${slug}`)}
        className="group relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[1.375rem] p-6 ring-1 ring-black/5 transition-[translate,box-shadow] duration-500 ease-luxe hover:-translate-y-1 hover:shadow-lift"
        style={{ background: palette.background, color: palette.text }}
      >
        <div aria-hidden="true" className="flex h-44 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample invitation for the occasion */}
          <img
            src={sampleSrc(page.theme, locale === "ar" ? "ar" : "en", page.type)}
            width={SAMPLE_WIDTH}
            height={SAMPLE_HEIGHT}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-auto -rotate-3 rounded-[3px] shadow-[0_18px_30px_-16px_rgb(30_26_22/0.55)] ring-1 ring-black/5 transition-transform duration-700 ease-luxe group-hover:rotate-0 group-hover:scale-[1.04] rtl:rotate-3"
          />
        </div>
        <h3 className="mt-4 font-display text-[1.6rem] leading-tight">{page[locale].nav}</h3>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed" style={{ color: readable(palette.muted, palette.text, palette.background) }}>
          {h.bodies[slug]}
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
      <div className="flex h-44 items-center justify-center">
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
