"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, MessageCircle, QrCode, Users } from "lucide-react";
import type { Product } from "@prisma/client";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { Features, PackageTier, QrChoice } from "@/lib/products";
import { errorMessage } from "../i18n";

/** Step 4: optional extras. Nothing here is required to continue — QR codes included. */
export function FeaturesForm({
  eventId,
  product,
  initial,
  email,
  whatsappMode,
  updates,
  tiers,
  premiumRequired,
  customGuests,
  locked,
  nextHref,
  country,
}: {
  eventId: string;
  product: Product;
  initial: Features;
  email: string;
  /** How guests' invitations go out on WhatsApp right now. */
  whatsappMode: "own" | "business";
  /** WhatsApp order updates: offered only while INVTRA's WhatsApp is connected. */
  updates: { available: boolean; enabled: boolean; phone: string };
  tiers: { tier: PackageTier; guests: number; price: string }[];
  premiumRequired: boolean;
  customGuests: number;
  locked: boolean;
  nextHref: string;
  country?: string;
}) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders.features;
  const router = useRouter();
  const toast = useToast();
  const [qr, setQr] = useState<QrChoice>(initial.qr);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [tier, setTier] = useState<PackageTier>(premiumRequired ? "PREMIUM" : initial.tier);
  const [optIn, setOptIn] = useState(updates.enabled);
  const [phone, setPhone] = useState(updates.phone);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setPhoneError(null);
    try {
      await api(`/api/events/${eventId}/setup`, {
        method: "PATCH",
        body: {
          features: { qr, whatsapp, ...(product === "INVITATION" && !locked ? { tier } : {}) },
          ...(updates.available ? { whatsappUpdates: { enabled: optIn, phone: optIn ? phone : null } } : {}),
        },
      });
      router.push(nextHref);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.fields?.phone) setPhoneError(dict.dashboard.errors.invalid_phone ?? e.message);
      toast(errorMessage(e, dict), "error");
      setSaving(false);
    }
  }

  const qrOptions: { value: QrChoice; label: string; hint: string }[] = [
    { value: "add", label: d.qr.add, hint: d.qr.addHint },
    { value: "skip", label: d.qr.skip, hint: d.qr.skipHint },
    { value: "later", label: d.qr.later, hint: d.qr.laterHint },
  ];

  return (
    <div className="animate-fade-up space-y-6 pb-6">
      <div className="max-w-2xl">
        <p className="eyebrow">{d.eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{d.title}</h2>
        <p className="mt-2 text-[15px] text-ink-soft">{d.intro}</p>
      </div>

      {product !== "PHOTO_ONLY" ? (
        <Card className="p-6 sm:p-8">
          <Heading icon={<Users className="size-4" />} title={d.package.title} />
          {product === "INVITATION" ? (
            <>
              <p className="mt-1.5 text-[14px] text-ink-soft">{d.package.description}</p>
              <div role="radiogroup" aria-label={d.package.title} className="mt-4 grid gap-3 sm:grid-cols-2">
                {tiers.map((t) => {
                  const disabled = locked || (premiumRequired && t.tier === "BASIC");
                  return (
                    <Choice key={t.tier} active={tier === t.tier} disabled={disabled} onClick={() => setTier(t.tier)} value={t.tier}>
                      <span className="font-medium text-ink">{dict.common.plans[t.tier]}</span>
                      <span className="text-[13px] text-ink-soft">{fmt(d.package.guests, { count: t.guests })}</span>
                      <span className="mt-1 text-sm font-medium text-bronze-700">{t.price}</span>
                    </Choice>
                  );
                })}
              </div>
              {premiumRequired ? <p className="mt-3 text-[13px] text-ink-faint">{d.package.premiumNeeded}</p> : null}
            </>
          ) : (
            <p className="mt-1.5 text-[14px] text-ink-soft">{fmt(d.package.customGuests, { count: customGuests })}</p>
          )}
        </Card>
      ) : null}

      <Card className="p-6 sm:p-8">
        <Heading icon={<QrCode className="size-4" />} title={d.qr.title} />
        <p className="mt-1.5 text-[14px] text-ink-soft">{d.qr.description}</p>
        <div role="radiogroup" aria-label={d.qr.title} className="mt-4 grid gap-3 sm:grid-cols-3">
          {qrOptions.map((o) => (
            <Choice key={o.value} active={qr === o.value} onClick={() => setQr(o.value)} value={o.value}>
              <span className="font-medium text-ink">{o.label}</span>
              <span className="text-[13px] text-ink-soft">{o.hint}</span>
            </Choice>
          ))}
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <Heading icon={<MessageCircle className="size-4" />} title={d.whatsapp.title} />
        <p className="mt-1.5 text-[14px] text-ink-soft">{whatsappMode === "business" ? d.whatsapp.business : d.whatsapp.own}</p>
        <div className="mt-4 rounded-2xl border border-line bg-ivory/50 px-4 py-4">
          <Switch id="ft-whatsapp" checked={whatsapp} onChange={setWhatsapp} label={d.whatsapp.toggle} description={whatsapp ? undefined : d.whatsapp.off} />
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <Heading icon={<Mail className="size-4" />} title={d.email.title} />
        <p className="mt-1.5 text-[14px] text-ink-soft">{fmt(d.email.description, { email })}</p>
        <div className="mt-6 border-t border-line pt-6">
          <p className="font-medium text-ink">{d.updates.title}</p>
          {updates.available ? (
            <>
              <p className="mt-1 text-[14px] text-ink-soft">{d.updates.description}</p>
              <div className="mt-4 rounded-2xl border border-line bg-ivory/50 px-4 py-4">
                <Switch id="ft-updates" checked={optIn} onChange={setOptIn} label={d.updates.toggle} />
              </div>
              {optIn ? (
                <Field id="ft-phone" label={d.updates.phone} error={phoneError} className="mt-4 sm:max-w-sm">
                  <PhoneInput id="ft-phone" value={phone} onChange={setPhone} defaultCountry={country} invalid={Boolean(phoneError)} />
                </Field>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-[14px] text-ink-soft">{d.updates.unavailable}</p>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" loading={saving} onClick={save}>
          {d.save}
        </Button>
      </div>
    </div>
  );
}

function Heading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2.5 font-display text-2xl text-ink">
      <span className="flex size-8 items-center justify-center rounded-full bg-sand text-bronze-700">{icon}</span>
      {title}
    </h3>
  );
}

function Choice({
  active,
  disabled,
  onClick,
  value,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      data-value={value}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-2xl border bg-paper px-4 py-3.5 text-start transition-all duration-300 ease-luxe",
        active ? "border-bronze-500 ring-2 ring-bronze-400/40" : "border-line hover:border-bronze-300",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}
