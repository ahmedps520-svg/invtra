"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ChartDay = { date: string; sent: number; accepted: number };

const SERIES = [
  { key: "sent" as const, label: "Messages sent", cls: "fill-bronze-800", swatch: "bg-bronze-800" },
  { key: "accepted" as const, label: "Acceptances", cls: "fill-bronze-500", swatch: "bg-bronze-500" },
];

const H = 220;
const M = { top: 14, right: 8, bottom: 28, left: 38 };

function niceScale(max: number) {
  if (max <= 4) return { max: 4, step: 1 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return { max: Math.ceil(max / step) * step, step };
}

/** Column with a 4px rounded data-end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h}Z`;
}

// Built by hand (not Intl) so server and browser ICU data can never disagree during hydration.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const parts = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return { day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], weekday: WEEKDAYS[d.getUTCDay()] };
};
const fmtDay = (iso: string, withMonth: boolean) => {
  const p = parts(iso);
  return withMonth ? `${p.day} ${p.month}` : String(p.day);
};
const fmtLong = (iso: string) => {
  const p = parts(iso);
  return `${p.weekday} ${p.day} ${p.month}`;
};
const n = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * 14-day grouped column chart (messages sent vs. acceptances). Inline SVG laid out at the
 * container's real width so text never scales; per-day hover/focus readout; legend and
 * a table view so nothing depends on colour or hovering.
 */
export function ActivityChart({ days }: { days: ChartDay[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totals = useMemo(() => ({ sent: days.reduce((s, d) => s + d.sent, 0), accepted: days.reduce((s, d) => s + d.accepted, 0) }), [days]);
  const { max, step } = niceScale(Math.max(1, ...days.map((d) => Math.max(d.sent, d.accepted))));
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const band = plotW / Math.max(1, days.length);
  const barW = Math.max(3, Math.min(12, (band - 10) / 2));
  const gap = 2;
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const labelEvery = band >= 36 ? 1 : band >= 20 ? 2 : 3;
  const summary = `Last ${days.length} days: ${n(totals.sent)} messages sent and ${n(totals.accepted)} invitations accepted.`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-soft">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className={`size-2.5 rounded-[3px] ${s.swatch}`} aria-hidden="true" />
            {s.label}
            <span className="font-medium tabular-nums text-ink">{n(totals[s.key])}</span>
          </span>
        ))}
      </div>

      <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
        <svg width={width} height={H} role="img" aria-label={summary} className="block max-w-full overflow-visible">
          <title>{summary}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-faint text-[11px] tabular-nums">
                {n(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x0 = M.left + i * band;
            const cx = x0 + band / 2;
            const groupW = barW * 2 + gap;
            // Month on the first labelled day and whenever the month changes.
            const prevLabelled = i - labelEvery;
            const first = prevLabelled < 0 || d.date.slice(5, 7) !== days[prevLabelled].date.slice(5, 7);
            const label = `${fmtLong(d.date)}: ${n(d.sent)} sent, ${n(d.accepted)} accepted`;
            return (
              <g
                key={d.date}
                tabIndex={0}
                role="img"
                aria-label={label}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                <rect x={x0} y={M.top} width={band} height={plotH} className={active === i ? "fill-bronze-50" : "fill-transparent"} />
                {SERIES.map((s, k) => {
                  const v = d[s.key];
                  if (!v) return null;
                  const top = y(v);
                  return <path key={s.key} d={barPath(cx - groupW / 2 + k * (barW + gap), top, barW, M.top + plotH - top)} className={s.cls} />;
                })}
                {(days.length - 1 - i) % labelEvery === 0 ? (
                  <text x={cx} y={H - 8} textAnchor="middle" className="fill-ink-faint text-[11px] tabular-nums">
                    {fmtDay(d.date, first)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <line x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} className="stroke-line-strong" strokeWidth={1} shapeRendering="crispEdges" />
        </svg>

        {active !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[150px] -translate-x-1/2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] shadow-lift"
            style={{ left: Math.min(Math.max(M.left + active * band + band / 2, 80), width - 80) }}
            role="status"
          >
            <p className="mb-1 text-ink-faint">{fmtLong(days[active].date)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span className={`h-0.5 w-3 rounded-full ${s.swatch}`} aria-hidden="true" />
                <span className="font-medium tabular-nums text-ink">{n(days[active][s.key])}</span>
                <span className="text-ink-faint">{s.key === "sent" ? "sent" : "accepted"}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <details className="mt-3 text-[13px] text-ink-soft">
        <summary className="cursor-pointer select-none text-ink-faint transition hover:text-ink">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-start text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                <th scope="col" className="py-1.5 pe-4 text-start font-medium">Day</th>
                <th scope="col" className="py-1.5 pe-4 text-end font-medium">Sent</th>
                <th scope="col" className="py-1.5 text-end font-medium">Accepted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {days.map((d) => (
                <tr key={d.date}>
                  <td className="py-1.5 pe-4">{fmtLong(d.date)}</td>
                  <td className="py-1.5 pe-4 text-end tabular-nums">{n(d.sent)}</td>
                  <td className="py-1.5 text-end tabular-nums">{n(d.accepted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
