"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

export type ReasonSpec = { label: string; placeholder?: string; required?: boolean; minLength?: number; field?: string };
export type CheckboxSpec = { label: string; description?: string; field: string; defaultChecked?: boolean };

/**
 * Confirmation dialog for consequential admin actions, optionally collecting a reason
 * (stored in the audit log) and a single extra option.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "primary",
  reason,
  checkbox,
  children,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "accent";
  reason?: ReasonSpec;
  checkbox?: CheckboxSpec;
  children?: ReactNode;
  onConfirm: (input: { reason: string; checked: boolean }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(checkbox?.defaultChecked ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const min = reason?.required ? Math.max(3, reason.minLength ?? 3) : 0;
  const tooShort = Boolean(reason?.required) && text.trim().length < min;

  async function submit() {
    if (tooShort) {
      setError(`Please give a reason (at least ${min} characters).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ reason: text.trim(), checked });
      setText("");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        {reason ? (
          <Field id="confirm-reason" label={reason.label} optional={reason.required ? undefined : "(optional)"} error={error && tooShort ? error : null}>
            <Textarea
              id="confirm-reason"
              rows={3}
              maxLength={500}
              value={text}
              placeholder={reason.placeholder}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={Boolean(error && tooShort)}
            />
          </Field>
        ) : null}
        {checkbox ? (
          <div>
            <Checkbox checked={checked} onChange={setChecked} label={<span className="text-ink">{checkbox.label}</span>} />
            {checkbox.description ? <p className="ms-[26px] mt-1 text-[13px] text-ink-faint">{checkbox.description}</p> : null}
          </div>
        ) : null}
        {error && !tooShort ? (
          <p role="alert" className="rounded-xl border border-rosewood/20 bg-rosewood-soft px-3.5 py-2.5 text-[13px] text-rosewood">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

type ActionResponse = { message?: string; notice?: string; redirectTo?: string } | null;

/**
 * A button that performs one admin API call (optionally behind a confirmation with a
 * reason), then toasts and refreshes the server-rendered page.
 */
export function AdminAction({
  url,
  method = "POST",
  body,
  label,
  icon,
  variant = "outline",
  size = "sm",
  confirm,
  successMessage,
  disabled,
  title,
  className,
}: {
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  label: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  confirm?: {
    title: ReactNode;
    description?: ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger" | "accent";
    reason?: ReasonSpec;
    checkbox?: CheckboxSpec;
  };
  successMessage?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(extra: Record<string, unknown> = {}) {
    const res = await api<ActionResponse>(url, { method, body: { ...(body ?? {}), ...extra } });
    toast(res?.notice ?? res?.message ?? successMessage ?? "Done", res?.notice ? "info" : "success");
    if (res?.redirectTo) router.push(res.redirectTo);
    else router.refresh();
  }

  async function direct() {
    setBusy(true);
    try {
      await run();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        loading={busy}
        disabled={disabled}
        title={title}
        className={className}
        onClick={() => (confirm ? setOpen(true) : direct())}
      >
        {label}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          reason={confirm.reason}
          checkbox={confirm.checkbox}
          onConfirm={async ({ reason, checked }) => {
            const extra: Record<string, unknown> = {};
            if (confirm.reason) extra[confirm.reason.field ?? "reason"] = reason;
            if (confirm.checkbox) extra[confirm.checkbox.field] = checked;
            await run(extra);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
