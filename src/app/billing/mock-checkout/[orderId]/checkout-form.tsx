"use client";

import { useState, type FormEvent } from "react";
import { CreditCard, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

function formatCard(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Simulated card form for the TEST MODE checkout. */
export function MockCheckoutForm({ orderId, defaultName, amountLabel }: { orderId: string; defaultName: string; amountLabel: string }) {
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12 / 34");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  async function pay(e: FormEvent) {
    e.preventDefault();
    setBusy("pay");
    setError(null);
    setCardError(null);
    try {
      const r = await api<{ redirectUrl: string }>(`/api/billing/mock/${encodeURIComponent(orderId)}/complete`, { body: { card, name } });
      window.location.assign(r.redirectUrl);
    } catch (err) {
      const e = err as ApiError;
      if (e.fields?.card) setCardError(e.fields.card);
      setError(e.message || "Payment failed.");
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    setError(null);
    try {
      const r = await api<{ redirectUrl: string }>(`/api/billing/mock/${encodeURIComponent(orderId)}/cancel`, { body: {} });
      window.location.assign(r.redirectUrl);
    } catch (err) {
      setError((err as ApiError).message || "Could not cancel.");
      setBusy(null);
    }
  }

  return (
    <form onSubmit={pay} noValidate className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Pay with card</p>
        <CreditCard className="size-5 text-ink-faint" aria-hidden="true" />
      </div>
      <Field id="card" label="Card number" error={cardError} hint="4242 4242 4242 4242 succeeds · 4000 0000 0000 0002 is declined">
        <Input
          id="card"
          inputMode="numeric"
          autoComplete="off"
          value={card}
          onChange={(e) => setCard(formatCard(e.target.value))}
          aria-invalid={Boolean(cardError)}
          className="tabular-nums tracking-[0.12em]"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="expiry" label="Expiry">
          <Input id="expiry" autoComplete="off" value={expiry} onChange={(e) => setExpiry(e.target.value.slice(0, 7))} className="tabular-nums" />
        </Field>
        <Field id="cvc" label="CVC">
          <Input id="cvc" inputMode="numeric" autoComplete="off" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} className="tabular-nums" />
        </Field>
      </div>
      <Field id="name" label="Name on card">
        <Input id="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="rounded-xl border border-rosewood/20 bg-rosewood-soft px-4 py-3 text-sm text-rosewood">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 pt-2">
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === "pay"} disabled={busy !== null} icon={<Lock className="size-4" />}>
          Pay {amountLabel}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={cancel} loading={busy === "cancel"} disabled={busy !== null}>
          Cancel and return
        </Button>
      </div>
    </form>
  );
}
