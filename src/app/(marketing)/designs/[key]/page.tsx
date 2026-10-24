import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowRight, Eye, Sparkles } from "lucide-react";
import { db } from "@/server/db";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { sendingMode } from "@/server/marketing";
import { THEME_LIST, getTheme, isThemeKey } from "@/lib/themes/registry";
import { OCCASION_PAGES } from "@/lib/seo/occasion-pages";
import { THEME_STYLE } from "@/lib/marketing/design-styles";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc } from "@/lib/marketing/samples";
import { startHref } from "@/lib/marketing/links";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/config";
import { buttonClasses } from "@/components/ui/button";
import { Carousel } from "@/components/marketing/carousel";
import { CtaBand } from "@/components/marketing/cta-band";
import { DesignPreview } from "@/components/marketing/design-preview";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CONTAINER, EYEBROW } from "@/components/marketing/styles";
import { breadcrumbLd, jsonLdHtml, pageMetadata, siteUrl } from "@/components/marketing/seo";

type Props = { params: Promise<{ key: string }> };

export function generateStaticParams() {
  return THEME_LIST.map((t) => ({ key: t.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  if (!isThemeKey(key)) return {};
  const { dict, locale } = await getI18n();
  const theme = getTheme(key);
  const occasions = theme.occasions
    .filter((o) => o !== "OTHER")
    .slice(0, 3)
    .map((o) => dict.common.eventTypes[o])
    .join(locale === "ar" ? "، " : ", ");
  const title = locale === "ar" ? `تصميم دعوة «${dict.themes[key].name}» — ${occasions}` : `${dict.themes[key].name} Invitation Design — ${occasions}`;
  return pageMetadata({ locale, path: `/designs/${key}`, title, description: dict.themes[key].description, image: key });
}

/** One design: a large live preview in every language, the occasions it suits and similar designs. */
export default async function DesignPage({ params }: Props) {
  const { key } = await params;
  if (!isThemeKey(key)) notFound();
  const row = await db.invitationTheme.findUnique({ where: { key }, select: { isActive: true } });
  if (row && !row.isActive) notFound();
  const [{ dict, locale }, user, nonce] = await Promise.all([getI18n(), getSessionUser(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  const signedIn = Boolean(user);
  const theme = getTheme(key);
  const t = dict.marketing.home.design;
  const h = dict.marketing.home;
  const lp = (href: string) => localePath(locale, href);
  const name = dict.themes[key].name;
  const occasions = OCCASION_PAGES.filter((p) => theme.occasions.includes(p.type));
  const initial = theme.recommendedLanguage !== "EN" ? theme.recommendedLanguage : locale === "ar" ? "AR" : "EN";
  const lang = locale === "ar" ? "ar" : "en";
  const languages = { EN: dict.common.language.en, AR: dict.common.language.ar, BILINGUAL: dict.common.language.bilingual };

  // Similar: the same look first, then designs that share its occasions.
  const shared = (k: (typeof THEME_LIST)[number]) => k.occasions.filter((o) => theme.occasions.includes(o)).length;
  const similar = THEME_LIST.filter((th) => th.key !== key)
    .sort((a, b) => Number(THEME_STYLE[b.key] === THEME_STYLE[key]) * 10 + shared(b) - (Number(THEME_STYLE[a.key] === THEME_STYLE[key]) * 10 + shared(a)))
    .slice(0, 4);

  const jsonLd = jsonLdHtml([
    breadcrumbLd(
      [
        { name: "INVTRA", path: "/" },
        { name: dict.marketing.designsPage.title, path: "/designs" },
        { name, path: `/designs/${key}` },
      ],
      locale,
    ),
    {
      "@type": "CreativeWork",
      "@id": `${siteUrl(lp(`/designs/${key}`))}#design`,
      name: `${name} — ${t.eyebrow}`,
      description: dict.themes[key].description,
      image: siteUrl(sampleSrc(key, lang)),
      inLanguage: ["en", "ar"],
      creator: { "@id": `${siteUrl()}/#organization` },
    },
  ]);

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <section id="top" className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60%_100%_at_70%_0%,var(--color-gold-soft),transparent)] opacity-80" />
        <div className={`${CONTAINER} relative grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-16 pt-8 sm:pt-14 lg:grid-cols-12 lg:gap-12 lg:pb-24`}>
          <div className="lg:col-span-6">
            <nav aria-label="Breadcrumb" className="text-[13px] text-ink-faint">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href={lp("/")} className="hover:text-ink">
                    INVTRA
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={lp("/designs")} className="hover:text-ink">
                    {dict.marketing.designsPage.title}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-ink-soft">
                  {name}
                </li>
              </ol>
            </nav>
            <p className={`${EYEBROW} mt-6 text-gold-deep!`}>{t.eyebrow}</p>
            <h1 className="mt-3 font-display text-[3rem] font-normal leading-[1.02] text-ink sm:text-7xl">{name}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-soft sm:text-lg">{dict.themes[key].description}</p>
            <p className="mt-5 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full border border-gold/40 bg-gold-soft/60 px-3 py-1 font-medium text-gold-deep">{theme.premium ? t.premium : t.included}</span>
              <span className="rounded-full border border-hairline bg-[#fffcf6] px-3 py-1 text-ink-soft">{h.designs.styles[THEME_STYLE[key]]}</span>
              <span className="rounded-full border border-hairline bg-[#fffcf6] px-3 py-1 text-ink-soft">{dict.themes.recommendedFor[theme.recommendedLanguage]}</span>
            </p>
            {occasions.length ? (
              <div className="mt-7">
                <p className="text-[13px] font-medium text-ink">{t.suits}</p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {occasions.map((o) => (
                    <li key={o.slug}>
                      <Link href={lp(`/invitations/${o.slug}`)} className="inline-flex h-10 items-center rounded-full border border-hairline bg-[#fffcf6] px-4 text-[14px] text-ink transition hover:border-gold">
                        {o[locale].nav}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={startHref(signedIn, { theme: key, occasion: theme.occasions.find((o) => o !== "OTHER") ?? null })} className={buttonClasses("primary", "lg", "group")}>
                <Sparkles className="size-4" strokeWidth={1.6} />
                {t.start}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
              <Link href={`/designs/${key}/demo?lang=${initial}`} className={buttonClasses("outline", "lg", "border-hairline bg-cream/60")}>
                <Eye className="size-4" strokeWidth={1.5} />
                {t.guestPage}
              </Link>
            </div>
          </div>
          <div className="lg:col-span-6">
            <DesignPreview theme={key} initial={initial} label={t.languageLabel} languages={languages} alt={fmt(t.previewLabel, { name, language: "{language}" })} />
          </div>
        </div>
      </section>

      <section aria-labelledby="similar-title" className="border-t border-hairline/70 bg-[linear-gradient(180deg,var(--color-cream-deep),var(--color-cream)_70%)] py-16 sm:py-24">
        <div className={CONTAINER}>
          <SectionHeading title={<span id="similar-title">{t.similar}</span>} />
          <Carousel
            className="mt-12"
            labels={{ previous: h.designs.previous, next: h.designs.next, goTo: h.designs.goTo }}
            itemClassName="w-[70%] sm:w-[42%] md:w-[32%]"
            gridClassName="lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10"
          >
            {similar.map((th) => (
              <Link key={th.key} href={lp(`/designs/${th.key}`)} className="group block rounded-lg outline-offset-4">
                <div className="overflow-hidden rounded-[5px] bg-cream-deep shadow-soft ring-1 ring-black/5 transition-[translate,box-shadow] duration-700 ease-luxe group-hover:-translate-y-1.5 group-hover:shadow-lift">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                  <img src={sampleSrc(th.key, th.recommendedLanguage === "BILINGUAL" ? "bi" : th.recommendedLanguage === "AR" ? "ar" : lang)} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt={dict.themes[th.key].name} loading="lazy" decoding="async" className="block h-auto w-full" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <h3 className="font-display text-[1.45rem] leading-none text-ink">{dict.themes[th.key].name}</h3>
                  {th.premium ? <span className="rounded-full border border-gold/40 bg-gold-soft/60 px-2.5 py-0.5 text-[11px] font-medium text-gold-deep">{dict.themes.premium}</span> : null}
                </div>
                <p className="mt-1 text-[13px] text-ink-faint">{h.designs.styles[THEME_STYLE[th.key]]}</p>
              </Link>
            ))}
          </Carousel>
          <div className="mt-10 flex justify-center">
            <Link href={lp("/designs")} className={buttonClasses("outline", "lg", "group")}>
              {t.all}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <div className="bg-cream pt-16">
        <CtaBand dict={dict} ctaHref={startHref(signedIn, { theme: key })} secondary={{ href: lp("/pricing"), label: dict.marketing.cta.secondary }} mode={sendingMode()} locale={locale} />
      </div>
    </>
  );
}
