import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { headers } from "next/headers";
import { INVITATIONS_HUB, OCCASION_PAGES } from "@/lib/seo/occasion-pages";
import { hubCopy } from "@/lib/seo/occasion-sending";
import { sendingMode } from "@/server/marketing";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc } from "@/lib/marketing/samples";
import { localePath } from "@/lib/i18n/routing";
import { buttonClasses } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/cta-band";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CONTAINER } from "@/components/marketing/styles";
import { breadcrumbLd, jsonLdHtml, pageMetadata, siteUrl } from "@/components/marketing/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const h = INVITATIONS_HUB[locale];
  return pageMetadata({ locale, path: "/invitations", title: h.title, description: h.description, image: "invitations" });
}

/** Every occasion INVTRA designs for — the hub for "event invitations" searches. */
export default async function InvitationsHubPage() {
  const [{ dict, locale }, user, nonce] = await Promise.all([getI18n(), getSessionUser(), headers().then((x) => x.get("x-nonce") ?? undefined)]);
  const mode = sendingMode();
  const h = hubCopy(locale, mode);
  const lp = (href: string) => localePath(locale, href);
  const ctaHref = user ? "/dashboard/events/new" : "/signup";
  const lang = locale === "ar" ? "ar" : "en";

  const jsonLd = jsonLdHtml([
    breadcrumbLd(
      [
        { name: "INVTRA", path: "/" },
        { name: dict.common.nav.occasions, path: "/invitations" },
      ],
      locale,
    ),
    {
      "@type": "CollectionPage",
      name: h.title,
      description: h.description,
      inLanguage: locale,
      isPartOf: { "@id": `${siteUrl()}/#website` },
      hasPart: OCCASION_PAGES.map((p) => ({ "@type": "WebPage", name: p[locale].title, url: siteUrl(lp(`/invitations/${p.slug}`)) })),
    },
  ]);

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-gold-soft),transparent)] opacity-70" />
        <div className={`${CONTAINER} relative pb-20 pt-16 sm:pt-24`}>
          <SectionHeading as="h1" eyebrow={h.eyebrow} title={h.h1} body={h.intro}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href={ctaHref} className={buttonClasses("primary", "lg", "group")}>
                {dict.marketing.hero.primary}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
              <Link href={lp("/designs")} className={buttonClasses("outline", "lg")}>
                {dict.marketing.hero.secondary}
              </Link>
            </div>
          </SectionHeading>

          <h2 className="mt-20 text-center font-display text-3xl text-ink sm:text-4xl">{h.choose}</h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-8 md:grid-cols-3 lg:grid-cols-4">
            {OCCASION_PAGES.map((p, i) => (
              <li key={p.slug}>
                <Reveal delay={(i % 4) * 60}>
                  <Link href={lp(`/invitations/${p.slug}`)} className="group block">
                    <div className="overflow-hidden rounded-[5px] bg-cream-deep shadow-soft ring-1 ring-black/5 transition-[translate,box-shadow] duration-700 ease-luxe group-hover:-translate-y-1.5 group-hover:shadow-lift">
                      {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                      <img src={sampleSrc(p.theme, lang, p.type)} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt={p[locale].h1} loading="lazy" decoding="async" className="block h-auto w-full" />
                    </div>
                    <h3 className="mt-4 font-display text-xl leading-tight text-ink sm:text-2xl">{p[locale].nav}</h3>
                    <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-faint">{p[locale].description}</p>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section aria-labelledby="why-title" className="border-t border-hairline/70 bg-[#fffcf6] py-16 sm:py-24">
        <div className={CONTAINER}>
          <h2 id="why-title" className="text-center font-display text-3xl text-ink sm:text-4xl">{h.why}</h2>
          <ul className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {h.reasons.map((r, i) => (
              <li key={r.title}>
                <Reveal delay={i * 60}>
                  <h3 className="font-display text-2xl text-ink">{r.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{r.body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="bg-[#fffcf6] pt-4">
        <CtaBand dict={dict} ctaHref={ctaHref} secondary={{ href: lp("/pricing"), label: dict.marketing.cta.secondary }} mode={mode} locale={locale} />
      </div>
    </>
  );
}
