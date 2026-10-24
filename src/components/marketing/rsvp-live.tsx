"use client";

import { Bell, Check, Eye, ScanLine } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { SendingMode } from "@/lib/marketing/links";
import { cn } from "@/lib/utils";
import { usePlayOnScreen, useStoryline } from "./use-play";

const STATS = { guests: 250, accepted: 183, declined: 32, pending: 35, views: 147, scans: 98 };
const TONE: Record<string, string> = { sage: "bg-sage", rosewood: "bg-rosewood", ochre: "bg-ochre", slate: "bg-slate", bronze: "bg-gold" };

/** A number that counts up from 0 when `zero` turns off (CSS counter, see .ivx-count). */
function Count({ to, zero }: { to: number; zero: boolean }) {
  return <span className="ivx-count" data-zero={zero} style={{ ["--ivx-to" as string]: to }} aria-hidden="true" />;
}

/**
 * The event dashboard (an example event), played while on screen: counters count up, the ring
 * fills, replies arrive one by one and a reminder goes out to the guests who haven't answered.
 */
export function RsvpLive({
  vignette: v,
  copy: c,
  locale,
  mode,
}: {
  vignette: Dictionary["marketing"]["rsvp"]["vignette"];
  copy: Dictionary["marketing"]["home"]["rsvp"];
  locale: Locale;
  mode: SendingMode;
}) {
  const { ref, playing } = usePlayOnScreen<HTMLDivElement>(0.35);
  const step = useStoryline(playing, [250, 1500, 420, 420, 420, 420, 1000]);
  const n = (x: number) => formatNumber(x, locale);
  const zero = playing && step === 0;
  const responded = Math.round(((STATS.accepted + STATS.declined) / STATS.guests) * 100);
  const ring = zero ? 0 : responded;
  const R = 34;
  const C = 2 * Math.PI * R;
  const reminded = step >= 7;

  const tiles = [
    { label: v.guests, value: STATS.guests, dot: "bg-ink-faint" },
    { label: v.accepted, value: STATS.accepted, dot: "bg-sage" },
    { label: v.declined, value: STATS.declined, dot: "bg-rosewood" },
    { label: v.pending, value: STATS.pending, dot: "bg-ochre" },
  ];

  return (
    <div ref={ref}>
      <figure role="img" aria-label={v.label} className="ivx-paper-light p-2">
        <div aria-hidden="true" className="overflow-hidden rounded-[1.1rem] border border-hairline/70 bg-cream/60">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline/70 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[10.5px] font-medium tracking-[0.18em] text-gold-deep uppercase rtl:text-[12px]">{c.example}</p>
              <p className="mt-1 font-display text-[1.45rem] leading-tight text-ink">{v.event}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">{v.date}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sage/25 bg-sage-soft px-3 py-1 text-[12px] font-medium text-sage">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage/50 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-sage" />
              </span>
              {v.live}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-px bg-hairline/70 sm:grid-cols-4">
            {tiles.map((s) => (
              <div key={s.label} className="bg-[#fffcf6] px-4 py-4 sm:px-5">
                <p className="flex items-center gap-2 text-[10.5px] font-medium tracking-[0.12em] text-ink-faint uppercase rtl:text-[12px]">
                  <span className={cn("size-1.5 rounded-full", s.dot)} />
                  {s.label}
                </p>
                <p className="mt-2 font-display text-[2.3rem] leading-none text-ink tabular-nums lining-nums">
                  <Count to={s.value} zero={zero} />
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-px bg-hairline/70 md:grid-cols-[1fr_1.15fr]">
            <div className="flex items-center gap-5 bg-[#fffcf6] px-5 py-5 sm:px-6">
              <div className="relative size-[88px] shrink-0">
                <svg viewBox="0 0 80 80" className="size-full -rotate-90">
                  <circle cx="40" cy="40" r={R} fill="none" stroke="var(--color-hairline)" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r={R}
                    fill="none"
                    stroke="var(--color-sage)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - ring / 100)}
                    style={{ transition: playing ? "stroke-dashoffset 1.4s var(--ease-luxe)" : "none" }}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="font-display text-[1.5rem] text-ink tabular-nums">
                    <Count to={responded} zero={zero} />%
                  </span>
                  <span className="mt-0.5 text-[10px] text-ink-faint">{c.ring}</span>
                </span>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-2.5">
                {[
                  { icon: Eye, label: v.views, value: STATS.views },
                  { icon: ScanLine, label: v.scans, value: STATS.scans },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-cream/70 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <Icon className="size-3.5 text-gold-deep" strokeWidth={1.5} />
                      {label}
                    </span>
                    <span className="font-display text-xl leading-none text-ink tabular-nums">
                      <Count to={value} zero={zero} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#fffcf6] px-5 py-5 sm:px-6">
              <p className="text-[13px] font-medium text-ink">{v.activity}</p>
              {/* rows reserve their space, so nothing below moves as they arrive */}
              <ul className="mt-3 space-y-3">
                {v.feed.map((f, i) => {
                  const on = !playing || step >= 2 + i;
                  return (
                    <li
                      key={f.name}
                      className={cn("flex items-start gap-3 transition-[opacity,translate] duration-500 ease-luxe", on ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0 rtl:-translate-x-3")}
                    >
                      <span className={cn("mt-[6px] size-1.5 shrink-0 rounded-full", TONE[f.tone] ?? "bg-ink-faint")} />
                      <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                        <span className="font-medium text-ink">{f.name}</span> <span className="text-ink-soft">{f.action}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-faint">{f.time}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div
                className={cn(
                  "relative mt-4 flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full text-[13px] font-medium transition-colors duration-500",
                  reminded ? "bg-sage-soft text-sage" : "border border-hairline bg-cream text-ink",
                )}
              >
                {reminded ? <Check className="size-4" strokeWidth={2.25} /> : <Bell className="size-4 text-gold-deep" strokeWidth={1.5} />}
                <span className="truncate">{fmt(reminded ? c.reminded[mode] : c.remind[mode], { count: n(STATS.pending) })}</span>
                {playing && step === 6 ? <span className="ivx-ripple" /> : null}
              </div>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
