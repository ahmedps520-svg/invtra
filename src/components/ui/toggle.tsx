"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")} htmlFor={id}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-300",
          checked ? "bg-bronze-600" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform duration-300 ease-luxe",
            checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5",
          )}
        />
      </button>
      {label || description ? (
        <span className="min-w-0">
          {label ? <span className="block text-sm font-medium text-ink">{label}</span> : null}
          {description ? <span className="mt-0.5 block text-[13px] text-ink-faint">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-sm", className)}>
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer rounded border-line-strong accent-bronze-600"
      />
      {label}
    </label>
  );
}

/** Segmented control for 2–5 mutually exclusive options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-full border border-line bg-sand/60 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full font-medium transition-all duration-300 ease-luxe",
            size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-[13px]",
            value === o.value ? "bg-paper text-ink shadow-soft" : "text-ink-faint hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
