import type { Metadata } from "next";
import { headers } from "next/headers";
import type { PlanTier } from "@prisma/client";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { sendingMode } from "@/server/marketing";
import { THEME_LIST } from "@/lib/themes/registry";
import { EVENT_TYPES } from "@/lib/events/types";
import { OCCASION_PAGES } from "@/lib/seo/occasion-pages";
import { THEME_STYLE } from "@/lib/marketing/design-styles";
import { startHref } from "@/lib/marketing/links";
import { Hero } from "@/components/marketing/hero";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { Occasions } from "@/components/marketing/occasions";
import { Journey } from "@/components/marketing/journey";
import { WhatsAppSection } from "@/components/marketing/whatsapp-section";
import { DesignsSection } from "@/components/marketing/designs-section";
import { QuizBanner } from "@/components/marketing/quiz-banner";
import { Quiz, type QuizDesign } from "@/components/marketing/quiz";
import { QrSection } from "@/components/marketing/qr-section";
import { RsvpSection } from "@/components/marketing/rsvp-section";
import { MadeYourWay } from "@/components/marketing/made-your-way";
import { Comparison } from "@/components/marketing/comparison";
import { Pricing } from "@/components/marketing/pricing";
import { Manifesto } from "@/components/marketing/manifesto";
import { FaqList } from "@/components/marketing/faq";
import { CtaBand } from "@/components/marketing/cta-band";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { CONTAINER, EYEBROW } from "@/components/marketing/styles";
import { CONTACT_EMAIL, faqLd, jsonLdHtml, organizationLd, pageMetadata, plansProductLd, siteUrl, websiteLd } from "@/components/marketing/seo";
import { PLAN_ORDER, planPrice, type Currency } from "@/lib/plans";
import { localePath } from "@/lib/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  const t = dict.marketing.meta;
  return pageMetadata({ locale, path: "/", title: t.homeTitle, description: t.homeDescription, absoluteTitle: true });
}

const minorUnit = (currency: Currency) => (["KWD", "BHD", "OMR"].includes(currency) ? 1000 : 100);

export default async function HomePage() {
  const [{ dict, locale }, user, nonce] = await Promise.all([getI18n(), getSessionUser(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  const signedIn = Boolean(user);
  const ctaHref = signedIn ? "/dashboard/events/new" : "/signup";
  const t = dict.marketing;
  const mode = sendingMode();
  const currency = env().PAYMENT_CURRENCY;

  const [faqBefore, faqAfter] = t.faq.body.split("{email}");
  const priced = PLAN_ORDER.map((tier) => ({ tier, price: planPrice(tier, currency) })).filter((p): p is { tier: PlanTier; price: number } => p.price !== null);
  const jsonLd = jsonLdHtml([
    organizationLd(),
    websiteLd(locale),
    {
      "@type": "Service",
      "@id": `${siteUrl()}/#service`,
      name: locale === "ar" ? "دعوات إلكترونية عبر واتساب" : "Digital invitations on WhatsApp",
      serviceType: locale === "ar" ? "دعوات إلكترونية للمناسبات" : "Digital event invitations",
      description: t.meta.homeDescription,
      provider: { "@id": `${siteUrl()}/#organization` },
      url: siteUrl(),
    },
    plansProductLd({
      locale,
      currency,
      plans: priced.map((p) => ({ name: dict.common.plans[p.tier], description: t.pricing.plans[p.tier].tagline, price: p.price / minorUnit(currency) })),
    }),
    faqLd(t.faq.items, locale),
  ]);

  const quizDesigns: QuizDesign[] = THEME_LIST.map((th) => ({
    key: th.key,
    name: dict.themes[th.key].name,
    premium: th.premium,
    occasions: th.occasions,
    style: THEME_STYLE[th.key],
    language: th.recommendedLanguage,
  }));
  const quizOccasions = EVENT_TYPES.filter((e) => e !== "OTHER").map((e) => ({
    value: e,
    label: OCCASION_PAGES.find((o) => o.type === e)?.[locale].nav ?? dict.common.eventTypes[e],
  }));

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <Hero dict={dict} locale={locale} ctaHref={ctaHref} mode={mode} signedIn={signedIn} />
      <ProofStrip dict={dict} mode={mode} />
      <Occasions dict={dict} locale={locale} />
      <Journey dict={dict} />
      <WhatsAppSection dict={dict} locale={locale} mode={mode} />
      <DesignsSection dict={dict} locale={locale} />
      <QuizBanner dict={dict} locale={locale} />
      <QrSection dict={dict} locale={locale} />
      <RsvpSection dict={dict} locale={locale} mode={mode} />
      <MadeYourWay dict={dict} locale={locale} uploadHref={startHref(signedIn)} />
      <Comparison dict={dict} />

      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-t border-hairline/70 bg-[linear-gradient(180deg,var(--color-cream-deep),var(--color-cream)_45%)] py-20 sm:py-28">
        <div className={CONTAINER}>
          <SectionHeading eyebrow={t.pricing.eyebrow} title={<span id="pricing-title">{t.pricing.title}</span>} body={t.pricing.body} />
          <Pricing dict={dict} locale={locale} currency={currency} signedIn={signedIn} mode={mode} className="mt-14 sm:mt-16" />
        </div>
      </section>

      <Manifesto eyebrow={t.home.manifesto.eyebrow} text={t.home.manifesto.text} />

      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-hairline/70 bg-[#fffcf6] py-20 sm:py-28">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-12 lg:gap-10`}>
          <div className="lg:col-span-4">
            <Reveal className="lg:sticky lg:top-28">
              <p className={EYEBROW}>{t.faq.eyebrow}</p>
              <h2 id="faq-title" className="mt-4 font-display text-[2.4rem] leading-[1.08] text-balance text-ink sm:text-5xl">
                {t.faq.title}
              </h2>
              <p className="mt-6 max-w-sm text-[16px] leading-relaxed text-ink-soft">
                {faqBefore}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-deep underline decoration-gold/60 underline-offset-4 hover:decoration-gold-deep">
                  {CONTACT_EMAIL}
                </a>
                {faqAfter}
              </p>
            </Reveal>
          </div>
          <FaqList className="lg:col-span-8" items={t.faq.items} />
        </div>
      </section>

      <div className="bg-[#fffcf6] pt-4">
        <CtaBand dict={dict} ctaHref={ctaHref} secondary={{ href: localePath(locale, "/pricing"), label: t.cta.secondary }} mode={mode} locale={locale} />
      </div>

      <Quiz
        designs={quizDesigns}
        occasions={quizOccasions}
        copy={t.home.quiz}
        planNames={dict.common.plans}
        mode={mode}
        signedIn={signedIn}
        contactHref={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t.pricing.contactSubject)}`}
      />
    </>
  );
}
