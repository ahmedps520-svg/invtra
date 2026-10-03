"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Briefcase,
  Cake,
  Flower2,
  Gem,
  Gift,
  GraduationCap,
  Heart,
  HeartHandshake,
  Infinity as InfinityIcon,
  MoonStar,
  Palette,
  PartyPopper,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DateInput } from "@/components/ui/date-input";
import { Switch } from "@/components/ui/toggle";
import { api, ApiError } from "@/lib/api-client";
import { common } from "@/lib/i18n/dictionaries/en/common";
import { EVENT_TYPES } from "@/lib/events/types";
import { formatMoney } from "@/lib/format";
import { COMMON_TIME_ZONES, zoneOffsetMs } from "@/lib/time";
import { customPackageSchema } from "@/lib/validation/custom-package";
import { cn } from "@/lib/utils";
import { CUSTOM_STEPS, CustomSteps } from "./custom-steps";

type EventType = (typeof EVENT_TYPES)[number];
type Lang = "EN" | "AR" | "BILINGUAL";

const ICONS: Record<EventType, ReactNode> = {
  WEDDING: <Heart />,
  ENGAGEMENT: <Gem />,
  HENNA: <Flower2 />,
  NEWBORN: <Baby />,
  BABY_SHOWER: <Gift />,
  AQIQAH: <Sparkles />,
  BIRTHDAY: <Cake />,
  GRADUATION: <GraduationCap />,
  ANNIVERSARY: <HeartHandshake />,
  RAMADAN: <MoonStar />,
  CORPORATE: <Briefcase />,
  OTHER: <PartyPopper />,
};

const TZ_OPTIONS = COMMON_TIME_ZONES.map((tz) => {
  if (tz === "UTC") return { value: tz, label: "UTC" };
  const city = tz.split("/").pop()!.replace(/_/g, " ");
  const mins = Math.round(zoneOffsetMs(new Date(), tz) / 60000);
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return {
    value: tz,
    label: `${city} (GMT${mins >= 0 ? "+" : "−"}${h}${m ? `:${String(m).padStart(2, "0")}` : ""})`,
  };
});

/** The wizard covers the first five steps; Design and Send link follow once the event exists. */
const WIZARD_STEPS = 5;

type State = {
  host: { email: string; name: string; phone: string; locale: "en" | "ar" };
  event: {
    type: EventType;
    language: Lang;
    title: string;
    titleAr: string;
    hostNames: string;
    hostNamesAr: string;
    date: string;
    time: string;
    timezone: string;
    venueName: string;
    venueNameAr: string;
    address: string;
  };
  package: {
    unlimited: boolean;
    guestLimit: string;
    price: string;
    included: string;
    dueDate: string;
    note: string;
  };
};

type Customer = {
  name: string;
  phone: string | null;
  locale: string;
  active: boolean;
  events: number;
};
type Created = { orderId: string };

/** Starting text for "What's included", in the host's language (the guest allowance is shown separately). */
const INCLUDED_EXAMPLE = {
  en: "Any design, including premium designs\nWhatsApp invitations with a personal QR code for every guest\nRSVP tracking and check-in at the door",
  ar: "جميع التصاميم بما فيها التصاميم المميزة\nدعوات واتساب مع رمز QR خاص لكل ضيف\nمتابعة تأكيد الحضور وتسجيل الدخول عند الباب",
};

/** Payload for the API. Arabic-only events mirror the Arabic text into the primary fields. */
function toPayload(s: State) {
  const ar = s.event.language === "AR";
  const t = (v: string) => v.trim();
  const opt = (v: string) => t(v) || null;
  const mirror = (primary: string, arabic: string) =>
    ar ? t(arabic) || t(primary) : t(primary);
  const e = s.event;
  return {
    host: { ...s.host, email: t(s.host.email), name: t(s.host.name) },
    event: {
      type: e.type,
      language: e.language,
      title: mirror(e.title, e.titleAr),
      titleAr: e.language === "EN" ? null : opt(e.titleAr),
      hostNames: mirror(e.hostNames, e.hostNamesAr),
      hostNamesAr: e.language === "EN" ? null : opt(e.hostNamesAr),
      date: e.date,
      time: e.time,
      timezone: e.timezone,
      venueName: mirror(e.venueName, e.venueNameAr),
      venueNameAr: e.language === "EN" ? null : opt(e.venueNameAr),
      address: opt(e.address),
    },
    package: {
      unlimited: s.package.unlimited,
      guestLimit: s.package.unlimited
        ? null
        : Number(s.package.guestLimit) || null,
      price: Number(s.package.price) || 0,
      included: t(s.package.included),
      dueDate: s.package.dueDate || null,
      note: t(s.package.note),
    },
    // Nothing goes out yet: the invitation is designed first, then the link is sent.
    send: { whatsapp: false, email: false },
  };
}

/** zod issues → { "event.title": "…" } */
function issuesToFields(
  prefix: string,
  issues: { path: PropertyKey[]; message: string }[],
) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = [prefix, ...i.path.map(String)].join(".");
    out[key] ??= i.message;
  }
  return out;
}

const STEP_OF_FIELD = (key: string) =>
  key.startsWith("host.")
    ? 0
    : key === "event.type" || key === "event.language"
      ? 1
      : key.startsWith("event.")
        ? 2
        : key.startsWith("package.")
          ? 3
          : 4;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CustomEventWizard({
  initialEmail = "",
  initialCustomer = null,
  currency,
  planPrices,
}: {
  /** Prefilled from a customer's page (/admin/custom/new?email=…). */
  initialEmail?: string;
  initialCustomer?: Customer | null;
  currency: string;
  planPrices: { standard: number | null; premium: number | null };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [s, setS] = useState<State>({
    host: {
      email: initialEmail,
      name: initialCustomer?.name ?? "",
      phone: initialCustomer?.phone ?? "",
      locale: initialCustomer?.locale === "ar" ? "ar" : "en",
    },
    event: {
      type: "WEDDING",
      language: "BILINGUAL",
      title: "",
      titleAr: "",
      hostNames: "",
      hostNamesAr: "",
      date: "",
      time: "19:00",
      timezone: "Asia/Riyadh",
      venueName: "",
      venueNameAr: "",
      address: "",
    },
    package: {
      unlimited: true,
      guestLimit: "",
      price: "",
      included:
        INCLUDED_EXAMPLE[initialCustomer?.locale === "ar" ? "ar" : "en"],
      dueDate: "",
      note: "",
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [lookedUp, setLookedUp] = useState(initialEmail.trim().toLowerCase());
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = <K extends keyof State>(section: K, patch: Partial<State[K]>) => {
    setS((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
    const keys = Object.keys(patch).map((k) => `${section}.${k}`);
    setErrors((prev) => {
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      // Arabic-only events validate the Arabic field through its primary twin.
      for (const k of keys) if (k.endsWith("Ar")) delete next[k.slice(0, -2)];
      return next;
    });
  };

  const lang = s.event.language;
  const showEn = lang !== "AR";
  const showAr = lang !== "EN";
  /** Error for a field, also showing the primary field's error on its Arabic twin for Arabic-only events. */
  const err = (key: string) =>
    errors[key] ??
    (lang === "AR" && key.endsWith("Ar")
      ? errors[key.slice(0, -2)]
      : undefined) ??
    null;

  async function lookup(email: string) {
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || e === lookedUp) return;
    setLookedUp(e);
    try {
      const res = await api<{ customer: Customer | null }>(
        `/api/admin/custom/lookup?email=${encodeURIComponent(e)}`,
      );
      setCustomer(res.customer);
      if (res.customer) {
        const c = res.customer;
        const locale = c.locale === "ar" ? "ar" : "en";
        setS((prev) => ({
          ...prev,
          host: {
            ...prev.host,
            name: prev.host.name || c.name,
            phone: prev.host.phone || c.phone || "",
            locale,
          },
          package: {
            ...prev.package,
            included:
              prev.package.included ===
              INCLUDED_EXAMPLE[locale === "ar" ? "en" : "ar"]
                ? INCLUDED_EXAMPLE[locale]
                : prev.package.included,
          },
        }));
      }
    } catch {
      setCustomer(null);
    }
  }

  function validate(index: number): boolean {
    const p = toPayload(s);
    let fields: Record<string, string> = {};
    if (index === 0) {
      const r = customPackageSchema.shape.host.safeParse(p.host);
      if (!r.success) fields = issuesToFields("host", r.error.issues);
      if (customer && !customer.active)
        fields["host.email"] = "That customer's account is deactivated.";
    } else if (index === 2) {
      const r = customPackageSchema.shape.event.safeParse(p.event);
      if (!r.success) fields = issuesToFields("event", r.error.issues);
      if (!fields["event.date"] && p.event.date < today())
        fields["event.date"] = "The date is in the past";
    } else if (index === 3) {
      const r = customPackageSchema.shape.package.safeParse(p.package);
      if (!r.success) fields = issuesToFields("package", r.error.issues);
      if (
        !fields["package.dueDate"] &&
        p.package.dueDate &&
        p.package.dueDate < today()
      )
        fields["package.dueDate"] = "The due date is in the past";
    }
    setErrors(fields);
    if (Object.keys(fields).length) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(),
      );
      return false;
    }
    return true;
  }

  function go(index: number) {
    setStep(index);
    setFormError(null);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }

  function next() {
    if (validate(step)) go(step + 1);
  }

  async function submit() {
    for (const i of [0, 2, 3]) {
      if (!validate(i)) {
        go(i);
        return;
      }
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await api<Created>("/api/admin/custom", {
        body: toPayload(s),
      });
      router.push(`/admin/custom/${res.orderId}/design`);
      return; // stay busy while the design step opens
    } catch (e) {
      if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) {
        setErrors(e.fields);
        const first = Math.min(...Object.keys(e.fields).map(STEP_OF_FIELD));
        if (first < 4) go(first);
        setFormError(e.message);
      } else {
        setFormError(
          e instanceof ApiError
            ? e.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const price = Number(s.package.price) || 0;
  const priceLabel = (minor: number | null) =>
    minor === null ? "—" : formatMoney(minor, currency, "en");
  const decimals = ["KWD", "BHD", "OMR"].includes(currency) ? 3 : 2;
  const total = formatMoney(Math.round(price * 10 ** decimals), currency, "en");
  const guests = s.package.unlimited
    ? "Unlimited guests"
    : `Up to ${Number(s.package.guestLimit || 0).toLocaleString("en")} guests`;

  return (
    <div className="mx-auto max-w-3xl">
      <CustomSteps current={step} onSelect={(i) => go(i)} />

      <Card className="px-5 py-7 sm:px-8 sm:py-8">
        <p className="eyebrow mb-2">
          Step {step + 1} of {CUSTOM_STEPS.length}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-[28px] leading-tight text-ink outline-none sm:text-[32px]"
        >
          {
            [
              "Who is this event for?",
              "What's the occasion?",
              "When and where is it?",
              "What's in the package?",
              "Review the event and package",
            ][step]
          }
        </h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          {
            [
              "The host receives the payment link and manages the event from their own account. Existing customers get the event added to their account.",
              "This sets the wording and the designs the host can choose from.",
              "Shown on the payment page and the invitations. The host can change these later.",
              "Set your own price and guest allowance. The host sees what's included before paying.",
              "Check everything, then create the event. Next you design the invitation, then send the payment link.",
            ][step]
          }
        </p>

        <div className="mt-7">
          {step === 0 ? (
            <div className="space-y-5">
              <Field
                id="host-email"
                label="Email"
                error={err("host.email")}
                hint="We'll check whether they already have an INVTRA account."
              >
                <Input
                  id="host-email"
                  type="email"
                  autoComplete="off"
                  dir="ltr"
                  value={s.host.email}
                  onChange={(e) => {
                    set("host", { email: e.target.value });
                    if (
                      customer &&
                      e.target.value.trim().toLowerCase() !== lookedUp
                    )
                      setCustomer(null);
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
                    customer.active
                      ? "border-sage/25 bg-sage-soft text-ink-soft"
                      : "border-rosewood/20 bg-rosewood-soft text-rosewood",
                  )}
                >
                  <UserCheck className="mt-0.5 size-4 shrink-0" />
                  {customer.active
                    ? `Existing customer — ${customer.name}, ${customer.events === 1 ? "1 event" : `${customer.events} events`}. The new event is added to their account.`
                    : "This customer's account is deactivated. Reactivate it in Customers first."}
                </p>
              ) : lookedUp && lookedUp === s.host.email.trim().toLowerCase() ? (
                <p className="text-[13px] text-ink-faint">
                  New customer — an account is created and they&apos;ll get a
                  link to choose a password.
                </p>
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
              <Field
                id="host-phone"
                label="WhatsApp number"
                optional="(needed to send on WhatsApp)"
                error={err("host.phone")}
              >
                <PhoneInput
                  id="host-phone"
                  value={s.host.phone}
                  onChange={(v) => set("host", { phone: v })}
                  defaultCountry="SA"
                  invalid={Boolean(err("host.phone"))}
                />
              </Field>
              <fieldset>
                <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">
                  Messages and payment page in
                </legend>
                <div
                  className="grid grid-cols-2 gap-2.5 sm:max-w-sm"
                  role="radiogroup"
                >
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
                        if (
                          s.package.included ===
                          INCLUDED_EXAMPLE[v === "ar" ? "en" : "ar"]
                        )
                          set("package", { included: INCLUDED_EXAMPLE[v] });
                      }}
                    >
                      {label}
                    </Choice>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-7">
              <fieldset>
                <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">
                  Occasion
                </legend>
                <div
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
                  role="radiogroup"
                >
                  {EVENT_TYPES.map((t) => (
                    <Choice
                      key={t}
                      active={s.event.type === t}
                      onClick={() => set("event", { type: t })}
                      icon={ICONS[t]}
                    >
                      {common.eventTypes[t]}
                    </Choice>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">
                  Invitation language
                </legend>
                <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup">
                  {(["EN", "AR", "BILINGUAL"] as Lang[]).map((l) => (
                    <Choice
                      key={l}
                      active={lang === l}
                      onClick={() => set("event", { language: l })}
                    >
                      {common.eventLanguages[l]}
                    </Choice>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div
                className={cn(
                  "grid gap-4",
                  showEn && showAr && "sm:grid-cols-2",
                )}
              >
                {showEn ? (
                  <Field
                    id="ev-title"
                    label="Event name"
                    error={err("event.title")}
                  >
                    <Input
                      id="ev-title"
                      value={s.event.title}
                      onChange={(e) => set("event", { title: e.target.value })}
                      placeholder="e.g. Sara & Omar's Wedding"
                      aria-invalid={Boolean(err("event.title"))}
                    />
                  </Field>
                ) : null}
                {showAr ? (
                  <Field
                    id="ev-title-ar"
                    label="Event name (Arabic)"
                    optional={showEn ? "(optional)" : undefined}
                    error={err("event.titleAr")}
                  >
                    <Input
                      id="ev-title-ar"
                      dir="rtl"
                      value={s.event.titleAr}
                      onChange={(e) =>
                        set("event", { titleAr: e.target.value })
                      }
                      placeholder="مثال: زفاف سارة وعمر"
                      aria-invalid={Boolean(err("event.titleAr"))}
                    />
                  </Field>
                ) : null}
                {showEn ? (
                  <Field
                    id="ev-hosts"
                    label="Hosted by"
                    error={err("event.hostNames")}
                  >
                    <Input
                      id="ev-hosts"
                      value={s.event.hostNames}
                      onChange={(e) =>
                        set("event", { hostNames: e.target.value })
                      }
                      placeholder="e.g. The Al-Qahtani family"
                      aria-invalid={Boolean(err("event.hostNames"))}
                    />
                  </Field>
                ) : null}
                {showAr ? (
                  <Field
                    id="ev-hosts-ar"
                    label="Hosted by (Arabic)"
                    optional={showEn ? "(optional)" : undefined}
                    error={err("event.hostNamesAr")}
                  >
                    <Input
                      id="ev-hosts-ar"
                      dir="rtl"
                      value={s.event.hostNamesAr}
                      onChange={(e) =>
                        set("event", { hostNamesAr: e.target.value })
                      }
                      placeholder="مثال: عائلة القحطاني"
                      aria-invalid={Boolean(err("event.hostNamesAr"))}
                    />
                  </Field>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="ev-date" label="Date" error={err("event.date")}>
                  <DateInput
                    id="ev-date"
                    min={today()}
                    value={s.event.date}
                    onChange={(v) => set("event", { date: v })}
                    invalid={Boolean(err("event.date"))}
                    describedBy={
                      err("event.date") ? "ev-date-error" : undefined
                    }
                  />
                </Field>
                <Field id="ev-time" label="Time" error={err("event.time")}>
                  <Input
                    id="ev-time"
                    type="time"
                    value={s.event.time}
                    onChange={(e) => set("event", { time: e.target.value })}
                    aria-invalid={Boolean(err("event.time"))}
                  />
                </Field>
                <Field
                  id="ev-tz"
                  label="Time zone"
                  error={err("event.timezone")}
                >
                  <Select
                    id="ev-tz"
                    value={s.event.timezone}
                    onChange={(e) => set("event", { timezone: e.target.value })}
                  >
                    {TZ_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div
                className={cn(
                  "grid gap-4",
                  showEn && showAr && "sm:grid-cols-2",
                )}
              >
                {showEn ? (
                  <Field
                    id="ev-venue"
                    label="Venue"
                    error={err("event.venueName")}
                  >
                    <Input
                      id="ev-venue"
                      value={s.event.venueName}
                      onChange={(e) =>
                        set("event", { venueName: e.target.value })
                      }
                      placeholder="e.g. Al Faisaliah Ballroom"
                      aria-invalid={Boolean(err("event.venueName"))}
                    />
                  </Field>
                ) : null}
                {showAr ? (
                  <Field
                    id="ev-venue-ar"
                    label="Venue (Arabic)"
                    optional={showEn ? "(optional)" : undefined}
                    error={err("event.venueNameAr")}
                  >
                    <Input
                      id="ev-venue-ar"
                      dir="rtl"
                      value={s.event.venueNameAr}
                      onChange={(e) =>
                        set("event", { venueNameAr: e.target.value })
                      }
                      placeholder="مثال: قاعة الفيصلية"
                      aria-invalid={Boolean(err("event.venueNameAr"))}
                    />
                  </Field>
                ) : null}
              </div>
              <Field
                id="ev-address"
                label="Address"
                optional="(optional)"
                error={err("event.address")}
              >
                <Input
                  id="ev-address"
                  value={s.event.address}
                  onChange={(e) => set("event", { address: e.target.value })}
                  placeholder="Street, district, city"
                />
              </Field>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
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
                  <Field
                    id="pkg-guests"
                    label="Guests included"
                    error={err("package.guestLimit")}
                    className="mt-4 sm:max-w-xs"
                  >
                    <Input
                      id="pkg-guests"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={s.package.guestLimit}
                      onChange={(e) =>
                        set("package", { guestLimit: e.target.value })
                      }
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
                  <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-[13px] text-ink-faint">
                    {currency}
                  </span>
                </div>
              </Field>
              <Field
                id="pkg-included"
                label="What's included"
                optional="(shown on the payment page and receipt)"
                error={err("package.included")}
              >
                <Textarea
                  id="pkg-included"
                  rows={5}
                  maxLength={800}
                  value={s.package.included}
                  onChange={(e) => set("package", { included: e.target.value })}
                />
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
                    max={s.event.date || undefined}
                    value={s.package.dueDate}
                    onChange={(v) => set("package", { dueDate: v })}
                    invalid={Boolean(err("package.dueDate"))}
                    describedBy={
                      err("package.dueDate") ? "pkg-due-error" : "pkg-due-hint"
                    }
                  />
                </Field>
                <Field
                  id="pkg-note"
                  label="Internal note"
                  optional="(staff only)"
                  error={err("package.note")}
                >
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
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                <Summary label="Host" onEdit={() => go(0)}>
                  <p className="text-ink">{s.host.name}</p>
                  <p className="text-ink-faint" dir="ltr">
                    {s.host.email}
                    {s.host.phone ? ` · ${s.host.phone}` : ""}
                  </p>
                  <p className="text-ink-faint">
                    {customer ? "Existing customer" : "New customer"} ·{" "}
                    {s.host.locale === "ar" ? "Arabic" : "English"}
                  </p>
                </Summary>
                <Summary label="Event" onEdit={() => go(2)}>
                  <p className="text-ink">
                    {lang === "AR"
                      ? s.event.titleAr || s.event.title
                      : s.event.title}
                  </p>
                  {lang === "BILINGUAL" && s.event.titleAr ? (
                    <p dir="rtl" className="text-left text-ink-soft">
                      {s.event.titleAr}
                    </p>
                  ) : null}
                  <p className="text-ink-faint">
                    {common.eventTypes[s.event.type]} ·{" "}
                    {common.eventLanguages[lang]}
                  </p>
                  <p className="text-ink-faint">
                    {s.event.date
                      ? new Intl.DateTimeFormat("en-GB", {
                          dateStyle: "full",
                          timeZone: "UTC",
                        }).format(new Date(`${s.event.date}T00:00:00Z`))
                      : "—"}{" "}
                    · {s.event.time} ·{" "}
                    {lang === "AR"
                      ? s.event.venueNameAr || s.event.venueName
                      : s.event.venueName}
                  </p>
                </Summary>
                <Summary label="Package" onEdit={() => go(3)}>
                  <p className="font-display text-2xl text-ink">{total}</p>
                  <p className="text-ink-soft">{guests}</p>
                  {s.package.included.trim() ? (
                    <p className="mt-1 whitespace-pre-line text-ink-faint">
                      {s.package.included.trim()}
                    </p>
                  ) : null}
                  {s.package.dueDate ? (
                    <p className="mt-1 text-ink-faint">
                      Pay by {s.package.dueDate}
                    </p>
                  ) : null}
                </Summary>
              </dl>

              <div className="flex items-start gap-3 rounded-2xl border border-line bg-sand/40 p-4 text-[13.5px] text-ink-soft sm:p-5">
                <Palette className="mt-0.5 size-4 shrink-0 text-bronze-600" />
                <p>
                  <span className="font-medium text-ink">
                    Nothing is sent yet.
                  </span>{" "}
                  Next you choose the invitation design — any design, premium
                  included, or your own artwork — and its wording. Then you send
                  the payment link by WhatsApp or email.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {formError ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-rosewood/20 bg-rosewood-soft px-4 py-3 text-[13.5px] text-rosewood"
          >
            {formError}
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          {step > 0 ? (
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => go(step - 1)}
              disabled={busy}
            >
              Back
            </Button>
          ) : (
            <Link href="/admin/custom" className={buttonClasses("ghost", "md")}>
              Cancel
            </Link>
          )}
          {step < WIZARD_STEPS - 1 ? (
            <Button onClick={next}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              variant="accent"
              onClick={submit}
              loading={busy}
              icon={<Palette className="size-4" />}
            >
              Create & design invitation
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Choice({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-start text-sm transition-all duration-300 ease-luxe [&>svg]:size-4 [&>svg]:shrink-0",
        active
          ? "border-bronze-400 bg-bronze-50 text-ink shadow-soft [&>svg]:text-bronze-600"
          : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink [&>svg]:text-ink-faint",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Summary({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4 px-4 py-4 text-[13.5px] sm:px-5">
      <dt className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faint sm:w-24">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 space-y-0.5">{children}</dd>
      <button
        type="button"
        onClick={onEdit}
        className="self-start text-[12.5px] font-medium text-bronze-700 underline-offset-4 hover:underline"
      >
        Edit
      </button>
    </div>
  );
}
