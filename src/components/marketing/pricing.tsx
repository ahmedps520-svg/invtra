import Link from "next/link";
import { ArrowRight, Check, FlaskConical, MessageCircle } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/config";
import { formatMoney, formatNumber } from "@/lib/format";
import { PLANS, PLAN_ORDER, TEST_SEND_LIMIT, planPrice, type Currency } from "@/lib/plans";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "hello@invtra.store";

/**
 * Plan cards built from the plan catalogue (src/lib/plans.ts) in the configured
 * payment currency. Used on the landing page and on /pricing.
 */
export function Pricing({
  dict,
  locale,
  currency,
  signedIn,
  className,
}: {
  dict: Dictionary;
  locale: Locale;
  currency: Currency;
  signedIn: boolean;
  className?: string;
}) {
  const t = dict.marketing.pricing;
  const startHref = signedIn ? "/dashboard/events/new" : "/signup?next=%2Fdashboard%2Fevents%2Fnew";
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t.contactSubject)}`;

  return (
    <div className={className}>
      <ul className="grid items-stretch gap-6 lg:grid-cols-3 lg:gap-5 xl:gap-7">
        {PLAN_ORDER.map((tier: PlanTier, i) => {
          const plan = PLANS[tier];
          const copy = t.plans[tier];
          const featured = tier === "PREMIUM";
          const price = planPrice(tier, currency);
          return (
            <li key={tier} className={cn(featured && "lg:-my-4")}>
              <Reveal
                delay={i * 80}
                className={cn(
                  "relative flex h-full flex-col rounded-[1.75rem] border p-7 sm:p-9",
                  featured
                    ? "border-[#2c2620] bg-[#1c1815] text-ivory shadow-[0_40px_80px_-40px_rgb(30_26_22/0.6)] lg:py-12"
                    : "border-line bg-paper shadow-soft",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className={cn("font-display text-[1.9rem] leading-none", featured ? "text-ivory" : "text-ink")}>
                    {dict.common.plans[tier]}
                  </h3>
                  {featured ? (
                    <span className="rounded-full border border-bronze-300/40 bg-bronze-300/10 px-3 py-1 text-[11px] font-medium tracking-wide text-bronze-200">
                      {t.recommended}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-3 min-h-[3rem] text-[14.5px] leading-relaxed",
                    featured ? "text-[#b9afa2]" : "text-ink-faint",
                  )}
                >
                  {copy.tagline}
                </p>

                <div className="mt-7">
                  {price !== null ? (
                    <>
                      <p
                        className={cn(
                          "font-display text-[3.4rem] leading-none tabular-nums lining-nums",
                          featured ? "text-ivory" : "text-ink",
                        )}
                      >
                        {formatMoney(price, currency, locale)}
                      </p>
                      <p className={cn("mt-3 text-[13px]", featured ? "text-[#a99f93]" : "text-ink-faint")}>
                        {t.perEvent} · {t.oneTime}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-[3.4rem] leading-none text-ink">{t.tailored}</p>
                      <p className="mt-3 text-[13px] text-ink-faint">{t.tailoredNote}</p>
                    </>
                  )}
                </div>

                {plan.contactSales ? (
                  <a href={mailto} className={buttonClasses("outline", "lg", "group mt-8 w-full")}>
                    {t.contactCta}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </a>
                ) : (
                  <Link
                    href={startHref}
                    className={buttonClasses(
                      featured ? "accent" : "primary",
                      "lg",
                      cn("group mt-8 w-full", featured && "bg-bronze-500 hover:bg-bronze-400"),
                    )}
                  >
                    {t.cta}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                )}

                <div className={cn("my-8 h-px", featured ? "bg-white/10" : "bg-line")} />

                <ul className="space-y-3.5">
                  {[
                    ...(plan.guestLimit ? [fmt(t.guestsUpTo, { count: formatNumber(plan.guestLimit, locale) })] : []),
                    ...copy.features,
                  ].map((f) => (
                    <li
                      key={f}
                      className={cn("flex gap-3 text-[14.5px] leading-snug", featured ? "text-[#e9e2d8]" : "text-ink-soft")}
                    >
                      <Check
                        className={cn("mt-0.5 size-4 shrink-0", featured ? "text-bronze-300" : "text-bronze-500")}
                        strokeWidth={1.75}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </li>
          );
        })}
      </ul>

      <Reveal className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16">
        <p className="flex gap-4 rounded-2xl border border-line bg-paper/70 px-6 py-5 text-[14px] leading-relaxed text-ink-soft">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-bronze-600" strokeWidth={1.25} />
          {fmt(t.testSends, { count: formatNumber(TEST_SEND_LIMIT, locale) })}
        </p>
        <p className="flex gap-4 rounded-2xl border border-line bg-paper/70 px-6 py-5 text-[14px] leading-relaxed text-ink-soft">
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-bronze-600" strokeWidth={1.25} />
          {t.included}
        </p>
      </Reveal>
    </div>
  );
}
