"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Crown, Lock } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/i18n/routing";
import { errorMessage } from "./i18n";
import { OfferCard, offerCtaClass } from "@/components/offers/national-day";
import type { OfferInfo } from "@/lib/offers";

export type PlanTier = "BASIC" | "PREMIUM" | "CUSTOM";
export type PlanInfo = {
  tier: PlanTier;
  guestLimit: number | null;
  price: number | null;
  premiumThemes: boolean;
  contactSales: boolean;
};
export type PlansResponse = {
  currency: string;
  provider: string;
  plans: PlanInfo[];
  /** A limited-time offer on sale now (first plan only). */
  offer: OfferInfo | null;
  /** What this event's current plan counts for towards an upgrade, if bought with an offer. */
  credit: number | null;
};

const ORDER: PlanTier[] = ["BASIC", "PREMIUM", "CUSTOM"];

/** Loads GET /api/billing/plans (with the event's upgrade credit when `eventId` is given). */
export function usePlans(eventId?: string) {
  const url = `/api/billing/plans${eventId ? `?event=${encodeURIComponent(eventId)}` : ""}`;
  const [data, setData] = useState<PlansResponse | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setError(false);
    try {
      setData(await api<PlansResponse>(url));
    } catch {
      setError(true);
    }
  }, [url]);
  useEffect(() => {
    let alive = true;
    api<PlansResponse>(url)
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [url]);
  return { data, error, reload: load };
}

/** Plan cards. With `eventId` each card starts checkout for that event; without it they're informational. */
export function PlanCards({
  plans,
  currency,
  eventId,
  currentPlan,
  guestCount = 0,
  premiumTheme = false,
  compact,
  offer = null,
  credit = null,
}: {
  plans: PlanInfo[];
  currency: string;
  eventId?: string;
  currentPlan?: PlanTier | null;
  guestCount?: number;
  premiumTheme?: boolean;
  compact?: boolean;
  /** Shown above the plans for an event's first plan (or on the billing page). */
  offer?: OfferInfo | null;
  /** Upgrade credit for a plan bought with an offer (instead of its list price). */
  credit?: number | null;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.review.plan;
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const sorted = [...plans].sort(
    (a, b) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier),
  );
  const currentPrice = currentPlan
    ? (credit ?? plans.find((p) => p.tier === currentPlan)?.price ?? 0)
    : 0;
  const o = dict.common.offer;
  const offerBlocked =
    offer && eventId
      ? guestCount > offer.guestLimit
        ? fmt(o.over, {
            total: formatNumber(guestCount, locale),
            guests: formatNumber(offer.guestLimit, locale),
          })
        : premiumTheme
          ? o.premiumBlocked
          : null
      : null;

  async function choose(tier: PlanTier, offerKey?: string) {
    if (!eventId) return;
    setBusy(offerKey ?? tier);
    try {
      const res = await api<{ redirectUrl: string; orderId: string }>(
        `/api/events/${eventId}/checkout`,
        {
          method: "POST",
          body: { plan: tier, ...(offerKey ? { offer: offerKey } : {}) },
        },
      );
      toast(d.redirecting, "info");
      window.location.assign(res.redirectUrl);
    } catch (e) {
      toast(
        e instanceof ApiError && e.status === 404 && e.code !== "not_found"
          ? dict.dashboard.errors.checkout_unavailable
          : errorMessage(e, dict),
        "error",
      );
      setBusy(null);
    }
  }

  return (
    <div>
      {offer && !currentPlan ? (
        <OfferCard
          offer={offer}
          currency={currency}
          compact
          className="mb-5"
          note={offerBlocked}
          action={
            eventId ? (
              <button
                type="button"
                className={offerCtaClass}
                disabled={Boolean(busy) || Boolean(offerBlocked)}
                onClick={() => choose(offer.tier, offer.key)}
              >
                {busy === offer.key ? d.redirecting : o.claim}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </button>
            ) : (
              <Link href="/dashboard/events/new" className={offerCtaClass}>
                {o.claim}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            )
          }
        />
      ) : null}
      <div
        className={cn(
          "grid gap-4",
          sorted.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {sorted.map((p) => {
          const isCurrent = currentPlan === p.tier;
          const lower = currentPlan
            ? ORDER.indexOf(p.tier) < ORDER.indexOf(currentPlan)
            : false;
          const tooSmall = p.guestLimit !== null && p.guestLimit < guestCount;
          const themeBlocked = premiumTheme && !p.premiumThemes;
          const featured = p.tier === "PREMIUM";
          const price = p.price;
          const upgradeFrom =
            currentPlan && price !== null && !isCurrent && !lower
              ? Math.max(0, price - currentPrice)
              : null;
          return (
            <div
              key={p.tier}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-paper p-6 transition-shadow",
                featured
                  ? "border-bronze-300 shadow-lift"
                  : "border-line shadow-soft",
                (lower || isCurrent) && "opacity-80",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-display text-2xl text-ink">
                  {p.tier === "PREMIUM" ? (
                    <Crown className="size-4 text-bronze-500" />
                  ) : null}
                  {dict.common.plans[p.tier]}
                </h4>
                {isCurrent ? (
                  <Badge tone="sage">{d.currentBadge}</Badge>
                ) : featured ? (
                  <Badge tone="bronze">{d.popular}</Badge>
                ) : null}
              </div>
              <div className="mt-4 min-h-[3.25rem]">
                {p.contactSales || price === null ? (
                  <p className="text-sm leading-relaxed text-ink-soft">
                    {d.custom}
                  </p>
                ) : (
                  <>
                    <p className="font-display text-4xl leading-none text-ink lining-nums">
                      {formatMoney(price, currency, locale)}
                    </p>
                    <p className="mt-1.5 text-xs text-ink-faint">
                      {upgradeFrom !== null && currentPlan
                        ? fmt(d.upgradePrice, {
                            price: formatMoney(upgradeFrom, currency, locale),
                          })
                        : d.oneTime}
                    </p>
                  </>
                )}
              </div>
              {!compact ? (
                <ul className="mt-5 space-y-2 text-[13px] text-ink-soft">
                  <Feature>
                    {p.guestLimit
                      ? fmt(d.upTo, { n: formatNumber(p.guestLimit, locale) })
                      : d.larger}
                  </Feature>
                  <Feature>
                    {p.premiumThemes ? d.premiumThemes : d.standardThemes}
                  </Feature>
                  <Feature>{d.whatsapp}</Feature>
                  <Feature>{d.qr}</Feature>
                  <Feature>{d.live}</Feature>
                </ul>
              ) : (
                <p className="mt-3 text-[13px] text-ink-soft">
                  {p.guestLimit
                    ? fmt(d.upTo, { n: formatNumber(p.guestLimit, locale) })
                    : d.larger}
                </p>
              )}
              {eventId ? (
                <div className="mt-6 pt-1">
                  {p.contactSales || price === null ? (
                    <a
                      href="mailto:contact@invtra.store?subject=INVTRA%20Custom%20plan"
                      className={buttonClasses("outline", "md", "w-full")}
                    >
                      {d.contact}
                    </a>
                  ) : isCurrent || lower ? null : (
                    <Button
                      variant={featured ? "accent" : "primary"}
                      className="w-full"
                      loading={busy === p.tier}
                      disabled={Boolean(busy) || tooSmall || themeBlocked}
                      onClick={() => choose(p.tier)}
                    >
                      {fmt(currentPlan ? d.upgrade : d.choose, {
                        plan: dict.common.plans[p.tier],
                      })}
                    </Button>
                  )}
                  {(tooSmall || themeBlocked) && !isCurrent && !lower ? (
                    <p className="mt-2 text-xs text-ink-faint">
                      {tooSmall
                        ? fmt(dict.dashboard.review.checklist.items.plan.over, {
                            total: formatNumber(guestCount, locale),
                            limit: formatNumber(p.guestLimit ?? 0, locale),
                          })
                        : dict.dashboard.review.checklist.items.theme_plan.todo}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {eventId ? <CheckoutNote /> : null}
    </div>
  );
}

/** The ways to pay on the hosted checkout, and the terms that apply. */
const PAYMENT_METHODS = [
  "Apple Pay",
  "Google Pay",
  "mada",
  "Visa",
  "Mastercard",
];

function CheckoutNote() {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.review.plan;
  return (
    <div className="mt-5 flex flex-col items-center gap-3 text-center">
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        aria-label={d.secure}
      >
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
          <Lock className="size-3.5 text-bronze-600" aria-hidden="true" />
          {d.secure}
        </span>
        {PAYMENT_METHODS.map((m) => (
          <span
            key={m}
            lang="en"
            className="rounded-md border border-line bg-paper px-2 py-0.5 text-[11.5px] font-medium text-ink-soft"
          >
            {m}
          </span>
        ))}
      </div>
      <p className="text-[12px] text-ink-faint">
        {d.agreeBefore}{" "}
        <Link
          href={localePath(locale, "/terms")}
          target="_blank"
          className="underline underline-offset-2 hover:text-ink"
        >
          {d.terms}
        </Link>{" "}
        {d.and}{" "}
        <Link
          href={`${localePath(locale, "/terms")}#refunds`}
          target="_blank"
          className="underline underline-offset-2 hover:text-ink"
        >
          {d.refunds}
        </Link>
        .
      </p>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-3.5 shrink-0 text-bronze-500" />
      <span>{children}</span>
    </li>
  );
}
