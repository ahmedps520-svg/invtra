"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";

/** Accessible accordion (WAI-ARIA disclosure pattern) for the FAQ. */
export function FaqList({ className }: { className?: string }) {
  const { dict } = useI18n();
  const items = dict.marketing.faq.items;
  const base = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ul className={cn("border-t border-line", className)}>
      {items.map((item, i) => {
        const isOpen = open.has(i);
        const buttonId = `${base}-q${i}`;
        const panelId = `${base}-a${i}`;
        return (
          <li key={item.q} className="border-b border-line">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                className="group flex w-full items-start justify-between gap-6 py-6 text-start"
              >
                <span
                  className={cn(
                    "font-display text-[1.35rem] leading-snug transition-colors duration-300 sm:text-[1.5rem]",
                    isOpen ? "text-ink" : "text-ink group-hover:text-bronze-800",
                  )}
                >
                  {item.q}
                </span>
                <span
                  className={cn(
                    "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-luxe",
                    isOpen
                      ? "rotate-45 border-bronze-400 bg-bronze-50 text-bronze-700"
                      : "border-line-strong text-ink-soft group-hover:border-bronze-400",
                  )}
                  aria-hidden="true"
                >
                  <Plus className="size-4" strokeWidth={1.5} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-500 ease-luxe",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-7 pe-14 text-[16px] leading-relaxed text-ink-soft">{item.a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
