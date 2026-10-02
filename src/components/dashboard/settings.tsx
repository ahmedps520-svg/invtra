"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n/config";
import { errorMessage } from "./i18n";

export function SettingsPage({ user }: { user: { name: string; email: string; phone: string | null; locale: Locale } }) {
  const { dict } = useI18n();
  const d = dict.dashboard.settings;
  return (
    <div className="animate-fade-up mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-4xl text-ink sm:text-5xl">{d.title}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{d.intro}</p>
      </div>
      <ProfileForm user={user} />
      <PasswordForm />
      <DeleteAccount />
    </div>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <Card className={danger ? "border-rosewood/20" : undefined}>
      <div className="grid gap-6 px-6 py-7 sm:px-8 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-10">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        <div className="min-w-0">{children}</div>
      </div>
    </Card>
  );
}

function ProfileForm({ user }: { user: { name: string; email: string; phone: string | null; locale: Locale } }) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.settings.profile;
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [lang, setLang] = useState<Locale>(user.locale);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setErrors({ name: d.nameError });
    setBusy(true);
    setErrors({});
    try {
      await api("/api/account", { method: "PATCH", body: { name: name.trim(), phone: phone.trim() || null, locale: lang } });
      if (lang !== locale) {
        await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: lang }) });
      }
      toast(d.saved);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "invalid_phone" || err.fields?.phone)) setErrors({ phone: d.phoneError });
      else if (err instanceof ApiError && err.fields?.name) setErrors({ name: d.nameError });
      else toast(errorMessage(err, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={d.title}>
      <form onSubmit={save} className="space-y-5" noValidate>
        <Field id="s-name" label={d.name} error={errors.name}>
          <Input id="s-name" value={name} autoComplete="name" dir="auto" aria-invalid={Boolean(errors.name)} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="s-email" label={d.email} hint={d.emailHint}>
          <Input id="s-email" value={user.email} disabled dir="ltr" className="rtl:text-end" />
        </Field>
        <Field id="s-phone" label={d.phone} hint={d.phoneHint} error={errors.phone}>
          <Input
            id="s-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            className="rtl:text-end"
            autoComplete="tel"
            value={phone}
            placeholder="+971 50 123 4567"
            aria-invalid={Boolean(errors.phone)}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-soft">{d.language}</p>
          <Segmented<Locale>
            value={lang}
            onChange={setLang}
            options={[
              { value: "en", label: <span lang="en">English</span> },
              { value: "ar", label: <span lang="ar">العربية</span> },
            ]}
          />
        </div>
        <Button type="submit" loading={busy}>
          {d.save}
        </Button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const { dict } = useI18n();
  const d = dict.dashboard.settings.password;
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!current) errs.current = dict.common.errors.required;
    if (next.length < 10) errs.next = d.tooShort;
    if (confirm !== next) errs.confirm = d.mismatch;
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    setErrors({});
    try {
      await api("/api/account/password", { method: "POST", body: { current, next } });
      toast(d.saved);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "wrong_password") setErrors({ current: d.wrong });
      else if (err instanceof ApiError && err.fields?.next) setErrors({ next: d.tooShort });
      else toast(errorMessage(err, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={d.title}>
      <form onSubmit={save} className="space-y-5" noValidate>
        <Field id="p-current" label={d.current} error={errors.current}>
          <Input id="p-current" type="password" autoComplete="current-password" value={current} aria-invalid={Boolean(errors.current)} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="p-next" label={d.next} hint={d.nextHint} error={errors.next}>
            <Input id="p-next" type="password" autoComplete="new-password" value={next} aria-invalid={Boolean(errors.next)} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field id="p-confirm" label={d.confirm} error={errors.confirm}>
            <Input id="p-confirm" type="password" autoComplete="new-password" value={confirm} aria-invalid={Boolean(errors.confirm)} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="outline" loading={busy}>
          {d.save}
        </Button>
      </form>
    </Section>
  );
}

function DeleteAccount() {
  const { dict } = useI18n();
  const d = dict.dashboard.settings.danger;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api("/api/account", { method: "DELETE", body: { confirm: "DELETE" } });
      window.location.replace("/");
    } catch (err) {
      toast(errorMessage(err, dict), "error");
      setBusy(false);
    }
  }

  return (
    <Section title={d.title} danger>
      <p className="text-sm leading-relaxed text-ink-soft">{d.body}</p>
      <Button variant="outline" className="mt-5 border-rosewood/30 text-rosewood hover:border-rosewood hover:bg-rosewood-soft" onClick={() => setOpen(true)}>
        {d.button}
      </Button>
      <Dialog
        open={open}
        onClose={() => !busy && (setOpen(false), setTyped(""))}
        title={d.confirmTitle}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="danger" disabled={typed !== "DELETE"} loading={busy} onClick={remove}>
              {d.confirm}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{d.body}</p>
        <Field id="del-confirm" label={d.confirmLabel} className="mt-5">
          <Input id="del-confirm" value={typed} dir="ltr" autoComplete="off" autoCapitalize="characters" onChange={(e) => setTyped(e.target.value)} />
        </Field>
      </Dialog>
    </Section>
  );
}
