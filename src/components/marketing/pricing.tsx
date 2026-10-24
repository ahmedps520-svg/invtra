import Link from "next/link";
import { ArrowRight, Check, CreditCard, FlaskConical } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/config";
import { formatMoney, formatNumber } from "@/lib/format";
import { PLANS, PLAN_ORDER, planPrice, type Currency } from "@/lib/plans";
import type { SendingMode } from "@/lib/marketing/links";
import { OfferCard, offerCtaClass } from "@/components/offers/national-day";
import { activeOffer, offerInfo } from "@/lib/offers";
import { PlanCards, type PlanCard } from "./plan-cards";
import { Reveal } from "./reveal";

const CONTACT_EMAIL = "contact@invtra.store";

/**
 * In right-to-left text a Latin currency symbol such as "US$" gets split by the bidi
 * algorithm ("$US"). Isolating it keeps the symbol intact while the amount stays RTL.
 */
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);

function displayPrice(minor: number, currency: Currency, locale: Locale) {
  const s = formatMoney(minor, currency, locale);
  return locale === "ar" ? s.replace(/[A-Za-z]+\$|[A-Z]{3}/g, (m) => LRI + m + PDI) : s;
}

/**
 * Plan cards built from the plan catalogue (src/lib/plans.ts) in the configured payment
 * currency, with the guest-count slider. Used on the landing page and on /pricing.
 */
export function Pricing({
  dict,
  locale,
  currency,
  signedIn,
  mode,
  className,
}: {
  dict: Dictionary;
  locale: Locale;
  currency: Currency;
  signedIn: boolean;
  mode: SendingMode;
  className?: string;
}) {
  const t = dict.marketing.pricing;
  const h = dict.marketing.home.pricing;
  const startHref = signedIn ? "/dashboard/events/new" : "/signup?next=%2Fdashboard%2Fevents%2Fnew";
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t.contactSubject)}`;

  const plans: PlanCard[] = PLAN_ORDER.map((tier) => {
    const plan = PLANS[tier];
    const copy = t.plans[tier];
    const price = planPrice(tier, currency);
    return {
      tier,
      name: dict.common.plans[tier],
      tagline: copy.tagline,
      price: price !== null ? displayPrice(price, currency, locale) : t.tailored,
      sub: price !== null ? `${t.perEvent} · ${t.oneTime}` : t.tailoredNote,
      features: [...(plan.guestLimit ? [fmt(t.guestsUpTo, { count: formatNumber(plan.guestLimit, locale) })] : []), ...copy.features],
      cta: plan.contactSales ? { href: mailto, label: t.contactCta, external: true } : { href: startHref, label: t.cta },
      featured: tier === "PREMIUM",
      badge: tier === "PREMIUM" ? t.recommended : undefined,
    };
  });

  return (
    <div className={className}>
      <OfferCard
        offer={offerInfo(activeOffer(), currency)}
        currency={currency}
        className="mb-12 sm:mb-16"
        action={
          <Link href={startHref} className={offerCtaClass}>
            {dict.common.offer.claim}
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        }
      />
      <PlanCards plans={plans} copy={{ slider: h.slider, guests: h.guests, over: h.over, fits: h.fits, test: h.test[mode] }} numberFormat={locale} />

      <Reveal className="mt-14 sm:mt-16">
        <div className="ivx-paper ivx-grain p-6 sm:p-9">
          <div className="relative">
            <h3 className="font-display text-[1.7rem] leading-tight text-ink">{h.includedTitle}</h3>
            <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {[h.included.first[mode], ...h.included.rest].map((item) => (
                <li key={item} className="flex gap-3 text-[14.5px] leading-snug text-ink-soft">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.75} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 grid gap-3 border-t border-hairline pt-6 sm:grid-cols-2">
              <p className="flex gap-3 text-[13.5px] leading-relaxed text-ink-soft">
                <FlaskConical className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.4} />
                {dict.marketing.home.quiz.result.testNote[mode]}
              </p>
              <p className="flex gap-3 text-[13.5px] leading-relaxed text-ink-soft">
                <CreditCard className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.4} />
                {t.payWith}
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
