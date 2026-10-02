"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { FieldInput, FormAlert, PasswordInput } from "./form-parts";
import { EMAIL_RE } from "./next-path";

type Errors = { email?: string; password?: string };

export function LoginForm({ next, forgotHref }: { next: string; forgotHref: string }) {
  const { dict } = useI18n();
  const t = dict.auth;
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const focusFirst = (e: Errors) => (e.email ? emailRef : passwordRef).current?.focus();

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setFormError(null);
    const local: Errors = {};
    if (!EMAIL_RE.test(email.trim())) local.email = t.errors.emailInvalid;
    if (!password) local.password = t.errors.passwordRequired;
    setErrors(local);
    if (local.email || local.password) return focusFirst(local);

    setSubmitting(true);
    try {
      await api("/api/auth/login", { body: { email: email.trim(), password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) return setFormError(t.errors.generic);
      if (err.status === 422 && err.fields) {
        const f: Errors = {};
        if (err.fields.email) f.email = t.errors.emailInvalid;
        if (err.fields.password) f.password = t.errors.passwordRequired;
        setErrors(f);
        return focusFirst(f);
      }
      setFormError(
        err.code === "invalid_credentials"
          ? t.errors.invalidCredentials
          : err.code === "account_deactivated"
            ? t.errors.deactivated
            : err.status === 429
              ? t.errors.rateLimited
              : err.status === 0
                ? t.errors.network
                : t.errors.generic,
      );
      if (err.code === "invalid_credentials") passwordRef.current?.select();
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Field id="login-email" label={t.fields.email} error={errors.email}>
        <FieldInput
          ref={emailRef}
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={Boolean(errors.email)}
          dir="ltr"
          className="rtl:text-end"
        />
      </Field>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor="login-password" className="text-[13px] font-medium text-ink-soft">
            {t.fields.password}
          </label>
          <Link href={forgotHref} className="text-[13px] text-bronze-700 underline-offset-4 hover:underline">
            {t.login.forgot}
          </Link>
        </div>
        <PasswordInput
          ref={passwordRef}
          id="login-password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(errors.password)}
        />
        {errors.password ? (
          <p id="login-password-error" role="alert" className="mt-1.5 text-[13px] text-rosewood">
            {errors.password}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="mt-2 w-full" loading={submitting}>
        {t.login.submit}
      </Button>
    </form>
  );
}
