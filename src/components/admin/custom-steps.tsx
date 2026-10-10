"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** The custom-event flow: the event, its design, then the host and price, then sending the link. */
export const CUSTOM_STEPS = ["Event", "Design", "Host & payment", "Send link"] as const;

/**
 * Step bar for Admin → Custom events. Once the event exists, every step is a link (`links`);
 * `onSelect` lets a single-page form revisit earlier steps.
 */
export function CustomSteps({
  current,
  onSelect,
  links = {},
}: {
  current: number;
  onSelect?: (index: number) => void;
  links?: Partial<Record<number, string>>;
}) {
  return (
    <ol
      className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2"
      aria-label="Steps"
    >
      {CUSTOM_STEPS.map((label, i) => {
        const state = i === current ? "current" : i < current ? "done" : "todo";
        const inner = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[12px]",
                state === "current"
                  ? "bg-ink text-ivory"
                  : state === "done"
                    ? "bg-bronze-100 text-bronze-700"
                    : "border border-line-strong bg-paper",
              )}
            >
              {state === "done" ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </span>
            <span className={cn(state !== "current" && "hidden sm:inline")}>
              {label}
            </span>
          </>
        );
        const cls = cn(
          "flex items-center gap-2 text-[13px] transition",
          state === "current"
            ? "font-medium text-ink"
            : state === "done"
              ? "text-ink-soft"
              : "text-ink-faint",
        );
        const href = links[i];
        return (
          <li key={label} className="flex items-center gap-3">
            {i > 0 ? (
              <span className="h-px w-3 bg-line sm:w-4" aria-hidden />
            ) : null}
            {href && i !== current ? (
              <Link href={href} className={cn(cls, "hover:text-ink")}>
                {inner}
              </Link>
            ) : onSelect && i < current ? (
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={cn(cls, "hover:text-ink")}
              >
                {inner}
              </button>
            ) : (
              <span
                className={cls}
                aria-current={state === "current" ? "step" : undefined}
              >
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
