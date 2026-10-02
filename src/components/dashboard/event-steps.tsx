"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Check, LayoutGrid } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";
import { STEP_KEYS, STEP_PATHS, stepHref, type StepKey, type StepState } from "./steps";

/** Overview tab + the 1–5 workflow stepper. Highlights the current route. */
export function EventStepNav({ eventId, steps }: { eventId: string; steps: StepState }) {
  const { dict } = useI18n();
  const d = dict.dashboard.steps;
  const pathname = usePathname() ?? "";
  const base = `/dashboard/events/${eventId}`;
  const current: StepKey | "overview" | null =
    pathname === base ? "overview" : (STEP_KEYS.find((k) => pathname.startsWith(`${base}/${STEP_PATHS[k]}`)) ?? null);
  const navRef = useRef<HTMLElement>(null);

  // On narrow screens keep the current step visible inside the scrollable stepper.
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !el || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    nav.scrollBy({ left: box.left + box.width / 2 - (navBox.left + navBox.width / 2), behavior: "smooth" });
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label={d.label} className="scrollbar-none relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex min-w-max items-center gap-2 rounded-full border border-line bg-paper/70 p-1.5 shadow-soft">
        <li>
          <Link
            href={base}
            aria-current={current === "overview" ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-300 ease-luxe",
              current === "overview" ? "bg-ink text-ivory shadow-soft" : "text-ink-soft hover:bg-sand hover:text-ink",
            )}
          >
            <LayoutGrid className="size-3.5" />
            {d.overview}
          </Link>
        </li>
        <li aria-hidden className="mx-1 h-5 w-px bg-line" />
        {STEP_KEYS.map((k, i) => {
          const active = current === k;
          const done = steps[k];
          return (
            <li key={k} className="flex items-center">
              {i > 0 ? <span aria-hidden className={cn("me-2 h-px w-4 sm:w-6", steps[STEP_KEYS[i - 1]] ? "bg-bronze-300" : "bg-line")} /> : null}
              <Link
                href={stepHref(eventId, k)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-full py-1.5 pe-4 ps-1.5 text-[13px] font-medium transition-all duration-300 ease-luxe",
                  active ? "bg-sand text-ink" : "text-ink-soft hover:bg-sand/70 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors",
                    active
                      ? "bg-ink text-ivory"
                      : done
                        ? "bg-bronze-600 text-white"
                        : "border border-line-strong bg-paper text-ink-faint",
                  )}
                >
                  {done && !active ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                </span>
                {d[k]}
                <span className="sr-only">{done ? ` — ${d.done}` : ` — ${d.todo}`}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
