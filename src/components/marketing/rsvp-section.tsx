import { Bell, Download, Eye, ScanLine, Radio } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

const POINT_ICONS = [Radio, Eye, Bell, Download];
const STATS = { guests: 250, accepted: 183, declined: 32, pending: 35, views: 147, scans: 98 };

const TONE_DOT: Record<string, string> = {
  sage: "bg-sage",
  rosewood: "bg-rosewood",
  ochre: "bg-ochre",
  slate: "bg-slate",
  bronze: "bg-bronze-500",
};

/** RSVP tracking & event management, illustrated by a static dashboard vignette. */
export function RsvpSection({ dict, locale }: { dict: Dictionary; locale: "en" | "ar" }) {
  const t = dict.marketing.rsvp;
  const v = t.vignette;
  const n = (x: number) => formatNumber(x, locale);
  const pct = (x: number) => (x / STATS.guests) * 100;
  const responded = Math.round(pct(STATS.accepted + STATS.declined));

  const tiles = [
    { label: v.guests, value: STATS.guests, dot: "bg-ink-faint" },
    { label: v.accepted, value: STATS.accepted, dot: "bg-sage" },
    { label: v.declined, value: STATS.declined, dot: "bg-rosewood" },
    { label: v.pending, value: STATS.pending, dot: "bg-ochre" },
  ];

  return (
    <section
      aria-labelledby="rsvp-title"
      className="relative overflow-hidden border-t border-line/70 bg-[linear-gradient(180deg,var(--color-ivory),var(--color-sand)_140%)]"
    >
      <div className={cn(CONTAINER, "grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-12 lg:gap-12")}>
        <div className="lg:col-span-5">
          <Reveal>
            <p className={EYEBROW}>{t.eyebrow}</p>
            <h2 id="rsvp-title" className="mt-4 font-display text-[2.5rem] leading-[1.08] text-balance text-ink sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-pretty text-ink-soft">{t.body}</p>
          </Reveal>
          <ul className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {t.points.map((p, i) => {
              const Icon = POINT_ICONS[i];
              return (
                <li key={p.title}>
                  <Reveal delay={i * 60}>
                    <Icon className="size-5 text-bronze-600" strokeWidth={1.25} />
                    <h3 className="mt-4 text-[15px] font-medium text-ink">{p.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink-faint">{p.body}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>

        <Reveal className="lg:col-span-7 lg:col-start-6">
          <figure
            role="img"
            aria-label={v.label}
            className="relative rounded-[1.75rem] border border-line bg-paper p-2 shadow-lift"
          >
            <div aria-hidden="true" className="overflow-hidden rounded-[1.35rem] border border-line/70 bg-ivory/60">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-5 sm:px-7">
                <div className="min-w-0">
                  <p className="font-display text-[1.6rem] leading-tight text-ink">{v.event}</p>
                  <p className="mt-1 text-[13px] text-ink-faint">{v.date}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-sage/25 bg-sage-soft px-3 py-1 text-[12px] font-medium text-sage">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage/50 motion-reduce:hidden" />
                    <span className="relative inline-flex size-2 rounded-full bg-sage" />
                  </span>
                  {v.live}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-px bg-line/70 sm:grid-cols-4">
                {tiles.map((s) => (
                  <div key={s.label} className="bg-paper px-5 py-5 sm:px-6">
                    <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-ink-faint uppercase rtl:text-[12px]">
                      <span className={cn("size-1.5 rounded-full", s.dot)} />
                      {s.label}
                    </p>
                    <p className="mt-2.5 font-display text-[2.6rem] leading-none text-ink tabular-nums lining-nums">
                      {n(s.value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-px bg-line/70 md:grid-cols-[1.15fr_1fr]">
                {/* Responses + engagement */}
                <div className="bg-paper px-5 py-6 sm:px-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-medium text-ink">{v.responses}</p>
                    <p className="text-[12px] text-ink-faint">{fmt(v.responded, { percent: responded })}</p>
                  </div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-mist">
                    <span className="h-full bg-sage" style={{ width: `${pct(STATS.accepted)}%` }} />
                    <span className="h-full bg-rosewood/80" style={{ width: `${pct(STATS.declined)}%` }} />
                    <span className="h-full bg-ochre/70" style={{ width: `${pct(STATS.pending)}%` }} />
                  </div>
                  <div className="mt-7 grid grid-cols-2 gap-4">
                    {[
                      { icon: Eye, label: v.views, value: STATS.views },
                      { icon: ScanLine, label: v.scans, value: STATS.scans },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-xl border border-line bg-ivory/70 px-4 py-3.5">
                        <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                          <Icon className="size-3.5 text-bronze-500" strokeWidth={1.5} />
                          {label}
                        </p>
                        <p className="mt-1.5 font-display text-3xl leading-none text-ink tabular-nums lining-nums">{n(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity */}
                <div className="bg-paper px-5 py-6 sm:px-7">
                  <p className="text-[13px] font-medium text-ink">{v.activity}</p>
                  <ul className="mt-4 space-y-4">
                    {v.feed.map((f) => (
                      <li key={f.name} className="flex items-start gap-3">
                        <span className="mt-[7px] flex size-2 shrink-0 items-center justify-center">
                          <span className={cn("size-1.5 rounded-full", TONE_DOT[f.tone] ?? "bg-ink-faint")} />
                        </span>
                        <span className="min-w-0 flex-1 text-[13px] leading-snug">
                          <span className="font-medium text-ink">{f.name}</span> <span className="text-ink-soft">{f.action}</span>
                          <span className="mt-0.5 block text-[11.5px] text-ink-faint">{f.time}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
