"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Check, LinkIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormAlert, PasswordInput } from "./form-parts";
import { PASSWORD_MIN } from "./next-path";

type Errors = { password?: string; confirm?: string };

/** Shown when the reset link is missing, used or expired. */
export function InvalidResetLink({ missing }: { missing?: boolean }) {
  const { dict } = useI18n();
  const t = dict.auth.reset;
  return (
    <div role="alert" className="rounded-2xl border border-line bg-paper p-6 sm:p-7">
      <span className="flex size-11 items-center justify-center rounded-full border border-ochre/25 bg-ochre-soft text-ochre">
        <LinkIcon className="size-5" strokeWidth={1.5} />
      </span>
      <h2 className="mt-5 font-display text-2xl text-ink">{missing ? t.missingTitle : t.invalidTitle}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{missing ? t.missingBody : t.invalidBody}</p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link href="/forgot-password" className={buttonClasses("primary", "md")}>
          {t.requestNew}
        </Link>
        <Link href="/login" className={buttonClasses("ghost", "md")}>
          {t.backToLogin}
        </Link>
      </div>
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { dict } = useI18n();
  const t = dict.auth;
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const longEnough = password.length >= PASSWORD_MIN;

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setFormError(null);
    const local: Errors = {};
    if (password.length < PASSWORD_MIN) local.password = t.errors.passwordShort;
    else if (confirm !== password) local.confirm = t.errors.passwordMismatch;
    setErrors(local);
    if (local.password) return passwordRef.current?.focus();
    if (local.confirm) return confirmRef.current?.focus();

    setSubmitting(true);
    try {
      await api("/api/auth/reset", { body: { token, password } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.code === "invalid_token") return setInvalid(true);
      if (err instanceof ApiError && err.status === 422) {
        if (err.fields?.token) return setInvalid(true);
        setErrors({ password: t.errors.passwordShort });
        return passwordRef.current?.focus();
      }
      setFormError(
        err instanceof ApiError && err.status === 429
          ? t.errors.rateLimited
          : err instanceof ApiError && err.status === 0
            ? t.errors.network
            : t.errors.generic,
      );
    }
  }

  if (invalid) return <InvalidResetLink />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <div>
        <Label htmlFor="reset-password">{t.fields.newPassword}</Label>
        <PasswordInput
          ref={passwordRef}
          id="reset-password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(errors.password)}
          hasHint
        />
        {errors.password ? (
          <p id="reset-password-error" role="alert" className="mt-1.5 text-[13px] text-rosewood">
            {errors.password}
          </p>
        ) : (
          <p
            id="reset-password-hint"
            className={cn(
              "mt-1.5 flex items-center gap-1.5 text-[13px] transition-colors",
              longEnough ? "text-sage" : "text-ink-faint",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 items-center justify-center rounded-full border transition-colors",
                longEnough ? "border-sage bg-sage text-white" : "border-line-strong",
              )}
            >
              {longEnough ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            {t.signup.passwordHint}
          </p>
        )}
      </div>
      <Field id="reset-confirm" label={t.fields.confirmPassword} error={errors.confirm}>
        <PasswordInput
          ref={confirmRef}
          id="reset-confirm"
          name="confirm"
          autoComplete="new-password"
          required
          maxLength={200}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          invalid={Boolean(errors.confirm)}
        />
      </Field>
      <Button type="submit" size="lg" className="mt-2 w-full" loading={submitting}>
        {t.reset.submit}
      </Button>
    </form>
  );
}
