"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsible editor section: numbered title, one-line summary of the current choice, smooth reveal. */
export function EditorSection({
  id,
  index,
  title,
  description,
  summary,
  aside,
  open,
  onToggle,
  children,
}: {
  id: string;
  index: number;
  title: ReactNode;
  description?: ReactNode;
  summary?: ReactNode;
  aside?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const headId = `${id}-head`;
  const bodyId = `${id}-body`;
  return (
    <section id={id} aria-labelledby={headId} className="scroll-mt-28 border-b border-line last:border-b-0">
      <h3 className="m-0">
        <button
          id={headId}
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="group flex w-full items-center gap-4 px-5 py-5 text-start transition-colors hover:bg-ivory/70 sm:px-7 sm:py-6"
        >
          <span aria-hidden="true" className="w-6 shrink-0 font-display text-lg leading-none text-bronze-500 tabular-nums">
            {String(index).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[1.375rem] leading-tight text-ink">{title}</span>
            {summary ? <span className="mt-1 block truncate text-[13px] text-ink-faint">{summary}</span> : null}
          </span>
          {aside ? <span className="hidden shrink-0 sm:block">{aside}</span> : null}
          <span
            aria-hidden="true"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-faint transition-all duration-300 ease-luxe group-hover:border-line-strong group-hover:text-ink",
              open && "rotate-180 border-bronze-200 bg-bronze-50 text-bronze-700",
            )}
          >
            <ChevronDown className="size-4" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={bodyId}
            role="region"
            aria-labelledby={headId}
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-8 sm:px-7 sm:ps-[4.25rem]">
              {description ? <p className="-mt-1 mb-6 max-w-prose text-sm leading-relaxed text-ink-faint">{description}</p> : null}
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

/** Small uppercase label for a group of controls. */
export function GroupLabel({ children, htmlFor, id, className }: { children: ReactNode; htmlFor?: string; id?: string; className?: string }) {
  const cls = cn("mb-3 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faint", className);
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={cls}>
      {children}
    </label>
  ) : (
    <p id={id} className={cls}>
      {children}
    </p>
  );
}

export function Hint({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <p id={id} className={cn("mt-2 text-[13px] leading-relaxed text-ink-faint", className)}>
      {children}
    </p>
  );
}

/** Calm inline note (info / warning). */
export function Note({ children, tone = "info", icon, className }: { children: ReactNode; tone?: "info" | "warning"; icon?: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "warning" ? "status" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
        tone === "warning" ? "border-ochre/25 bg-ochre-soft/70 text-[#7a5e22]" : "border-line bg-ivory/80 text-ink-soft",
        className,
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&>svg]:size-4", tone === "warning" ? "text-ochre" : "text-bronze-600")}>{icon ?? <Info />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export type Choice<T extends string> = {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  visual?: ReactNode;
  disabled?: boolean;
  /** Extra props for the option's label (e.g. lang/dir for script samples). */
  labelProps?: { lang?: string; dir?: "ltr" | "rtl" };
};

/**
 * Radio tiles built on native radio inputs: arrow keys move between options, the
 * whole tile is clickable, and the selected one gets a bronze ring.
 */
export function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
  columns = 3,
  className,
  tileClassName,
  layout = "stack",
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: Choice<T>[];
  label: string;
  columns?: 2 | 3 | 4;
  className?: string;
  tileClassName?: string;
  /** stack: visual above text. row: visual beside text. */
  layout?: "stack" | "row";
}) {
  const uid = useId();
  const cols = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-3", cols, className)}>
      {options.map((o) => {
        const checked = o.value === value;
        const id = `${uid}-${o.value}`;
        return (
          <label
            key={o.value}
            htmlFor={id}
            className={cn(
              "relative flex cursor-pointer rounded-xl border bg-paper p-3.5 transition-all duration-300 ease-luxe",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze-400 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper",
              layout === "row" ? "items-center gap-3.5" : "flex-col gap-3",
              checked ? "border-bronze-500 bg-bronze-50/50 shadow-soft ring-1 ring-bronze-500" : "border-line hover:border-line-strong hover:bg-ivory/60",
              o.disabled && "cursor-not-allowed opacity-50",
              tileClassName,
            )}
          >
            <input
              id={id}
              type="radio"
              name={`${uid}-${name}`}
              value={o.value}
              checked={checked}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.visual ? <span className={cn("block", layout === "row" && "shrink-0")}>{o.visual}</span> : null}
            <span className="block min-w-0" {...o.labelProps}>
              <span className="block text-sm font-medium text-ink">{o.label}</span>
              {o.hint ? <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">{o.hint}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Range slider styled for the editor. */
export function RangeInput({
  id,
  value,
  min,
  max,
  step,
  onChange,
  valueText,
  describedBy,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  valueText?: string;
  describedBy?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-valuetext={valueText}
      aria-describedby={describedBy}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ["--pct" as string]: `${pct}%` }}
      className={cn(
        "h-6 w-full cursor-pointer appearance-none bg-transparent",
        "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full",
        "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-bronze-500)_var(--pct),var(--color-mist)_var(--pct))]",
        "rtl:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,var(--color-bronze-500)_var(--pct),var(--color-mist)_var(--pct))]",
        "[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
        "[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-bronze-300 [&::-webkit-slider-thumb]:bg-paper [&::-webkit-slider-thumb]:shadow-soft",
        "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-mist",
        "[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-bronze-500",
        "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-bronze-300 [&::-moz-range-thumb]:bg-paper",
        "focus-visible:outline-none [&:focus-visible::-webkit-slider-thumb]:ring-4 [&:focus-visible::-webkit-slider-thumb]:ring-bronze-100",
      )}
    />
  );
}

/** Disclosure for optional, more detailed controls. */
export function Disclosure({ label, defaultOpen = false, children }: { label: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bronze-700 underline-offset-4 hover:underline"
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform duration-300", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={id} className="mt-4 animate-fade-up">
          {children}
        </div>
      ) : null}
    </div>
  );
}
