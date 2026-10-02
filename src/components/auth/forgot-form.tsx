"use client";

import { useRef, useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { FieldInput, FormAlert } from "./form-parts";
import { EMAIL_RE } from "./next-path";

/** First-strong isolate, so an email address keeps its order inside Arabic text. */
const isolate = (s: string) => String.fromCodePoint(0x2068) + s + String.fromCodePoint(0x2069);

export function ForgotForm() {
  const { dict } = useI18n();
  const t = dict.auth;
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setFormError(null);
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError(t.errors.emailInvalid);
      return emailRef.current?.focus();
    }
    setError(null);
    setSubmitting(true);
    try {
      await api("/api/auth/forgot", { body: { email: value } });
      setSentTo(value);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(t.errors.emailInvalid);
        emailRef.current?.focus();
      } else if (err instanceof ApiError && err.status === 429) setFormError(t.errors.rateLimited);
      else if (err instanceof ApiError && err.status === 0) setFormError(t.errors.network);
      else setFormError(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-paper p-6 sm:p-7">
        <span className="flex size-11 items-center justify-center rounded-full border border-sage/25 bg-sage-soft text-sage">
          <MailCheck className="size-5" strokeWidth={1.5} />
        </span>
        <h2 className="mt-5 font-display text-2xl text-ink">{t.forgot.sentTitle}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{fmt(t.forgot.sentBody, { email: isolate(sentTo) })}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">{t.forgot.sentHint}</p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setSentTo(null);
              setEmail("");
              requestAnimationFrame(() => emailRef.current?.focus());
            }}
          >
            {t.forgot.tryAgain}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Field id="forgot-email" label={t.fields.email} error={error}>
        <FieldInput
          ref={emailRef}
          id="forgot-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={160}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={Boolean(error)}
          dir="ltr"
          className="rtl:text-end"
        />
      </Field>
      <Button type="submit" size="lg" className="mt-2 w-full" loading={submitting}>
        {t.forgot.submit}
      </Button>
    </form>
  );
}
