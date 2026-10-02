import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-line bg-paper px-3.5 text-[15px] text-ink placeholder:text-ink-faint/80 transition-colors duration-200 " +
  "hover:border-line-strong focus:border-bronze-400 focus:outline-none focus:ring-4 focus:ring-bronze-100 " +
  "disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-faint aria-[invalid=true]:border-rosewood/60 aria-[invalid=true]:focus:ring-rosewood-soft";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(base, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(base, "resize-y py-2.5 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(base, "h-11 appearance-none pe-10", className)} {...rest}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-[13px] font-medium text-ink-soft", className)}>
      {children}
    </label>
  );
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="ms-1.5 font-normal text-ink-faint">{optional}</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-rosewood" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
