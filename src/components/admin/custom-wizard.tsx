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
  CheckCircle2,
  ExternalLink,
  Flower2,
  Gem,
  Gift,
  GraduationCap,
  Heart,
  HeartHandshake,
  Infinity as InfinityIcon,
  Mail,
  MessageCircle,
  MoonStar,
  PartyPopper,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox, Switch } from "@/components/ui/toggle";
import { api, ApiError } from "@/lib/api-client";
import { common } from "@/lib/i18n/dictionaries/en/common";
import { EVENT_TYPES } from "@/lib/events/types";
import { formatMoney } from "@/lib/format";
import { COMMON_TIME_ZONES, zoneOffsetMs } from "@/lib/time";
import { customPackageSchema } from "@/lib/validation/custom-package";
import { cn } from "@/lib/utils";
import { CopyLinkButton } from "./custom-actions";

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

const STEPS = [
  { key: "host", label: "Host" },
  { key: "occasion", label: "Occasion" },
  { key: "details", label: "Date & venue" },
  { key: "package", label: "Package & price" },
  { key: "review", label: "Review & send" },
] as const;

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
  send: { whatsapp: boolean; email: boolean };
};

type Customer = {
  name: string;
  phone: string | null;
  locale: string;
  active: boolean;
  events: number;
};
type Created = {
  orderId: string;
  eventId: string;
  payUrl: string;
  newCustomer: boolean;
  sent: { whatsapp: boolean; email: boolean };
  customer: { name: string; email: string };
};

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
    send: {
      whatsapp: s.send.whatsapp && hasWhatsApp(s.host.phone),
      email: s.send.email,
    },
  };
}

const hasWhatsApp = (phone: string) => phone.replace(/\D/g, "").length > 4;

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
  testPayments,
  whatsappReady,
  planPrices,
}: {
  /** Prefilled from a customer's page (/admin/custom/new?email=…). */
  initialEmail?: string;
  initialCustomer?: Customer | null;
  currency: string;
  /** Payments run on the mock provider — the link "pays" without charging. */
  testPayments: boolean;
  /** An approved WhatsApp payment-request template exists. */
  whatsappReady: boolean;
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
    send: { whatsapp: whatsappReady, email: true },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [lookedUp, setLookedUp] = useState(initialEmail.trim().toLowerCase());
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
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
      setCreated(res);
      router.refresh();
      requestAnimationFrame(() => headingRef.current?.focus());
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
  const hasPhone = hasWhatsApp(s.host.phone);
  const canWhatsApp = hasPhone && whatsappReady;

  if (created) {
    return (
      <Card className="mx-auto max-w-2xl px-6 py-10 text-center sm:px-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-sage">
          <CheckCircle2 className="size-7" />
        </span>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-5 font-display text-3xl text-ink outline-none"
        >
          Custom event created
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-faint">
          {created.customer.name} can pay {total} with the link below.{" "}
          {created.sent.whatsapp && created.sent.email
            ? "It's on its way by WhatsApp and email."
            : created.sent.whatsapp
              ? "It's on its way by WhatsApp."
              : created.sent.email
                ? "It was sent by email."
                : "Nothing was sent — copy the link and share it yourself."}
          {created.newCustomer
            ? " A new account was created; the email includes a link to choose a password."
            : ""}
        </p>
        <div className="mx-auto mt-6 flex max-w-lg items-center gap-2 rounded-full border border-line bg-sand/50 py-1.5 pe-1.5 ps-4">
          <span
            className="min-w-0 flex-1 truncate text-start text-[13px] text-ink-soft"
            dir="ltr"
          >
            {created.payUrl}
          </span>
          <CopyLinkButton url={created.payUrl} />
        </div>
        {testPayments ? (
          <p className="mt-3 text-[12.5px] text-ochre">
            Test mode: the link completes a test payment — no money is taken.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <a
            href={created.payUrl}
            target="_blank"
            rel="noopener"
            className={buttonClasses("outline", "md")}
          >
            <ExternalLink className="size-4" />
            Open payment page
          </a>
          <Link
            href={`/admin/events/${created.eventId}`}
            className={buttonClasses("outline", "md")}
          >
            View event
          </Link>
          <Link href="/admin/custom" className={buttonClasses("primary", "md")}>
            All custom events
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol
        className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2"
        aria-label="Steps"
      >
        {STEPS.map((st, i) => (
          <li key={st.key} className="flex items-center gap-3">
            {i > 0 ? (
              <span className="h-px w-4 bg-line sm:w-5" aria-hidden />
            ) : null}
            <button
              type="button"
              disabled={i > step}
              onClick={() => go(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-[13px] transition disabled:cursor-default",
                i === step
                  ? "font-medium text-ink"
                  : i < step
                    ? "text-ink-soft hover:text-ink"
                    : "text-ink-faint",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[12px]",
                  i === step
                    ? "bg-ink text-ivory"
                    : i < step
                      ? "bg-bronze-100 text-bronze-700"
                      : "border border-line-strong bg-paper",
                )}
              >
                {i < step ? <CheckCircle2 className="size-3.5" /> : i + 1}
              </span>
              <span className={cn(i !== step && "hidden sm:inline")}>
                {st.label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="px-5 py-7 sm:px-8 sm:py-8">
        <p className="eyebrow mb-2">
          Step {step + 1} of {STEPS.length}
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
              "Review and send the payment link",
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
              "Check everything, then create the event and send the link.",
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
                  <Input
                    id="ev-date"
                    type="date"
                    min={today()}
                    value={s.event.date}
                    onChange={(e) => set("event", { date: e.target.value })}
                    aria-invalid={Boolean(err("event.date"))}
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
                  <Input
                    id="pkg-due"
                    type="date"
                    min={today()}
                    value={s.package.dueDate}
                    onChange={(e) =>
                      set("package", { dueDate: e.target.value })
                    }
                    aria-invalid={Boolean(err("package.dueDate"))}
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

              <fieldset className="rounded-2xl border border-line bg-sand/40 p-4 sm:p-5">
                <legend className="sr-only">Send the payment link</legend>
                <p className="mb-3 text-sm font-medium text-ink">
                  Send the payment link by
                </p>
                <div className="space-y-3">
                  <div>
                    <Checkbox
                      checked={s.send.whatsapp && canWhatsApp}
                      disabled={!canWhatsApp}
                      onChange={(v) => set("send", { whatsapp: v })}
                      label={
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5",
                            hasPhone ? "text-ink" : "text-ink-faint",
                          )}
                        >
                          <MessageCircle className="size-4" /> WhatsApp
                        </span>
                      }
                    />
                    {!hasPhone ? (
                      <p className="ms-[26px] mt-1 text-[12.5px] text-ink-faint">
                        Add a WhatsApp number in{" "}
                        <button
                          type="button"
                          className="underline underline-offset-2"
                          onClick={() => go(0)}
                        >
                          Host
                        </button>{" "}
                        to send on WhatsApp.
                      </p>
                    ) : !whatsappReady ? (
                      <p className="ms-[26px] mt-1 text-[12.5px] text-ochre">
                        The WhatsApp payment template isn&apos;t approved yet —{" "}
                        <Link
                          href="/admin/templates"
                          className="underline underline-offset-2"
                        >
                          submit it in Templates
                        </Link>
                        . Until then use email or copy the link.
                      </p>
                    ) : null}
                  </div>
                  <Checkbox
                    checked={s.send.email}
                    onChange={(v) => set("send", { email: v })}
                    label={
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        <Mail className="size-4" /> Email
                      </span>
                    }
                  />
                </div>
                <p className="mt-3 text-[12.5px] text-ink-faint">
                  Untick both to only create the link and share it yourself.
                  When the host pays, they get a numbered receipt by email
                  {canWhatsApp ? " and WhatsApp" : ""}.
                </p>
              </fieldset>
              {testPayments ? (
                <p className="rounded-xl border border-ochre/25 bg-ochre-soft px-4 py-3 text-[13px] text-ink-soft">
                  Payments are in <b>test mode</b> — the link completes a test
                  payment without charging. Set PAYMENT_PROVIDER=tap to take
                  real payments.
                </p>
              ) : null}
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
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              variant="accent"
              onClick={submit}
              loading={busy}
              icon={<Send className="size-4" />}
            >
              {s.send.email || (s.send.whatsapp && canWhatsApp)
                ? "Create & send link"
                : "Create link"}
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
