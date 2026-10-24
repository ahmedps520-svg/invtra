"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** A labelled row of toggle buttons (chips, or a segmented control). Tap targets are 44px tall. */
export function Choices<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
  segmented,
  scroll,
  disabled,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; lang?: string }[];
  className?: string;
  segmented?: boolean;
  scroll?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <span id={id} className="text-[13px] font-medium text-ink">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        title={disabled ? hint : undefined}
        className={cn(
          "mt-1.5 flex gap-1.5",
          segmented && "rounded-xl border border-hairline bg-[#fffcf6] p-1",
          scroll && "scrollbar-none ivx-fade-end -mx-1 overflow-x-auto px-1 pb-0.5 pe-6",
          disabled && "opacity-40 saturate-0",
        )}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              lang={o.lang}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] px-3.5 text-[14px] transition-colors duration-300",
                segmented && "flex-1 px-2",
                on && !disabled
                  ? "bg-ink text-cream shadow-[0_6px_14px_-8px_rgb(30_26_22/0.6)]"
                  : on
                    ? "bg-hairline text-ink"
                  : segmented
                    ? "text-ink-soft hover:text-ink"
                    : "border border-hairline bg-[#fffcf6] text-ink-soft hover:border-gold hover:text-ink",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
