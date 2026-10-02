import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, DoorOpen, Globe2, LayoutDashboard, MessageCircle, QrCode, ScrollText } from "lucide-react";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { buttonClasses } from "@/components/ui/button";
import { Pricing } from "@/components/marketing/pricing";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { CtaBand } from "@/components/marketing/cta-band";
import { CONTAINER, EYEBROW } from "@/components/marketing/styles";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  const t = dict.marketing.meta;
  return {
    title: t.pricingTitle,
    description: t.pricingDescription,
    alternates: { canonical: "/pricing" },
    openGraph: { title: t.pricingTitle, description: t.pricingDescription },
  };
}

const INCLUDED_ICONS = [MessageCircle, QrCode, ScrollText, LayoutDashboard, DoorOpen, Globe2];

export default async function PricingPage() {
  const [{ dict, locale }, user] = await Promise.all([getI18n(), getSessionUser()]);
  const signedIn = Boolean(user);
  const t = dict.marketing.pricingPage;
  const ctaHref = signedIn ? "/dashboard/events/new" : "/signup";

  return (
    <>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-bronze-100),transparent)] opacity-70"
        />
        <div className={`${CONTAINER} relative pb-24 pt-16 sm:pb-28 sm:pt-24`}>
          <SectionHeading as="h1" eyebrow={t.eyebrow} title={t.title} body={t.body} />
          <Pricing dict={dict} locale={locale} currency={env().PAYMENT_CURRENCY} signedIn={signedIn} className="mt-16 sm:mt-20" />
        </div>
      </div>

      <section aria-labelledby="included-title" className="border-y border-line/70 bg-paper">
        <div className={`${CONTAINER} py-24 sm:py-28`}>
          <Reveal className="text-center">
            <h2 id="included-title" className="font-display text-[2.3rem] leading-tight text-ink sm:text-[2.75rem]">
              {t.includedTitle}
            </h2>
          </Reveal>
          <ul className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {t.included.map((item, i) => {
              const Icon = INCLUDED_ICONS[i];
              return (
                <li key={item.title} className="bg-paper">
                  <Reveal delay={(i % 3) * 70} className="h-full px-7 py-8 sm:px-9 sm:py-10">
                    <Icon className="size-5 text-bronze-600" strokeWidth={1.25} />
                    <h3 className="mt-5 font-display text-2xl leading-tight text-ink">{item.title}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink-faint">{item.body}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="questions-title" className={`${CONTAINER} py-20 sm:py-24`}>
        <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className={EYEBROW}>{dict.marketing.faq.eyebrow}</p>
            <h2 id="questions-title" className="mt-3 font-display text-3xl text-ink">
              {t.questions}
            </h2>
            <p className="mt-2 max-w-lg text-[15.5px] leading-relaxed text-ink-soft">{t.questionsBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/#faq" className={buttonClasses("outline", "lg", "group")}>
              {t.readFaq}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <a href="mailto:hello@invtra.store" className={buttonClasses("ghost", "lg")}>
              hello@invtra.store
            </a>
          </div>
        </Reveal>
      </section>

      <CtaBand dict={dict} ctaHref={ctaHref} secondary={{ href: "/designs", label: dict.marketing.hero.secondary }} />
    </>
  );
}
