"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent, type KeyboardEvent } from "react";
import { CheckCircle2, LogOut, MailCheck, RotateCw } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";
import { VERIFY_REMINDER_KEY, todayKey, type Verification } from "@/lib/auth/verification";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { plural } from "@/components/dashboard/i18n";
import { cn } from "@/lib/utils";
import { AuthHeading } from "./auth-heading";
import { FormAlert } from "./form-parts";

type CodeStatus = { email: string; expiresAt: string | null; resendAt: string };
type Unverified = Extract<Verification, { verified: false }>;

/** First-strong isolate, so an email address keeps its order inside Arabic text. */
const isolate = (s: string) => String.fromCodePoint(0x2068) + s + String.fromCodePoint(0x2069);
const noop = () => () => {};

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function VerifyEmailForm({ next, verification, code }: { next: string; verification: Unverified; code: CodeStatus }) {
  const { dict, locale } = useI18n();
  const t = dict.auth.verify;
  const router = useRouter();
  const timeZone = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => "Asia/Riyadh");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [expiresAt, setExpiresAt] = useState<number | null>(code.expiresAt ? Date.parse(code.expiresAt) : null);
  const [resendAt, setResendAt] = useState(Date.parse(code.resendAt));
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [later, setLater] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSent = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const failure = useCallback(
    (e: unknown) => {
      if (!(e instanceof ApiError)) return t.emailFailed;
      const wait = Number(e.fields?.retryAfter ?? 0) * 1000;
      if (e.code === "resend_cooldown" || e.code === "code_limit") {
        setResendAt(Date.now() + wait);
        return e.code === "code_limit" ? fmt(t.limit, { time: clock(wait) }) : null;
      }
      if (e.code === "invalid_code") return fmt(t.invalid, { n: e.fields?.attemptsLeft ?? "0" });
      if (e.code === "code_expired") {
        setExpiresAt(null);
        return t.expired;
      }
      if (e.code === "too_many_attempts") {
        setExpiresAt(null);
        return t.tooManyAttempts;
      }
      if (e.status === 429) return dict.auth.errors.rateLimited;
      if (e.status === 0) return dict.auth.errors.network;
      return t.emailFailed;
    },
    [t, dict],
  );

  const send = useCallback(
    async (manual: boolean) => {
      setSending(true);
      setError(null);
      setNotice(null);
      try {
        const r = await api<{ code: CodeStatus }>("/api/auth/verify-email/send", { method: "POST" });
        setExpiresAt(r.code.expiresAt ? Date.parse(r.code.expiresAt) : null);
        setResendAt(Date.parse(r.code.resendAt));
        setDigits(["", "", "", ""]);
        if (manual) setNotice(t.resent);
        requestAnimationFrame(() => inputs.current[0]?.focus());
      } catch (e) {
        if (e instanceof ApiError && e.code === "already_verified") return router.replace(next);
        setError(failure(e));
      } finally {
        setSending(false);
      }
    },
    [failure, next, router, t.resent],
  );

  // Arriving without a code that still works (a new account, or "Verify now"): send one.
  useEffect(() => {
    if (autoSent.current || expiresAt || Date.now() < resendAt) return;
    autoSent.current = true;
    void send(false);
  }, [expiresAt, resendAt, send]);

  async function check(value: string) {
    if (checking || done) return;
    setChecking(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/auth/verify-email", { body: { code: value } });
      setDone(true);
      try {
        localStorage.removeItem(VERIFY_REMINDER_KEY);
      } catch {
        /* private mode */
      }
      setTimeout(() => {
        router.replace(next);
        router.refresh();
      }, 1100);
    } catch (e) {
      setError(failure(e));
      setDigits(["", "", "", ""]);
      requestAnimationFrame(() => inputs.current[0]?.focus());
    } finally {
      setChecking(false);
    }
  }

  function fill(from: number, text: string) {
    const clean = text.replace(/\D/g, "").slice(0, 4 - from);
    if (!clean) return;
    const nextDigits = [...digits];
    for (let i = 0; i < clean.length; i++) nextDigits[from + i] = clean[i];
    setDigits(nextDigits);
    const pos = Math.min(3, from + clean.length);
    inputs.current[pos]?.focus();
    if (nextDigits.every((d) => d)) void check(nextDigits.join(""));
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const d = [...digits];
      d[i - 1] = "";
      setDigits(d);
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 3) inputs.current[i + 1]?.focus();
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  }

  function remindLater() {
    try {
      localStorage.setItem(VERIFY_REMINDER_KEY, todayKey());
    } catch {
      /* private mode */
    }
    router.push(next);
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const days = plural(locale, t.days, verification.daysLeft);
  const date = formatDate(new Date(verification.deadline), { locale, timeZone, style: "full" });
  const email = isolate(code.email);
  const canResend = now >= resendAt && !sending;
  const left = expiresAt ? expiresAt - now : 0;

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-paper p-7 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-sage">
          <CheckCircle2 className="size-7" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 font-display text-3xl text-ink">{t.doneTitle}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{t.doneBody}</p>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title={verification.locked ? t.lockedTitle : t.title}
        subtitle={verification.locked ? fmt(t.lockedBody, { email }) : fmt(sending && !expiresAt ? t.sending : t.subtitle, { email })}
      />
      <form
        className="mt-9 space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (digits.every((d) => d)) void check(digits.join(""));
        }}
      >
        {error ? <FormAlert>{error}</FormAlert> : notice ? <FormAlert tone="success">{notice}</FormAlert> : null}
        <fieldset>
          <legend className="sr-only">{t.codeLabel}</legend>
          {/* Digits always read left to right, also in Arabic. */}
          <div dir="ltr" className="flex justify-center gap-3 sm:gap-4">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                onChange={(e) => (e.target.value ? fill(i, e.target.value) : setDigits((ds) => ds.map((x, k) => (k === i ? "" : x))))}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={(e) => onPaste(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                autoFocus={i === 0}
                maxLength={i === 0 ? 4 : 1}
                aria-label={fmt(t.digit, { n: i + 1 })}
                disabled={checking}
                data-testid={`code-${i}`}
                className={cn(
                  "size-16 rounded-2xl border bg-paper text-center font-display text-[2rem] text-ink shadow-soft outline-none transition sm:size-[4.5rem]",
                  "focus:border-bronze-500 focus:ring-4 focus:ring-bronze-200/50 disabled:opacity-60",
                  error ? "border-rosewood/50" : d ? "border-bronze-400" : "border-line-strong",
                )}
              />
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" className="w-full" loading={checking} disabled={!digits.every((d) => d)}>
          {t.submit}
        </Button>
        <div className="flex flex-col items-center gap-1.5 text-[13.5px]">
          {expiresAt && left > 0 ? <p className="text-ink-faint tabular-nums">{fmt(t.expiresIn, { time: clock(left) })}</p> : null}
          <button
            type="button"
            onClick={() => send(true)}
            disabled={!canResend}
            className="inline-flex items-center gap-1.5 font-medium text-bronze-700 transition-colors hover:text-bronze-900 disabled:cursor-not-allowed disabled:text-ink-faint"
            data-testid="resend"
          >
            <RotateCw className={cn("size-3.5", sending && "animate-spin")} />
            <span className="tabular-nums">{canResend || sending ? t.resend : fmt(t.resendIn, { time: clock(resendAt - now) })}</span>
          </button>
        </div>
      </form>

      <div className="mt-8 rounded-2xl border border-line bg-paper/70 px-5 py-4">
        <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-bronze-600" strokeWidth={1.75} />
          {t.spam}
        </p>
        {!verification.locked ? <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{fmt(t.deadline, { days, date })}</p> : null}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 border-t border-line pt-6 text-[14px]">
        {!verification.locked ? (
          <Button variant="outline" className="w-full" onClick={() => setLater(true)} data-testid="verify-later">
            {t.later}
          </Button>
        ) : null}
        <p className="text-center text-[12.5px] text-ink-faint">{t.help}</p>
        <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint transition-colors hover:text-ink">
          <LogOut className="size-3.5 rtl:rotate-180" />
          {t.signOut}
        </button>
      </div>

      <Dialog
        open={later}
        onClose={() => setLater(false)}
        title={t.laterTitle}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={remindLater} data-testid="later-confirm">
              {t.laterConfirm}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setLater(false);
                requestAnimationFrame(() => inputs.current[0]?.focus());
              }}
            >
              {t.laterCancel}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{fmt(t.laterBody, { days, date })}</p>
      </Dialog>
    </>
  );
}
