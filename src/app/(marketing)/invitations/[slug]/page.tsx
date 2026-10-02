import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { OCCASION_PAGES, getOccasionPage } from "@/lib/seo/occasion-pages";
import { THEME_LIST } from "@/lib/themes/registry";
import { sampleCardContent } from "@/lib/card/sample";
import { localePath } from "@/lib/i18n/routing";
import { CardPreview } from "@/components/invitation/card-preview";
import { buttonClasses } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqList } from "@/components/marketing/faq";
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
  const [{ dict, locale }, user] = await Promise.all([getI18n(), getSessionUser()]);
  const c = page[locale];
  const t = dict.marketing.occasions.page;
  const lp = (href: string) => localePath(locale, href);
  const target = `/dashboard/events/new?occasion=${page.type}`;
  const ctaHref = user ? target : `/signup?next=${encodeURIComponent(target)}`;
  const language = locale === "ar" ? "AR" : "EN";
  const content = sampleCardContent(page.type);

  // Designs made for this occasion, the most fitting first.
  const designs = THEME_LIST.filter((th) => th.occasions.includes(page.type))
    .sort((a, b) => a.occasions.indexOf(page.type) - b.occasions.indexOf(page.type))
    .slice(0, 6);
  const related = page.related.map((s) => getOccasionPage(s)!).filter(Boolean);

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60%_100%_at_70%_0%,var(--color-bronze-100),transparent)] opacity-70" />
        <div className={`${CONTAINER} relative grid items-center gap-14 pb-20 pt-12 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pb-28`}>
          <div className="lg:col-span-7">
            <nav aria-label="Breadcrumb" className="text-[13px] text-ink-faint">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href={lp("/")} className="hover:text-ink">INVTRA</Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={lp("/invitations")} className="hover:text-ink">{dict.common.nav.occasions}</Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-ink-soft">{c.nav}</li>
              </ol>
            </nav>
            <h1 className="mt-6 font-display text-[2.6rem] font-normal leading-[1.06] text-balance text-ink sm:text-6xl">{c.h1}</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-soft sm:text-lg">{c.intro}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={ctaHref} className={buttonClasses("primary", "lg", "group")}>
                {dict.marketing.hero.primary}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
              <Link href="#designs" className={buttonClasses("outline", "lg")}>
                {dict.marketing.occasions.cta}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-ink-soft">
              {dict.marketing.hero.assurances.map((a) => (
                <li key={a} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-bronze-600" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-[360px] rotate-[1.5deg] overflow-hidden rounded-[6px] shadow-lift ring-1 ring-black/5 rtl:-rotate-[1.5deg]">
              <CardPreview themeKey={page.theme} language={language} content={content} title={c.h1} />
            </div>
          </div>
        </div>
      </section>

      <section aria-label={c.nav} className="border-t border-line/70 bg-paper py-20 sm:py-24">
        <ul className={`${CONTAINER} grid gap-10 md:grid-cols-3`}>
          {c.points.map((p, i) => (
            <li key={p.title}>
              <Reveal delay={i * 70}>
                <span className="font-display text-4xl font-light text-bronze-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-3 font-display text-[1.7rem] leading-tight text-ink">{p.title}</h2>
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{p.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section id="designs" aria-labelledby="designs-title" className="scroll-mt-20 border-t border-line/70 bg-[linear-gradient(180deg,var(--color-sand),var(--color-ivory)_70%)] py-24">
        <div className={CONTAINER}>
          <SectionHeading eyebrow={c.nav} title={<span id="designs-title">{t.designsTitle}</span>} body={t.designsBody} />
          <ul className="mt-14 grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-8 lg:grid-cols-3">
            {designs.map((th) => (
              <li key={th.key}>
                <Link href={lp(`/designs/${th.key}`)} className="group block">
                  <div className="overflow-hidden rounded-[6px] shadow-soft ring-1 ring-black/5 transition-all duration-700 ease-luxe group-hover:-translate-y-1.5 group-hover:shadow-lift">
                    <CardPreview lazy themeKey={th.key} language={language} content={content} title={dict.themes[th.key].name} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <h3 className="font-display text-xl text-ink sm:text-2xl">{dict.themes[th.key].name}</h3>
                    {th.premium ? (
                      <span className="rounded-full border border-bronze-200 bg-bronze-50 px-2.5 py-0.5 text-[11px] font-medium text-bronze-700">{dict.themes.premium}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-faint">{dict.themes[th.key].description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how-title" className="border-t border-line/70 py-24">
        <div className={CONTAINER}>
          <SectionHeading eyebrow={dict.marketing.how.eyebrow} title={<span id="how-title">{dict.marketing.how.title}</span>} />
          <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {dict.marketing.how.steps.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 50}>
                  <span className="font-display text-3xl font-light text-bronze-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-display text-xl text-ink">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="border-t border-line/70 bg-paper py-24">
        <div className={`${CONTAINER} grid gap-12 lg:grid-cols-12 lg:gap-10`}>
          <Reveal className="lg:col-span-4">
            <p className={EYEBROW}>{t.faqTitle}</p>
            <h2 id="faq-title" className="mt-4 font-display text-[2.3rem] leading-[1.1] text-balance text-ink">{c.title}</h2>
          </Reveal>
          <FaqList className="lg:col-span-8" items={c.faq} />
        </div>
      </section>

      <section aria-labelledby="related-title" className="border-t border-line/70 py-20">
        <div className={CONTAINER}>
          <h2 id="related-title" className={EYEBROW}>{t.related}</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={lp(`/invitations/${r.slug}`)} className="inline-flex rounded-full border border-line-strong bg-paper px-5 py-2.5 text-[14.5px] text-ink transition hover:border-bronze-400">
                  {r[locale].nav}
                </Link>
              </li>
            ))}
            <li>
              <Link href={lp("/invitations")} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14.5px] text-bronze-700 underline-offset-4 hover:underline">
                {t.all}
                <ArrowRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <div className="bg-ivory pt-4">
        <CtaBand dict={dict} ctaHref={ctaHref} secondary={{ href: lp("/pricing"), label: dict.marketing.cta.secondary }} />
      </div>
    </>
  );
}
