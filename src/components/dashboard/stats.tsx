"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { cn, percent } from "@/lib/utils";

export type TileTone = "default" | "sage" | "rosewood" | "ochre" | "slate" | "bronze";

const dot: Record<TileTone, string> = {
  default: "bg-ink-faint",
  sage: "bg-sage",
  rosewood: "bg-rosewood",
  ochre: "bg-ochre",
  slate: "bg-slate",
  bronze: "bg-bronze-500",
};

/** Headline number tile ("183 Accepted"). */
export function Tile({
  label,
  value,
  hint,
  tone = "default",
  locale,
  size = "lg",
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: TileTone;
  locale: Locale;
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-paper px-5 py-4 shadow-soft", className)}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
        <span className={cn("size-1.5 shrink-0 rounded-full", dot[tone])} />
        <span className="truncate">{label}</span>
      </div>
      <motion.div
        key={value}
        initial={{ opacity: 0.4, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn("mt-2.5 font-display leading-none text-ink lining-nums tabular-nums", size === "lg" ? "text-[2.6rem]" : "text-3xl")}
      >
        {formatNumber(value, locale)}
      </motion.div>
      {hint ? <div className="mt-2 truncate text-xs text-ink-faint">{hint}</div> : null}
    </div>
  );
}

/** Donut of accepted / declined / pending with the reply rate in the middle. */
export function ResponseRing({
  accepted,
  declined,
  pending,
  label,
  locale,
}: {
  accepted: number;
  declined: number;
  pending: number;
  label: string;
  locale: Locale;
}) {
  const reduce = useReducedMotion();
  const total = accepted + declined + pending;
  const r = 52;
  const c = 2 * Math.PI * r;
  const gap = total > 1 ? 2.5 : 0;
  const segs = [
    { value: accepted, color: "var(--color-sage)" },
    { value: declined, color: "var(--color-rosewood)" },
    { value: pending, color: "var(--color-ochre)" },
  ];
  let offset = 0;
  const replied = percent(accepted + declined, total);
  return (
    <div className="relative mx-auto size-44 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90 rtl:scale-y-[-1]" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-mist)" strokeWidth="9" />
        {total
          ? segs.map((s, i) => {
              if (!s.value) return null;
              const len = (s.value / total) * c;
              const dash = Math.max(0, len - (segs.filter((x) => x.value).length > 1 ? gap : 0));
              const el = (
                <motion.circle
                  key={i}
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="9"
                  strokeLinecap="butt"
                  strokeDashoffset={-offset}
                  initial={reduce ? false : { strokeDasharray: `0 ${c}` }}
                  animate={{ strokeDasharray: `${dash} ${c - dash}` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 * i }}
                />
              );
              offset += len;
              return el;
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-4xl leading-none text-ink lining-nums tabular-nums">{formatNumber(replied, locale)}%</span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-faint">{label}</span>
      </div>
    </div>
  );
}

/** Thin stacked bar used where a ring would be too large. */
export function ResponseBar({ accepted, declined, pending, className }: { accepted: number; declined: number; pending: number; className?: string }) {
  const total = accepted + declined + pending || 1;
  return (
    <div className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-mist", className)} aria-hidden>
      <span className="h-full bg-sage transition-[width] duration-700 ease-luxe" style={{ width: `${(accepted / total) * 100}%` }} />
      <span className="h-full bg-rosewood transition-[width] duration-700 ease-luxe" style={{ width: `${(declined / total) * 100}%` }} />
      <span className="h-full bg-ochre/70 transition-[width] duration-700 ease-luxe" style={{ width: `${(pending / total) * 100}%` }} />
    </div>
  );
}
