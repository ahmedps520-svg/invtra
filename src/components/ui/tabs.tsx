"use client";

import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Underlined tab bar with an animated indicator. Content switching is up to the caller. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn("scrollbar-none flex gap-6 overflow-x-auto border-b border-line", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors",
              active ? "text-ink" : "text-ink-faint hover:text-ink-soft",
            )}
          >
            {it.label}
            {typeof it.count === "number" ? (
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-ink text-ivory" : "bg-sand text-ink-faint")}>
                {it.count}
              </span>
            ) : null}
            {active ? (
              <motion.span layoutId={`tab-${id}`} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-bronze-600" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
