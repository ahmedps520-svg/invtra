"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { currencyDigits } from "@/lib/format";

type Prices = { customDesign: number; customDesignGuests: number; photoOnly: number; designRequest: number };

/** Admin → Payments: prices for the custom event design, Photo only and custom design requests. */
export function ProductPricesForm({ initial, currency }: { initial: Prices; currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const unit = 10 ** currencyDigits(currency);
  const [v, setV] = useState({
    customDesign: String(initial.customDesign / unit),
    photoOnly: String(initial.photoOnly / unit),
    designRequest: String(initial.designRequest / unit),
    customDesignGuests: String(initial.customDesignGuests),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, value: string) => setV((x) => ({ ...x, [k]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const minor = (s: string) => Math.round(Number(s) * unit);
      const res = await api<{ message: string }>("/api/admin/payments/products", {
        method: "PUT",
        body: {
          customDesign: minor(v.customDesign),
          photoOnly: minor(v.photoOnly),
          designRequest: minor(v.designRequest),
          customDesignGuests: Number(v.customDesignGuests),
        },
      });
      toast(res.message, "success");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fields) setErrors(error.fields);
      toast(error instanceof ApiError ? error.message : "Couldn't save the prices.", "error");
    } finally {
      setBusy(false);
    }
  }

  const money = (k: "customDesign" | "photoOnly" | "designRequest", label: string, hint: string) => (
    <Field id={`price-${k}`} label={`${label} (${currency})`} hint={hint} error={errors[k]}>
      <Input id={`price-${k}`} inputMode="decimal" value={v[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(errors[k])} />
    </Field>
  );

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6" noValidate>
      <p className="flex items-center gap-2 font-medium text-ink">
        <Tags className="size-4 text-bronze-600" />
        Product prices
      </p>
      <p className="mt-1 text-[13px] text-ink-faint">Digital invitations use the Standard and Premium plan prices. VAT included.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {money("customDesign", "Custom event design", "Designed by INVTRA, with the digital invitation")}
        <Field id="price-guests" label="Guests included" hint="With a custom event design" error={errors.customDesignGuests}>
          <Input id="price-guests" inputMode="numeric" value={v.customDesignGuests} onChange={(e) => set("customDesignGuests", e.target.value)} />
        </Field>
        {money("photoOnly", "Invitation image only", "One of our designs as a full-resolution image")}
        {money("designRequest", "Custom design request", "Added to a digital invitation or image when INVTRA designs it")}
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" size="sm" loading={busy}>
          Save prices
        </Button>
      </div>
    </form>
  );
}
