"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { errorMessage } from "../i18n";
import type { GuestRow } from "./types";

type Values = { name: string; phone: string; groupName: string; allowedCount: string; locale: "" | "en" | "ar" };

const empty: Values = { name: "", phone: "", groupName: "", allowedCount: "1", locale: "" };

function valuesOf(g: GuestRow | null): Values {
  if (!g) return empty;
  return {
    name: g.name,
    phone: g.phone,
    groupName: g.groupName ?? "",
    allowedCount: String(g.allowedCount),
    locale: g.locale === "en" || g.locale === "ar" ? g.locale : "",
  };
}

/** Add or edit a single guest. */
export function GuestFormDialog({
  open,
  onClose,
  eventId,
  eventLanguage,
  guest,
  onSaved,
  defaultCountry,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventLanguage: "EN" | "AR" | "BILINGUAL";
  guest: GuestRow | null;
  onSaved: () => void;
  /** The event's country — numbers typed without a code are local to it. */
  defaultCountry: string;
}) {
  const { dict } = useI18n();
  const d = dict.dashboard.guestForm;
  const toast = useToast();
  const [values, setValues] = useState<Values>(() => valuesOf(guest));
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [busy, setBusy] = useState<false | "save" | "another">(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(guest);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function save(another: boolean) {
    const next: Partial<Record<keyof Values, string>> = {};
    if (!values.name.trim()) next.name = d.nameRequired;
    if (values.phone.replace(/\D/g, "").length < 5) next.phone = values.phone.trim() ? d.invalidPhone : d.phoneRequired;
    const count = Number(values.allowedCount);
    if (!Number.isInteger(count) || count < 1 || count > 50) next.allowedCount = d.allowedRange;
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(another ? "another" : "save");
    const body = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      groupName: values.groupName.trim() || null,
      allowedCount: count,
      locale: values.locale || null,
    };
    try {
      if (guest) await api(`/api/events/${eventId}/guests/${guest.id}`, { method: "PATCH", body });
      else await api(`/api/events/${eventId}/guests`, { method: "POST", body });
      toast(guest ? d.saved : fmt(d.added, { name: body.name }));
      onSaved();
      if (another) {
        setValues((v) => ({ ...empty, groupName: v.groupName, locale: v.locale }));
        setErrors({});
        setTimeout(() => nameRef.current?.focus(), 30);
      } else onClose();
    } catch (e) {
      if (e instanceof ApiError && (e.code === "duplicate_phone" || e.code === "duplicate")) setErrors({ phone: d.duplicate });
      else if (e instanceof ApiError && (e.code === "invalid_phone" || e.fields?.phone)) setErrors({ phone: d.invalidPhone });
      else if (e instanceof ApiError && e.fields) {
        setErrors({
          name: e.fields.name ? d.nameRequired : undefined,
          allowedCount: e.fields.allowedCount ? d.allowedRange : undefined,
        });
      } else toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  const langName = dict.common.eventLanguages[eventLanguage];

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={editing ? d.editTitle : d.addTitle}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={Boolean(busy)}>
            {dict.common.actions.cancel}
          </Button>
          {!editing ? (
            <Button variant="outline" loading={busy === "another"} disabled={Boolean(busy)} onClick={() => save(true)}>
              {d.addAnother}
            </Button>
          ) : null}
          <Button variant="primary" loading={busy === "save"} disabled={Boolean(busy)} onClick={() => save(false)}>
            {editing ? d.save : d.add}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        noValidate
      >
        <Field id="g-name" label={d.name} error={errors.name}>
          <Input
            ref={nameRef}
            id="g-name"
            value={values.name}
            dir="auto"
            autoComplete="off"
            placeholder={d.namePh}
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field id="g-phone" label={d.phone} hint={d.phoneHint} error={errors.phone}>
          <PhoneInput
            id="g-phone"
            value={values.phone}
            defaultCountry={defaultCountry}
            placeholder="50 123 4567"
            invalid={Boolean(errors.phone)}
            describedBy={errors.phone ? "g-phone-error" : "g-phone-hint"}
            onChange={(v) => set("phone", v)}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
          <Field id="g-group" label={d.group} optional={dict.dashboard.form.optional}>
            <Input id="g-group" value={values.groupName} dir="auto" placeholder={d.groupPh} onChange={(e) => set("groupName", e.target.value)} />
          </Field>
          <Field id="g-count" label={d.allowed} error={errors.allowedCount}>
            <Input
              id="g-count"
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              dir="ltr"
              value={values.allowedCount}
              aria-invalid={Boolean(errors.allowedCount)}
              onChange={(e) => set("allowedCount", e.target.value)}
            />
          </Field>
        </div>
        <p className="-mt-3 text-[13px] text-ink-faint">{d.allowedHint}</p>
        <Field id="g-locale" label={d.language} hint={d.languageHint}>
          <Select id="g-locale" value={values.locale} onChange={(e) => set("locale", e.target.value as Values["locale"])}>
            <option value="">{fmt(d.languageDefault, { lang: langName })}</option>
            <option value="en">{d.en}</option>
            <option value="ar">{d.ar}</option>
          </Select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
