import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-paper shadow-soft", className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-6 py-5", className)}>
      <div className="min-w-0">
        <h3 className="font-display text-xl font-medium text-ink">{title}</h3>
        {description ? <p className="mt-1 text-sm text-ink-faint">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5", className)} {...rest} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      {icon ? (
        <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-line bg-sand text-bronze-600">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-faint">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "sage" | "rosewood" | "ochre" | "slate" | "bronze";
  className?: string;
}) {
  const dot: Record<string, string> = {
    default: "bg-ink-faint",
    sage: "bg-sage",
    rosewood: "bg-rosewood",
    ochre: "bg-ochre",
    slate: "bg-slate",
    bronze: "bg-bronze-500",
  };
  return (
    <div className={cn("rounded-2xl border border-line bg-paper px-5 py-4", className)}>
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-faint">
        <span className={cn("size-1.5 rounded-full", dot[tone])} />
        {label}
      </div>
      <div className="mt-2 font-display text-4xl leading-none text-ink tabular-nums">{value}</div>
      {hint ? <div className="mt-2 text-xs text-ink-faint">{hint}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-mist", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="h-full rounded-full bg-bronze-600 transition-[width] duration-700 ease-luxe" style={{ width: `${pct}%` }} />
    </div>
  );
}
