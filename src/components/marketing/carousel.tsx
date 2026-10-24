"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Swipe carousel for phones (scroll-snap, arrows, dots and an "01 / 16" counter) that becomes a
 * plain grid from `gridFrom` up. Works in both directions; the counter always reads left to right.
 */
export function Carousel({
  children,
  labels,
  gridFrom = "lg",
  itemClassName,
  gridClassName,
  itemClassFor,
  className,
}: {
  children: ReactNode;
  labels: { previous: string; next: string; goTo: string };
  gridFrom?: "md" | "lg";
  /** Width of each slide on phones, e.g. "w-[78%]". */
  itemClassName?: string;
  /** Grid columns once it becomes a grid, e.g. "lg:grid-cols-4". */
  gridClassName?: string;
  /** Extra classes for one slide (e.g. hide some once it's a grid). */
  itemClassFor?: (index: number) => string | undefined;
  className?: string;
}) {
  const { dir } = useI18n();
  const track = useRef<HTMLUListElement>(null);
  const items = Children.toArray(children);
  const [index, setIndex] = useState(0);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    if (!first) return;
    const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || "0");
    setIndex(Math.min(items.length - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / step))));
  }, [items.length]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    return () => el.removeEventListener("scroll", measure);
  }, [measure]);

  const goTo = (i: number) => {
    const el = track.current;
    const target = el?.children[Math.max(0, Math.min(items.length - 1, i))] as HTMLElement | undefined;
    if (!el || !target) return;
    const start = dir === "rtl" ? el.getBoundingClientRect().right - target.getBoundingClientRect().right : target.getBoundingClientRect().left - el.getBoundingClientRect().left;
    el.scrollBy({ left: (dir === "rtl" ? -1 : 1) * (start - parseFloat(getComputedStyle(el).scrollPaddingInlineStart || "0")), behavior: "smooth" });
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const grid = gridFrom === "lg" ? "lg:grid lg:overflow-visible lg:px-0 lg:pb-0" : "md:grid md:overflow-visible md:px-0 md:pb-0";
  const hideFrom = gridFrom === "lg" ? "lg:hidden" : "md:hidden";

  return (
    <div className={className}>
      <ul
        ref={track}
        className={cn(
          "scrollbar-none -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8",
          grid,
          gridClassName,
        )}
      >
        {items.map((child, i) => (
          <li key={i} className={cn("shrink-0 snap-start", gridFrom === "lg" ? "lg:w-auto" : "md:w-auto", itemClassName, itemClassFor?.(i))}>
            {child}
          </li>
        ))}
      </ul>

      {items.length > 1 ? (
        <div className={cn("mt-5 flex items-center justify-between gap-4", hideFrom)}>
          <p className="min-w-14 font-display text-lg tabular-nums text-ink" dir="ltr" aria-live="polite">
            {pad(index + 1)} <span className="text-ink-faint">/ {pad(items.length)}</span>
          </p>
          <div aria-hidden="true" className="flex max-w-[45%] flex-wrap items-center justify-center gap-1.5">
            {items.map((_, i) => (
              <span key={i} className={cn("block h-1.5 rounded-full transition-all duration-500 ease-luxe", i === index ? "w-4 bg-gold-deep" : "w-1.5 bg-hairline")} />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label={labels.previous}
              className="flex size-11 items-center justify-center rounded-full border border-hairline bg-cream text-ink transition hover:border-gold disabled:opacity-35"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === items.length - 1}
              aria-label={labels.next}
              className="flex size-11 items-center justify-center rounded-full border border-hairline bg-cream text-ink transition hover:border-gold disabled:opacity-35"
            >
              <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
