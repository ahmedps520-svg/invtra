"use client";

import { useState } from "react";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Steps = { signedUp: number; verified: number; createdEvent: number; addedGuests: number; paid: number; sent: number };
type Week = Steps & { week: string; revenue: number };

const STEP_LABELS: { key: keyof Steps; label: string; hint: string }[] = [
  { key: "signedUp", label: "Signed up", hint: "Created an account" },
  { key: "verified", label: "Verified email", hint: "Entered their emailed code" },
  { key: "createdEvent", label: "Created an event", hint: "Started an invitation" },
  { key: "addedGuests", label: "Added guests", hint: "At least one guest on a list" },
  { key: "paid", label: "Paid", hint: "Bought a plan" },
  { key: "sent", label: "Sent invitations", hint: "Sent to at least one guest" },
];

// Two steps of one hue (validated as an ordinal ramp on the paper surface).
const LIGHT = "#c9b092"; // bronze-300
const DARK = "#6e533b"; // bronze-700
const BAR = "#84664a"; // bronze-600

const n = (v: number) => formatNumber(v, "en");
const pctOf = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const weekLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", day: "numeric", month: "short" }).format(new Date(iso));

/** Each step as a share of everyone who signed up, with how many carried on from the step before. */
export function FunnelSteps({ total, continued }: { total: Steps; continued: Steps }) {
  const [hover, setHover] = useState<number | null>(null);
  const base = total.signedUp;
  return (
    <ol className="space-y-1" aria-label="Funnel">
      {STEP_LABELS.map((s, i) => {
        const v = total[s.key];
        const prev = i ? total[STEP_LABELS[i - 1].key] : null;
        const width = base ? Math.max(v ? 1.5 : 0, (v / base) * 100) : 0;
        return (
          <li key={s.key}>
            {prev !== null ? (
              <p className="py-1 text-[11.5px] text-ink-faint tabular-nums sm:ps-[calc(12rem+1rem)]" aria-hidden="true">
                ↓ {pctOf(continued[s.key], prev)} continued
              </p>
            ) : null}
            {/* Phones: name and count on one line, the bar under them. Wider: name · bar · count. */}
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-lg py-1 sm:grid-cols-[12rem_minmax(0,1fr)_6.5rem]"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${s.label}: ${n(v)} people, ${pctOf(v, base)} of sign-ups${prev !== null ? `; ${pctOf(continued[s.key], prev)} of those at the step before carried on` : ""}`}
            >
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink">{s.label}</p>
                <p className="text-[11.5px] text-ink-faint">{s.hint}</p>
              </div>
              <div className="relative order-last col-span-2 h-5 sm:order-none sm:col-span-1">
                <div className="absolute inset-0 rounded-e bg-sand/70" aria-hidden="true" />
                <div
                  className="absolute inset-y-0 start-0 rounded-e transition-[width,opacity] duration-500"
                  style={{ width: `${width}%`, background: BAR, opacity: hover === null || hover === i ? 1 : 0.55 }}
                  aria-hidden="true"
                />
              </div>
              <div className="text-end">
                <span className="text-[15px] font-medium text-ink tabular-nums">{n(v)}</span>
                <span className="ms-1.5 text-[12px] text-ink-faint tabular-nums">{pctOf(v, base)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Sign-ups each week, with the part of them who have paid (same people, one axis). */
export function WeeklyChart({ weekly, currency }: { weekly: Week[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weekly.map((w) => w.signedUp));
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : Math.ceil(max / 5 / 50) * 50;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const y = (v: number) => `${100 - (v / top) * 100}%`;
  // Label every few weeks, counted back from this week so it always has one; fewer on phones.
  const wide = weekly.length > 13 ? 4 : weekly.length > 6 ? 2 : 1;
  const narrow = weekly.length > 13 ? 6 : weekly.length > 6 ? 3 : 1;
  const last = weekly.length - 1;
  const active = hover !== null ? weekly[hover] : null;
  // The tooltip sits beside the column, on whichever side has room.
  const tipLeft = hover !== null && hover < weekly.length / 2;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: LIGHT }} aria-hidden="true" />
          Signed up
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: DARK }} aria-hidden="true" />
          Of those, paid
        </span>
      </div>
      <div className="flex">
        {/* y axis */}
        <div className="relative h-48 w-8 shrink-0 sm:h-56 xl:h-80" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute end-2 -translate-y-1/2 text-[11px] text-ink-faint tabular-nums" style={{ top: y(t) }}>
              {n(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48 sm:h-56 xl:h-80">
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-line/70" style={{ top: y(t) }} aria-hidden="true" />
            ))}
            <div className="absolute inset-0 flex items-end" role="img" aria-label="Weekly sign-ups and how many of them paid. The table below has every number.">
              {weekly.map((w, i) => (
                <div
                  key={w.week}
                  className="relative flex h-full flex-1 items-end justify-center px-px"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {hover === i ? <div className="absolute inset-y-0 inset-x-0.5 rounded-md bg-sand/60" aria-hidden="true" /> : null}
                  <div className="relative w-full max-w-[24px]" style={{ height: `${(w.signedUp / top) * 100}%` }}>
                    {w.signedUp ? <div className="absolute inset-0 rounded-t" style={{ background: LIGHT }} /> : null}
                    {/* The paid part sits inside the column, with a 2px surface gap above it. */}
                    {w.paid ? (
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t border-t-2 border-paper"
                        style={{ height: `max(4px, ${(w.paid / w.signedUp) * 100}%)`, background: DARK }}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {active ? (
              <div
                className="pointer-events-none absolute top-1 z-10 w-48 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[12.5px] shadow-lift"
                style={
                  tipLeft
                    ? { left: `calc(${((hover! + 1) / weekly.length) * 100}% + 6px)` }
                    : { right: `calc(${((weekly.length - hover!) / weekly.length) * 100}% + 6px)` }
                }
                role="status"
              >
                <p className="font-medium text-ink">Week of {weekLabel(active.week)}</p>
                <p className="mt-1 flex justify-between text-ink-soft">
                  <span>Signed up</span>
                  <span className="tabular-nums text-ink">{n(active.signedUp)}</span>
                </p>
                <p className="flex justify-between text-ink-soft">
                  <span>Paid</span>
                  <span className="tabular-nums text-ink">
                    {n(active.paid)} <span className="text-ink-faint">({pctOf(active.paid, active.signedUp)})</span>
                  </span>
                </p>
                <p className="flex justify-between text-ink-soft">
                  <span>Revenue</span>
                  <span className="tabular-nums text-ink">{formatMoney(active.revenue, currency, "en")}</span>
                </p>
              </div>
            ) : null}
          </div>
          <div className="relative mt-2 h-4" aria-hidden="true">
            {weekly.map((w, i) => (
              <span
                key={w.week}
                className={cn(
                  "absolute -translate-x-1/2 whitespace-nowrap text-[11px] text-ink-faint",
                  (last - i) % narrow ? "hidden" : "",
                  (last - i) % wide ? "sm:hidden" : "sm:inline",
                )}
                style={{ left: `${((i + 0.5) / weekly.length) * 100}%` }}
              >
                {weekLabel(w.week)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
