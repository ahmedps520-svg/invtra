"use client";

import Link from "next/link";
import { useId, useSyncExternalStore, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { fmt } from "@/lib/i18n/config";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { Currency } from "@/lib/plans";
import type { OfferInfo } from "@/lib/offers";
import { cn } from "@/lib/utils";

/**
 * Saudi National Day offer: the announcement bar, the offer card and its countdown.
 * Every piece hides itself the moment the offer ends (the server stops selling it too).
 * Styled in Saudi green with a Sadu (السدو) border and a palm — no flag or emblem, which
 * may not be used in advertising.
 */

const GREEN = "#006C35";

// One shared 30-second clock for every countdown on the page.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(cb: () => void) {
  listeners.add(cb);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 30_000);
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const nowBucket = () => Math.floor(Date.now() / 30_000) * 30_000;

/** Current time on the client (refreshed every 30 s); null while server-rendering. */
function useNow(): number | null {
  return useSyncExternalStore(subscribe, nowBucket, () => null);
}

/** True until the offer ends (the server already checked it had started). */
export function useOfferLive(offer: OfferInfo | null): boolean {
  const now = useNow();
  if (!offer) return false;
  return now === null || now < Date.parse(offer.endsAt);
}

function useOfferCopy(offer: OfferInfo, currency: string) {
  const { dict, locale } = useI18n();
  const t = dict.common.offer;
  const price = formatMoney(offer.price, currency as Currency, locale);
  const guests = formatNumber(offer.guestLimit, locale);
  // The last day of the offer (it ends at midnight after it), in Riyadh time.
  const lastDay = formatDate(new Date(Date.parse(offer.endsAt) - 1), {
    locale,
    timeZone: "Asia/Riyadh",
    style: "long",
  });
  return { t, locale, price, guests, lastDay };
}

/** A Sadu weaving band — rows of triangles in white and gold. */
export function SaduBand({ className }: { className?: string }) {
  const id = `sadu-${useId().replace(/:/g, "")}`;
  return (
    <svg
      aria-hidden="true"
      className={cn("block h-2.5 w-full", className)}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={id} width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 10 L5 0 L10 10 Z" fill="#ffffff" fillOpacity="0.85" />
          <path d="M10 0 L15 10 L20 0 Z" fill="#d9b86c" />
          <rect x="4" y="6" width="2" height="2" fill={GREEN} />
          <rect x="14" y="2" width="2" height="2" fill={GREEN} />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#${id})`} />
    </svg>
  );
}

/** A date palm, drawn in line. */
export function PalmMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M32 26c-1 10-1 22 1 34" />
      <path d="M30 60h6" />
      <path d="M32 26C26 18 16 16 7 20c8-1 15 1 20 6" />
      <path d="M32 26c6-8 16-10 25-6-8-1-15 1-20 6" />
      <path d="M32 26C28 16 22 9 13 7c7 3 12 9 15 17" />
      <path d="M32 26c4-10 10-17 19-19-7 3-12 9-15 17" />
      <path d="M32 26C30 16 31 8 34 3c-1 7-1 14 0 21" />
      <path d="M31 27c-6 1-12 6-14 13 3-5 8-9 13-10" />
      <path d="M33 27c6 1 12 6 14 13-3-5-8-9-13-10" />
      <circle cx="29" cy="30" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="35" cy="30" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="32" cy="32" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function OfferCountdown({
  offer,
  className,
  tone = "light",
}: {
  offer: OfferInfo;
  className?: string;
  tone?: "light" | "dark";
}) {
  const { dict, locale } = useI18n();
  const t = dict.common.offer;
  const now = useNow();
  const left =
    now === null ? null : Math.max(0, Date.parse(offer.endsAt) - now);
  const parts: [number | null, string][] = [
    [left === null ? null : Math.floor(left / 86_400_000), t.days],
    [
      left === null ? null : Math.floor((left % 86_400_000) / 3_600_000),
      t.hours,
    ],
    [left === null ? null : Math.floor((left % 3_600_000) / 60_000), t.minutes],
  ];
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="timer"
      aria-live="off"
    >
      {parts.map(([n, label]) => (
        <span
          key={label}
          className={cn(
            "flex min-w-[3.6rem] flex-col items-center rounded-xl px-2.5 py-1.5",
            tone === "light"
              ? "bg-white/12 ring-1 ring-white/20"
              : "bg-[#e7f3ec] ring-1 ring-[#006C35]/15",
          )}
        >
          <span
            className={cn(
              "font-display text-2xl leading-none tabular-nums lining-nums",
              tone === "light" ? "text-white" : "text-[#00502A]",
            )}
          >
            {n === null ? "–" : formatNumber(n, locale).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "mt-1 text-[10.5px] uppercase tracking-[0.14em]",
              tone === "light" ? "text-white/70" : "text-[#00502A]/70",
            )}
          >
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Slim announcement bar at the top of the site (and the dashboard). */
export function OfferBanner({
  offer,
  currency,
  href,
}: {
  offer: OfferInfo | null;
  currency: string;
  href: string;
}) {
  const live = useOfferLive(offer);
  if (!offer || !live) return null;
  return <BannerInner offer={offer} currency={currency} href={href} />;
}

function BannerInner({
  offer,
  currency,
  href,
}: {
  offer: OfferInfo;
  currency: string;
  href: string;
}) {
  const { t, price, guests } = useOfferCopy(offer, currency);
  return (
    <div
      className="relative z-[51] text-white"
      style={{
        background: `linear-gradient(90deg, #00502A, ${GREEN} 50%, #00502A)`,
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-center text-[13.5px]">
        <span className="inline-flex items-center gap-2 font-medium">
          <PalmMark className="size-5 shrink-0 text-[#e9cf8f]" />
          {fmt(t.banner, { price, guests })}
        </span>
        <Link
          href={href}
          className="group inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1 text-[12.5px] font-semibold transition hover:bg-[#f3ead2]"
          style={{ color: GREEN }}
        >
          {t.bannerCta}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </div>
      <SaduBand className="h-1.5 opacity-90" />
    </div>
  );
}

/**
 * The offer card. `action` is the call to action (a link on the website, a checkout
 * button in the dashboard); `note` explains why it can't be used for this event, if so.
 */
export function OfferCard({
  offer,
  currency,
  action,
  note,
  compact,
  className,
}: {
  offer: OfferInfo | null;
  currency: string;
  action: ReactNode;
  note?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const live = useOfferLive(offer);
  if (!offer || !live) return null;
  return (
    <CardInner
      offer={offer}
      currency={currency}
      action={action}
      note={note}
      compact={compact}
      className={className}
    />
  );
}

function CardInner({
  offer,
  currency,
  action,
  note,
  compact,
  className,
}: {
  offer: OfferInfo;
  currency: string;
  action: ReactNode;
  note?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const { t, locale, price, guests, lastDay } = useOfferCopy(offer, currency);
  return (
    <section
      aria-label={t.title}
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] text-white shadow-[0_40px_80px_-40px_rgb(0_80_42/0.55)]",
        className,
      )}
      style={{
        background: `radial-gradient(120% 140% at 85% 10%, #0f8a4f 0%, ${GREEN} 45%, #003d20 100%)`,
      }}
    >
      <SaduBand />
      {/* The big 96 and the palm, as a quiet backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 end-[-1.5rem] flex select-none items-end opacity-[0.13] sm:end-6"
      >
        <PalmMark className="size-40 text-white sm:size-56" />
        <span className="font-display text-[9rem] leading-none sm:text-[13rem]">
          {formatNumber(offer.guestLimit, locale)}
        </span>
      </div>

      <div
        className={cn(
          "relative grid gap-6 px-6 sm:px-9",
          compact
            ? "py-6 sm:grid-cols-[1fr_auto] sm:items-end"
            : "py-8 sm:py-10 lg:grid-cols-[1.4fr_1fr] lg:items-end",
        )}
      >
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[12px] font-medium tracking-wide text-[#f1dfae] ring-1 ring-white/15">
            <PalmMark className="size-4" />
            {t.eyebrow}
          </p>
          <h3
            className={cn(
              "mt-4 font-display leading-[1.05]",
              compact ? "text-3xl" : "text-[2.4rem] sm:text-5xl",
            )}
          >
            {t.title}
          </h3>
          <p
            className={cn(
              "mt-2 font-display text-[#f1dfae]",
              compact ? "text-xl" : "text-2xl sm:text-[1.9rem]",
            )}
          >
            {fmt(t.headline, { price, guests })}
          </p>
          {!compact ? (
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85">
              {fmt(t.body, { guests })}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex flex-col gap-4",
            compact ? "sm:items-end" : "lg:items-end",
          )}
        >
          <div>
            <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/70">
              {t.endsIn}
            </p>
            <OfferCountdown offer={offer} />
          </div>
          <div className="w-full sm:w-auto">{action}</div>
        </div>
      </div>
      <div className="relative border-t border-white/10 px-6 py-3 text-[12.5px] text-white/70 sm:px-9">
        {note ? (
          <p className="mb-1 font-medium text-[#ffe3a3]">{note}</p>
        ) : null}
        <p>{fmt(t.terms, { date: lastDay })}</p>
      </div>
    </section>
  );
}

/** Button/link styling for the offer's call to action on the green card. */
export const offerCtaClass =
  "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#006C35] shadow-soft transition hover:bg-[#f6efdc] disabled:pointer-events-none disabled:opacity-60 sm:w-auto";
