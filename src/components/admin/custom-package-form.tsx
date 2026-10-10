"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowRight, Infinity as InfinityIcon, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DateInput } from "@/components/ui/date-input";
import { Switch } from "@/components/ui/toggle";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { customHostSchema, customPackageTermsSchema, INCLUDED_EXAMPLE } from "@/lib/validation/custom-package";
import { cn } from "@/lib/utils";

export type CustomPackageValues = {
  host: { email: string; name: string; phone: string; locale: "en" | "ar" };
  package: { unlimited: boolean; guestLimit: string; price: string; included: string; dueDate: string; note: string };
};

type Customer = { name: string; phone: string | null; locale: string; active: boolean; events: number };

function issuesToFields(prefix: string, issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[[prefix, ...i.path.map(String)].join(".")] ??= i.message;
  return out;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Step 3 of a custom event: who the host is and what they pay. Saving creates the payment link
 * (or updates the unpaid one) and moves the event into the host's account; the link is sent
 * from the next step.
 */
export function CustomPackageForm({
  eventId,
  initial,
  initialCustomer = null,
  existing,
  eventDate,
  currency,
  planPrices,
}: {
  eventId: string;
  initial: CustomPackageValues;
  initialCustomer?: Customer | null;
  /** The event already has an unpaid payment link (saving updates it). */
  existing: boolean;
  /** yyyy-mm-dd in the event's time zone (the latest "pay by" date). */
  eventDate: string;
  currency: string;
  planPrices: { standard: number | null; premium: number | null };
}) {
  const router = useRouter();
  const [s, setS] = useState<CustomPackageValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [lookedUp, setLookedUp] = useState(initial.host.email.trim().toLowerCase());
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof CustomPackageValues>(section: K, patch: Partial<CustomPackageValues[K]>) => {
    setS((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
    const keys = Object.keys(patch).map((k) => `${section}.${k}`);
    setErrors((prev) => {
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  };
  const err = (key: string) => errors[key] ?? null;

  async function lookup(email: string) {
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || e === lookedUp) return;
    setLookedUp(e);
    try {
      const res = await api<{ customer: Customer | null }>(`/api/admin/custom/lookup?email=${encodeURIComponent(e)}`);
      setCustomer(res.customer);
      if (res.customer) {
        const c = res.customer;
        const locale = c.locale === "ar" ? "ar" : "en";
        setS((prev) => ({
          ...prev,
          host: { ...prev.host, name: prev.host.name || c.name, phone: prev.host.phone || c.phone || "", locale },
          package: {
            ...prev.package,
            included: prev.package.included === INCLUDED_EXAMPLE[locale === "ar" ? "en" : "ar"] ? INCLUDED_EXAMPLE[locale] : prev.package.included,
          },
        }));
      }
    } catch {
      setCustomer(null);
    }
  }

  function payload() {
    const t = (v: string) => v.trim();
    return {
      host: { ...s.host, email: t(s.host.email), name: t(s.host.name) },
      package: {
        unlimited: s.package.unlimited,
        guestLimit: s.package.unlimited ? null : Number(s.package.guestLimit) || null,
        price: Number(s.package.price) || 0,
        included: t(s.package.included),
        dueDate: s.package.dueDate || null,
        note: t(s.package.note),
      },
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = payload();
    let fields: Record<string, string> = {};
    const h = customHostSchema.safeParse(p.host);
    if (!h.success) fields = { ...fields, ...issuesToFields("host", h.error.issues) };
    if (customer && !customer.active) fields["host.email"] = "That customer's account is deactivated.";
    const k = customPackageTermsSchema.safeParse(p.package);
    if (!k.success) fields = { ...fields, ...issuesToFields("package", k.error.issues) };
    if (!fields["package.dueDate"] && p.package.dueDate && p.package.dueDate < today()) fields["package.dueDate"] = "The due date is in the past";
    setErrors(fields);
    if (Object.keys(fields).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api(`/api/admin/custom/events/${eventId}/package`, { body: p });
      router.push(`/admin/custom/${eventId}/send`);
      router.refresh();
      return; // stay busy while the Send step opens
    } catch (error) {
      if (error instanceof ApiError && error.fields && Object.keys(error.fields).length) setErrors(error.fields);
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  const price = Number(s.package.price) || 0;
  const priceLabel = (minor: number | null) => (minor === null ? "—" : formatMoney(minor, currency, "en"));
  const decimals = ["KWD", "BHD", "OMR"].includes(currency) ? 3 : 2;
  const total = formatMoney(Math.round(price * 10 ** decimals), currency, "en");

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-6">
      <Card className="px-5 py-7 sm:px-8 sm:py-8">
        <h2 className="font-display text-[26px] leading-tight text-ink">The host</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          They receive the payment link and manage the event from their own account. Existing customers get the event added to their account; new
          ones get an account and a link to choose a password.
        </p>
        <div className="mt-6 space-y-5">
          <Field id="host-email" label="Email" error={err("host.email")} hint="We'll check whether they already have an INVTRA account.">
            <Input
              id="host-email"
              type="email"
              autoComplete="off"
              dir="ltr"
              value={s.host.email}
              onChange={(e) => {
                set("host", { email: e.target.value });
                if (customer && e.target.value.trim().toLowerCase() !== lookedUp) setCustomer(null);
              }}
              onBlur={(e) => lookup(e.target.value)}
              placeholder="host@example.com"
              aria-invalid={Boolean(err("host.email"))}
            />
          </Field>
          {customer ? (
            <p
              className={cn(
                "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13.5px]",
                customer.active ? "border-sage/25 bg-sage-soft text-ink-soft" : "border-rosewood/20 bg-rosewood-soft text-rosewood",
              )}
            >
              <UserCheck className="mt-0.5 size-4 shrink-0" />
              {customer.active
                ? `Existing customer — ${customer.name}, ${customer.events === 1 ? "1 event" : `${customer.events} events`}. The event is added to their account.`
                : "This customer's account is deactivated. Reactivate it in Customers first."}
            </p>
          ) : lookedUp && lookedUp === s.host.email.trim().toLowerCase() ? (
            <p className="text-[13px] text-ink-faint">New customer — an account is created and they&apos;ll get a link to choose a password.</p>
          ) : null}
          <Field id="host-name" label="Name" error={err("host.name")}>
            <Input
              id="host-name"
              value={s.host.name}
              onChange={(e) => set("host", { name: e.target.value })}
              placeholder="e.g. Sara Al-Qahtani"
              aria-invalid={Boolean(err("host.name"))}
            />
          </Field>
          <Field id="host-phone" label="WhatsApp number" optional="(needed to send on WhatsApp)" error={err("host.phone")}>
            <PhoneInput id="host-phone" value={s.host.phone} onChange={(v) => set("host", { phone: v })} defaultCountry="SA" invalid={Boolean(err("host.phone"))} />
          </Field>
          <fieldset>
            <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">Messages and payment page in</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:max-w-sm" role="radiogroup">
              {(
                [
                  ["en", "English"],
                  ["ar", "العربية"],
                ] as const
              ).map(([v, label]) => (
                <Choice
                  key={v}
                  active={s.host.locale === v}
                  onClick={() => {
                    set("host", { locale: v });
                    // Untouched starting text follows the host's language.
                    if (s.package.included === INCLUDED_EXAMPLE[v === "ar" ? "en" : "ar"]) set("package", { included: INCLUDED_EXAMPLE[v] });
                  }}
                >
                  {label}
                </Choice>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card className="px-5 py-7 sm:px-8 sm:py-8">
        <h2 className="font-display text-[26px] leading-tight text-ink">The package</h2>
        <p className="mt-1.5 text-sm text-ink-faint">Your own price and guest allowance. The host sees what&apos;s included before paying.</p>
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-line bg-sand/40 p-4 sm:p-5">
            <Switch
              id="pkg-unlimited"
              checked={s.package.unlimited}
              onChange={(v) => set("package", { unlimited: v })}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <InfinityIcon className="size-4 text-bronze-600" />
                  Unlimited guests
                </span>
              }
              description="No cap on the guest list, imports or invitations sent."
            />
            {!s.package.unlimited ? (
              <Field id="pkg-guests" label="Guests included" error={err("package.guestLimit")} className="mt-4 sm:max-w-xs">
                <Input
                  id="pkg-guests"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={s.package.guestLimit}
                  onChange={(e) => set("package", { guestLimit: e.target.value })}
                  placeholder="e.g. 1500"
                  aria-invalid={Boolean(err("package.guestLimit"))}
                />
              </Field>
            ) : null}
          </div>
          <Field
            id="pkg-price"
            label={`Price (${currency})`}
            error={err("package.price")}
            hint={`For reference: Standard ${priceLabel(planPrices.standard)} · Premium ${priceLabel(planPrices.premium)}. VAT included where applicable.`}
            className="sm:max-w-sm"
          >
            <div className="relative">
              <Input
                id="pkg-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={s.package.price}
                onChange={(e) => set("package", { price: e.target.value })}
                placeholder="e.g. 2500"
                className="pe-16"
                aria-invalid={Boolean(err("package.price"))}
              />
              <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-[13px] text-ink-faint">{currency}</span>
            </div>
          </Field>
          <Field id="pkg-included" label="What's included" optional="(shown on the payment page and receipt)" error={err("package.included")}>
            <Textarea id="pkg-included" rows={5} maxLength={800} value={s.package.included} onChange={(e) => set("package", { included: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="pkg-due"
              label="Pay by"
              optional="(optional)"
              error={err("package.dueDate")}
              hint="Shown to the host as a reminder; the link keeps working after it."
            >
              <DateInput
                id="pkg-due"
                min={today()}
                max={eventDate || undefined}
                value={s.package.dueDate}
                onChange={(v) => set("package", { dueDate: v })}
                invalid={Boolean(err("package.dueDate"))}
                describedBy={err("package.dueDate") ? "pkg-due-error" : "pkg-due-hint"}
              />
            </Field>
            <Field id="pkg-note" label="Internal note" optional="(staff only)" error={err("package.note")}>
              <Input
                id="pkg-note"
                maxLength={500}
                value={s.package.note}
                onChange={(e) => set("package", { note: e.target.value })}
                placeholder="e.g. Agreed by phone with Sara on 3 Oct"
              />
            </Field>
          </div>
        </div>
      </Card>

      {formError ? (
        <p role="alert" className="rounded-xl border border-rosewood/20 bg-rosewood-soft px-4 py-3 text-[13.5px] text-rosewood">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-paper px-5 py-4 shadow-soft">
        <p className="text-[13.5px] text-ink-soft">
          <span className="font-display text-2xl text-ink">{total}</span>
          <span className="ms-2">{s.package.unlimited ? "Unlimited guests" : `Up to ${Number(s.package.guestLimit || 0).toLocaleString("en")} guests`}</span>
        </p>
        <Button type="submit" variant="accent" loading={busy}>
          {existing ? "Save & continue" : "Create payment link"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
      <p className="text-center text-[12.5px] text-ink-faint">Nothing is sent yet — you send the link in the next step.</p>
    </form>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-start text-sm transition-all duration-300 ease-luxe",
        active ? "border-bronze-400 bg-bronze-50 text-ink shadow-soft" : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
