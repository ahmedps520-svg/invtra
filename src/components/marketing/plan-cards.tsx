"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, Check, FlaskConical } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlanCard = {
  tier: PlanTier;
  name: string;
  tagline: string;
  price: string;
  sub: string;
  features: string[];
  cta: { href: string; label: string; external?: boolean };
  featured: boolean;
  badge?: string;
};

/** Slider position (0–100) → guests: fine steps up to 100, then 100–500, then "more than 500". */
function guestsAt(p: number): number {
  if (p <= 50) return Math.max(10, Math.round((10 + (p / 50) * 90) / 5) * 5);
  if (p <= 85) return Math.round((100 + ((p - 50) / 35) * 400) / 10) * 10;
  return 501;
}
const tierFor = (g: number): PlanTier => (g <= 100 ? "BASIC" : g <= 500 ? "PREMIUM" : "CUSTOM");

/** Plan cards with a guest-count slider that highlights the plan that fits. */
export function PlanCards({
  plans,
  copy,
  numberFormat,
}: {
  plans: PlanCard[];
  copy: { slider: string; guests: string; over: string; fits: string; test: string };
  numberFormat: "en" | "ar";
}) {
  const id = useId();
  const [pos, setPos] = useState(56);
  const guests = guestsAt(pos);
  const fit = tierFor(guests);
  const n = (x: number) => new Intl.NumberFormat(numberFormat === "ar" ? "ar-u-nu-latn" : "en").format(x);
  const label = guests > 500 ? copy.over : copy.guests.replace("{n}", n(guests));
  const fitName = plans.find((p) => p.tier === fit)?.name ?? "";

  return (
    <div>
      <div className="ivx-paper-light mx-auto mb-10 max-w-2xl px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={`${id}-guests`} className="text-[14px] font-medium text-ink">
            {copy.slider}
          </label>
          <output htmlFor={`${id}-guests`} aria-live="polite" className="font-display text-[1.6rem] leading-none text-ink tabular-nums">
            {label}
          </output>
        </div>
        <input
          id={`${id}-guests`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={pos}
          aria-valuetext={label}
          onChange={(e) => setPos(Number(e.target.value))}
          className="ivx-range mt-4 w-full"
          style={{ ["--ivx-range" as string]: `${pos}%` }}
        />
        <p className="mt-3 text-[13px] text-gold-deep">{copy.fits.replace("{plan}", fitName)}</p>
      </div>

      <ul className="grid items-stretch gap-6 lg:grid-cols-3 lg:gap-5 xl:gap-7">
        {plans.map((plan) => {
          const on = plan.tier === fit;
          const f = plan.featured;
          return (
            <li key={plan.tier} className={cn("transition-[translate] duration-500 ease-luxe", on && "lg:-translate-y-3")}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-[1.5rem] border p-7 transition-[box-shadow,border-color] duration-500 ease-luxe sm:p-9",
                  f ? "border-[#2c2620] bg-[#1c1815] text-ivory" : "border-hairline bg-[#fffcf6]",
                  on ? "shadow-[0_0_0_2px_var(--color-gold),0_40px_80px_-40px_rgb(60_44_24/0.55)]" : f ? "shadow-[0_40px_80px_-40px_rgb(30_26_22/0.6)]" : "shadow-soft",
                )}
              >
                {on ? (
                  <span className="absolute -top-3 start-7 rounded-full bg-gold px-3 py-1 text-[11.5px] font-medium text-[#1c1815]">{copy.fits.replace("{plan}", plan.name)}</span>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <h3 className={cn("font-display text-[1.9rem] leading-none", f ? "text-ivory" : "text-ink")}>{plan.name}</h3>
                  {plan.badge ? (
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-medium tracking-wide text-[#e8d3a6]">{plan.badge}</span>
                  ) : null}
                </div>
                <p className={cn("mt-3 min-h-[3rem] text-[14.5px] leading-relaxed", f ? "text-[#b9afa2]" : "text-ink-faint")}>{plan.tagline}</p>
                <p className={cn("mt-6 font-display text-[3.2rem] leading-none tabular-nums lining-nums", f ? "text-ivory" : "text-ink")}>{plan.price}</p>
                <p className={cn("mt-3 text-[13px]", f ? "text-[#a99f93]" : "text-ink-faint")}>{plan.sub}</p>
                <p
                  className={cn(
                    "mt-5 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium",
                    f ? "bg-white/10 text-[#e8d3a6]" : "bg-gold-soft/70 text-gold-deep",
                  )}
                >
                  <FlaskConical className="size-3.5" strokeWidth={1.6} />
                  {copy.test}
                </p>
                {plan.cta.external ? (
                  <a href={plan.cta.href} className={buttonClasses("outline", "lg", "group mt-7 w-full")}>
                    {plan.cta.label}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </a>
                ) : (
                  <Link
                    href={plan.cta.href}
                    className={buttonClasses(f ? "accent" : "primary", "lg", cn("group mt-7 w-full", f && "bg-gold text-[#1c1815] hover:bg-[#c5a66c]"))}
                  >
                    {plan.cta.label}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                )}
                <div className={cn("my-7 h-px", f ? "bg-white/10" : "bg-hairline")} />
                <ul className="space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className={cn("flex gap-3 text-[14.5px] leading-snug", f ? "text-[#e9e2d8]" : "text-ink-soft")}>
                      <Check className={cn("mt-0.5 size-4 shrink-0", f ? "text-gold" : "text-gold-deep")} strokeWidth={1.75} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
