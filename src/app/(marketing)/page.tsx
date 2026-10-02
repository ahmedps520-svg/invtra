import type { Metadata } from "next";
import { headers } from "next/headers";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { THEME_LIST } from "@/lib/themes/registry";
import { Hero } from "@/components/marketing/hero";
import { Journey } from "@/components/marketing/journey";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DesignsShowcase, type ShowcaseItem } from "@/components/marketing/designs-showcase";
import { WhatsAppSection } from "@/components/marketing/whatsapp-section";
import { QrSection } from "@/components/marketing/qr-section";
import { RsvpSection } from "@/components/marketing/rsvp-section";
import { BilingualSection } from "@/components/marketing/bilingual-section";
import { Pricing } from "@/components/marketing/pricing";
import { FaqList } from "@/components/marketing/faq";
import { CtaBand } from "@/components/marketing/cta-band";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { CONTAINER, EYEBROW } from "@/components/marketing/styles";
import { openGraph } from "@/components/marketing/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  const t = dict.marketing.meta;
  return {
    title: { absolute: t.homeTitle },
    description: t.homeDescription,
    alternates: { canonical: "/" },
    openGraph: openGraph(t.homeTitle, t.homeDescription, locale, "/"),
  };
}

const CONTACT_EMAIL = "hello@invtra.store";

export default async function HomePage() {
  const [{ dict, locale }, user, nonce] = await Promise.all([
    getI18n(),
    getSessionUser(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);
  const signedIn = Boolean(user);
  const ctaHref = signedIn ? "/dashboard/events/new" : "/signup";
  const t = dict.marketing;

  const showcase: ShowcaseItem[] = THEME_LIST.map((theme) => ({
    key: theme.key,
    name: dict.themes[theme.key].name,
    premium: theme.premium,
    language: theme.recommendedLanguage,
    languageLabel: dict.themes.recommendedFor[theme.recommendedLanguage],
  }));

  const [faqBefore, faqAfter] = t.faq.body.split("{email}");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "INVTRA",
        url: env().APP_URL,
        logo: `${env().APP_URL.replace(/\/$/, "")}/brand/icon-512.png`,
        email: CONTACT_EMAIL,
      },
      {
        "@type": "FAQPage",
        inLanguage: locale,
        mainEntity: t.faq.items.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <Hero dict={dict} locale={locale} ctaHref={ctaHref} />
      <Journey dict={dict} />
      <HowItWorks dict={dict} ctaHref={ctaHref} />

      <section
        id="designs"
        aria-labelledby="designs-title"
        className="scroll-mt-20 border-t border-line/70 bg-[linear-gradient(180deg,var(--color-sand),var(--color-ivory)_70%)] pt-24 pb-24 sm:pt-32 sm:pb-28"
      >
        <div className={CONTAINER}>
          <SectionHeading
            eyebrow={t.designs.eyebrow}
            title={<span id="designs-title">{t.designs.title}</span>}
            body={t.designs.body}
          />
        </div>
        <div className="mt-14 sm:mt-16">
          <DesignsShowcase items={showcase} premiumLabel={dict.themes.premium} />
        </div>
      </section>

      <WhatsAppSection dict={dict} locale={locale} />
      <QrSection dict={dict} />
      <RsvpSection dict={dict} locale={locale} />
      <BilingualSection dict={dict} locale={locale} />

      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 py-24 sm:py-32">
        <div className={CONTAINER}>
          <SectionHeading
            eyebrow={t.pricing.eyebrow}
            title={<span id="pricing-title">{t.pricing.title}</span>}
            body={t.pricing.body}
          />
          <Pricing dict={dict} locale={locale} currency={env().PAYMENT_CURRENCY} signedIn={signedIn} className="mt-16 sm:mt-20" />
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-line/70 bg-paper py-24 sm:py-32">
        <div className={`${CONTAINER} grid gap-12 lg:grid-cols-12 lg:gap-10`}>
          <Reveal className="lg:col-span-4">
            <p className={EYEBROW}>{t.faq.eyebrow}</p>
            <h2 id="faq-title" className="mt-4 font-display text-[2.5rem] leading-[1.08] text-balance text-ink sm:text-5xl">
              {t.faq.title}
            </h2>
            <p className="mt-6 max-w-sm text-[16px] leading-relaxed text-ink-soft">
              {faqBefore}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-bronze-700 underline decoration-bronze-300 underline-offset-4 hover:decoration-bronze-600"
              >
                {CONTACT_EMAIL}
              </a>
              {faqAfter}
            </p>
          </Reveal>
          <FaqList className="lg:col-span-8" />
        </div>
      </section>

      <div className="bg-paper pt-4">
        <CtaBand dict={dict} ctaHref={ctaHref} />
      </div>
    </>
  );
}
