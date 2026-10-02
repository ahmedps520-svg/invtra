"use client";

import { Fragment, forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";

/** Top-of-form message (error or success), announced to screen readers. */
export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] leading-relaxed",
        tone === "error" ? "border-rosewood/25 bg-rosewood-soft text-rosewood" : "border-sage/25 bg-sage-soft text-sage",
      )}
    >
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Text input wired to a Field: aria-invalid and aria-describedby follow the field state. */
export const FieldInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; hasHint?: boolean }
>(function FieldInput({ id, invalid, hasHint, ...rest }, ref) {
  return (
    <Input
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : hasHint ? `${id}-hint` : undefined}
      {...rest}
    />
  );
});

/** Password input with a show/hide toggle. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean; hasHint?: boolean }
>(function PasswordInput({ id, invalid, hasHint, className, ...rest }, ref) {
  const { dict } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : hasHint ? `${id}-hint` : undefined}
        className={cn("pe-12", className)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? dict.auth.fields.hidePassword : dict.auth.fields.showPassword}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute end-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint transition hover:bg-sand hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
      </button>
    </div>
  );
});

/** Fill {placeholders} in a dictionary string with React nodes (links etc.). */
export function interpolate(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in nodes ? <Fragment key={i}>{nodes[m[1]]}</Fragment> : part;
  });
}
