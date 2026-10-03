"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/i18n/routing";
import { FieldInput, FormAlert, PasswordInput, interpolate } from "./form-parts";
import { EMAIL_RE, PASSWORD_MIN } from "./next-path";

type Errors = { name?: string; email?: string; password?: string };

const legalLink = "text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink";

export function SignupForm({ next, loginHref }: { next: string; loginHref: string }) {
  const { dict, locale } = useI18n();
  const t = dict.auth;
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const focusFirst = (e: Errors) => {
    const target = e.name ? nameRef : e.email ? emailRef : e.password ? passwordRef : null;
    target?.current?.focus();
  };
  const longEnough = password.length >= PASSWORD_MIN;

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setFormError(null);
    setEmailTaken(false);
    const local: Errors = {};
    if (name.trim().length < 2) local.name = t.errors.nameRequired;
    if (!EMAIL_RE.test(email.trim())) local.email = t.errors.emailInvalid;
    if (password.length < PASSWORD_MIN) local.password = t.errors.passwordShort;
    setErrors(local);
    if (Object.keys(local).length) return focusFirst(local);

    setSubmitting(true);
    try {
      await api("/api/auth/signup", { body: { name: name.trim(), email: email.trim(), password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) return setFormError(t.errors.generic);
      if (err.code === "email_taken") {
        setEmailTaken(true);
        setErrors({ email: t.errors.emailTaken });
        return emailRef.current?.focus();
      }
      if (err.status === 422 && err.fields) {
        const f: Errors = {};
        if (err.fields.name) f.name = t.errors.nameRequired;
        if (err.fields.email) f.email = t.errors.emailInvalid;
        if (err.fields.password) f.password = t.errors.passwordShort;
        setErrors(f);
        return focusFirst(f);
      }
      setFormError(err.status === 429 ? t.errors.rateLimited : err.status === 0 ? t.errors.network : t.errors.generic);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Field id="signup-name" label={t.fields.name} error={errors.name}>
        <FieldInput
          ref={nameRef}
          id="signup-name"
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          invalid={Boolean(errors.name)}
        />
      </Field>
      <div>
        <Field id="signup-email" label={t.fields.email} error={errors.email}>
          <FieldInput
            ref={emailRef}
            id="signup-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={160}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailTaken) setEmailTaken(false);
            }}
            invalid={Boolean(errors.email)}
            dir="ltr"
            className="rtl:text-end"
          />
        </Field>
        {emailTaken ? (
          <Link
            href={loginHref}
            className="mt-1 inline-block text-[13px] font-medium text-bronze-700 underline underline-offset-4 hover:text-bronze-800"
          >
            {t.errors.emailTakenAction}
          </Link>
        ) : null}
      </div>
      <div>
        <Label htmlFor="signup-password">{t.fields.password}</Label>
        <PasswordInput
          ref={passwordRef}
          id="signup-password"
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
          <p id="signup-password-error" role="alert" className="mt-1.5 text-[13px] text-rosewood">
            {errors.password}
          </p>
        ) : (
          <p
            id="signup-password-hint"
            className={cn(
              "mt-1.5 flex items-center gap-1.5 text-[13px] transition-colors duration-300",
              longEnough ? "text-sage" : "text-ink-faint",
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full border transition-colors duration-300",
                longEnough ? "border-sage bg-sage text-white" : "border-line-strong",
              )}
              aria-hidden="true"
            >
              {longEnough ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            {t.signup.passwordHint}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="mt-2 w-full" loading={submitting}>
        {t.signup.submit}
      </Button>
      <p className="text-center text-[12.5px] leading-relaxed text-ink-faint">
        {interpolate(t.signup.agree, {
          terms: (
            <Link href={localePath(locale, "/terms")} target="_blank" className={legalLink}>
              {t.signup.terms}
            </Link>
          ),
          privacy: (
            <Link href={localePath(locale, "/privacy")} target="_blank" className={legalLink}>
              {t.signup.privacy}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
