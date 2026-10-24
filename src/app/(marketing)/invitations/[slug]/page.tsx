import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Quote } from "lucide-react";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { sendingMode } from "@/server/marketing";
import { OCCASION_PAGES, getOccasionPage } from "@/lib/seo/occasion-pages";
import { occasionCopy } from "@/lib/seo/occasion-sending";
import { OCCASION_WORDING } from "@/lib/seo/occasion-wording";
import { THEME_LIST } from "@/lib/themes/registry";
import { localePath } from "@/lib/i18n/routing";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc } from "@/lib/marketing/samples";
import { startHref } from "@/lib/marketing/links";
import { buttonClasses } from "@/components/ui/button";
import { Carousel } from "@/components/marketing/carousel";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqList } from "@/components/marketing/faq";
import { PersonalPreview } from "@/components/marketing/personal-preview";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CONTAINER, EYEBROW } from "@/components/marketing/styles";
import { breadcrumbLd, faqLd, jsonLdHtml, pageMetadata, siteUrl } from "@/components/marketing/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return OCCASION_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getOccasionPage(slug);
  if (!page) return {};
  const { locale } = await getI18n();
  const c = page[locale];
  return pageMetadata({ locale, path: `/invitations/${slug}`, title: c.title, description: c.description, image: slug });
}

/** Landing page for one occasion — what people search for ("newborn hospital visit invitation"…). */
export default async function OccasionPage({ params }: Props) {
  const { slug } = await params;
  const page = getOccasionPage(slug);
  if (!page) notFound();
  const [{ dict, locale }, user, nonce] = await Promise.all([getI18n(), getSessionUser(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  const signedIn = Boolean(user);
  const mode = sendingMode();
  const c = occasionCopy(page, locale, mode);
  const t = dict.marketing.occasions.page;
  const h = dict.marketing.home;
  const lp = (href: string) => localePath(locale, href);
  const ctaHref = startHref(signedIn, { occasion: page.type });
  const lang = locale === "ar" ? "ar" : "en";

  // Designs made for this occasion, the most fitting first (the page's own design leads).
  const designs = THEME_LIST.filter((th) => th.occasions.includes(page.type))
    .sort((a, b) => (a.key === page.theme ? -1 : b.key === page.theme ? 1 : a.occasions.indexOf(page.type) - b.occasions.indexOf(page.type)))
    .slice(0, 8);
  const related = page.related.map((s) => getOccasionPage(s)!).filter(Boolean);
  const wording = OCCASION_WORDING[slug]?.[locale] ?? [];

  const jsonLd = jsonLdHtml([
    breadcrumbLd(
      [
        { name: "INVTRA", path: "/" },
        { name: dict.common.nav.occasions, path: "/invitations" },
        { name: c.nav, path: `/invitations/${slug}` },
      ],
      locale,
    ),
    {
      "@type": "WebPage",
      "@id": `${siteUrl(lp(`/invitations/${slug}`))}#page`,
      name: c.title,
      description: c.description,
      inLanguage: locale,
      isPartOf: { "@id": `${siteUrl()}/#website` },
      about: { "@id": `${siteUrl()}/#service` },
    },
    faqLd(c.faq, locale),
  ]);

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <section id="top" className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(60%_100%_at_75%_0%,var(--color-gold-soft),transparent)] opacity-80" />
        <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0 opacity-40" />
        <div className={`${CONTAINER} relative grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-16 pt-8 sm:pt-14 lg:grid-cols-12 lg:gap-10 lg:pb-24`}>
          <div className="lg:col-span-7">
            <nav aria-label="Breadcrumb" className="text-[13px] text-ink-faint">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href={lp("/")} className="hover:text-ink">
                    INVTRA
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={lp("/invitations")} className="hover:text-ink">
                    {dict.common.nav.occasions}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-ink-soft">
                  {c.nav}
                </li>
              </ol>
            </nav>
            <h1 className="mt-6 font-display text-[2.55rem] font-normal leading-[1.06] text-balance text-ink sm:text-6xl rtl:leading-[1.3]">{c.h1}</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-soft sm:text-lg">{c.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={ctaHref} className={buttonClasses("primary", "lg", "group")}>
                {dict.marketing.hero.primary}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
              <Link href="#personalise" className={buttonClasses("outline", "lg", "border-hairline bg-cream/60")}>
                {h.occasionPage.preview}
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-ink-soft">
              {dict.marketing.hero.assurances.map((a) => (
                <li key={a} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-gold-deep" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
          {/* A fan of this occasion's designs, in its own wording */}
          <div aria-hidden="true" className="relative mx-auto h-[23rem] w-full max-w-[25rem] sm:h-[27rem] lg:col-span-5">
            {designs.slice(0, 3).map((th, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample
              <img
                key={th.key}
                src={sampleSrc(th.key, lang, page.type)}
                width={SAMPLE_WIDTH}
                height={SAMPLE_HEIGHT}
                alt=""
                fetchPriority={i === 0 ? "high" : undefined}
                loading={i === 0 ? undefined : "lazy"}
                className="absolute top-0 h-auto w-[62%] rounded-[5px] shadow-lift ring-1 ring-black/5"
                style={{
                  insetInlineStart: ["19%", "0%", "38%"][i],
                  top: ["0", "2.2rem", "2.2rem"][i],
                  rotate: ["0deg", "-7deg", "7deg"][i],
                  zIndex: [3, 1, 2][i],
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="personalise" aria-label={h.occasionPage.preview} className="scroll-mt-24 border-y border-hairline/70 bg-[#fffcf6] py-16 sm:py-24">
        <div className={CONTAINER}>
          <PersonalPreview
            occasion={page.type}
            designs={designs.slice(0, 4).map((d) => ({ key: d.key, name: dict.themes[d.key].name }))}
            locale={locale}
            signedIn={signedIn}
            copy={{ ...h.studio, title: h.occasionPage.preview, example: h.hero.example }}
          />
        </div>
      </section>

      <section aria-label={c.nav} className="py-16 sm:py-24">
        <ul className={`${CONTAINER} grid gap-10 md:grid-cols-3`}>
          {c.points.map((p, i) => (
            <li key={p.title}>
              <Reveal delay={i * 70}>
                <span className="font-display text-4xl font-light text-gold tabular-nums" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-3 font-display text-[1.7rem] leading-tight text-ink">{p.title}</h2>
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{p.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section id="designs" aria-labelledby="designs-title" className="scroll-mt-20 border-t border-hairline/70 bg-[linear-gradient(180deg,var(--color-cream-deep),var(--color-cream)_70%)] py-16 sm:py-24">
        <div className={CONTAINER}>
          <SectionHeading eyebrow={c.nav} title={<span id="designs-title">{t.designsTitle}</span>} body={t.designsBody} />
          <Carousel
            className="mt-12"
            labels={{ previous: h.designs.previous, next: h.designs.next, goTo: h.designs.goTo }}
            itemClassName="w-[70%] sm:w-[42%] md:w-[32%]"
            gridClassName="lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10"
          >
            {designs.map((th) => (
              <Link key={th.key} href={lp(`/designs/${th.key}`)} className="group block rounded-lg outline-offset-4">
                <div className="overflow-hidden rounded-[5px] bg-cream-deep shadow-soft ring-1 ring-black/5 transition-[translate,box-shadow] duration-700 ease-luxe group-hover:-translate-y-1.5 group-hover:shadow-lift">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                  <img src={sampleSrc(th.key, lang, page.type)} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt={dict.themes[th.key].name} loading="lazy" decoding="async" className="block h-auto w-full" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <h3 className="font-display text-[1.45rem] leading-none text-ink">{dict.themes[th.key].name}</h3>
                  {th.premium ? (
                    <span className="rounded-full border border-gold/40 bg-gold-soft/60 px-2.5 py-0.5 text-[11px] font-medium text-gold-deep">{dict.themes.premium}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-faint">{dict.themes[th.key].description}</p>
              </Link>
            ))}
          </Carousel>
        </div>
      </section>

      {wording.length ? (
        <section id="wording" aria-labelledby="wording-title" className="scroll-mt-20 py-16 sm:py-24">
          <div className={CONTAINER}>
            <SectionHeading eyebrow={c.nav} title={<span id="wording-title">{h.occasionPage.wording}</span>} body={h.occasionPage.wordingBody} />
            <ul className="mt-12 grid gap-5 md:grid-cols-3">
              {wording.map((w, i) => (
                <li key={w}>
                  <Reveal delay={i * 70} className="h-full">
                    <figure className="ivx-paper-light ivx-grain h-full p-6 sm:p-7">
                      <Quote className="relative size-5 text-gold rtl:-scale-x-100" strokeWidth={1.4} aria-hidden="true" />
                      <blockquote className="relative mt-4 font-display text-[1.45rem] leading-snug text-ink rtl:leading-relaxed">{w}</blockquote>
                    </figure>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="how-title" className="border-t border-hairline/70 bg-[#fffcf6] py-16 sm:py-24">
        <div className={CONTAINER}>
          <SectionHeading eyebrow={dict.marketing.how.eyebrow} title={<span id="how-title">{dict.marketing.how.title}</span>} />
          <ol className="mt-12 grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-8 lg:grid-cols-5">
            {dict.marketing.how.steps.map((s, i) => (
              <li key={s.title} className={i === 4 ? "col-span-2 lg:col-span-1" : undefined}>
                <Reveal delay={i * 50}>
                  <span className="font-display text-3xl font-light text-gold tabular-nums" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-display text-xl text-ink">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-hairline/70 py-16 sm:py-24">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-12 lg:gap-10`}>
          <div className="lg:col-span-4">
            <Reveal className="lg:sticky lg:top-28">
              <p className={EYEBROW}>{t.faqTitle}</p>
              <h2 id="faq-title" className="mt-4 font-display text-[2.2rem] leading-[1.1] text-balance text-ink">
                {c.title}
              </h2>
            </Reveal>
          </div>
          <FaqList className="lg:col-span-8" items={c.faq} />
        </div>
      </section>

      <section id="related" aria-labelledby="related-title" className="scroll-mt-20 border-t border-hairline/70 py-14 sm:py-20">
        <div className={`${CONTAINER} grid gap-10 md:grid-cols-2`}>
          <div>
            <h2 id="related-title" className={EYEBROW}>
              {t.related}
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={lp(`/invitations/${r.slug}`)} className="inline-flex h-11 items-center rounded-full border border-hairline bg-[#fffcf6] px-5 text-[14.5px] text-ink transition hover:border-gold">
                    {r[locale].nav}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={lp("/invitations")} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14.5px] text-gold-deep underline-offset-4 hover:underline">
                  {t.all}
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={EYEBROW}>{h.footer.designs}</h2>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {designs.slice(0, 5).map((th) => (
                <li key={th.key}>
                  <Link href={lp(`/designs/${th.key}`)} className="inline-flex h-11 items-center rounded-full border border-hairline bg-[#fffcf6] px-5 text-[14.5px] text-ink transition hover:border-gold">
                    {dict.themes[th.key].name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={lp("/designs")} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14.5px] text-gold-deep underline-offset-4 hover:underline">
                  {h.footer.allDesigns}
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="bg-cream pt-4">
        <CtaBand dict={dict} ctaHref={ctaHref} secondary={{ href: lp("/pricing"), label: dict.marketing.cta.secondary }} mode={mode} locale={locale} />
      </div>
    </>
  );
}
