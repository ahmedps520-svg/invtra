"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

type Bank = { bank: string; bankAr: string; name: string; iban: string; account: string };

/** Admin → Payments: the account customers pay into by bank transfer. */
export function BankForm({ initial }: { initial: Bank }) {
  const router = useRouter();
  const toast = useToast();
  const [b, setB] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Bank, v: string) => {
    setB((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ message: string }>("/api/admin/payments/bank", { body: b });
      toast(res.message, "success");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fields) setErrors(error.fields);
      toast(error instanceof ApiError ? error.message : "Couldn't save the bank details.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6" noValidate>
      <p className="flex items-center gap-2 font-medium text-ink">
        <Landmark className="size-4 text-bronze-600" />
        Bank transfer details
      </p>
      <p className="mt-1 text-[13px] text-ink-faint">
        Shown on payment links and the billing page while payments are by bank transfer. Customers send the transfer receipt on WhatsApp;
        mark the order paid when the money arrives.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field id="bank-name" label="Bank" error={errors.bank}>
          <Input id="bank-name" value={b.bank} onChange={(e) => set("bank", e.target.value)} aria-invalid={Boolean(errors.bank)} />
        </Field>
        <Field id="bank-name-ar" label="Bank (Arabic)" optional="(optional)" error={errors.bankAr}>
          <Input id="bank-name-ar" dir="rtl" value={b.bankAr} onChange={(e) => set("bankAr", e.target.value)} />
        </Field>
        <Field id="bank-holder" label="Account name" error={errors.name}>
          <Input id="bank-holder" dir="auto" value={b.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field id="bank-iban" label="IBAN" error={errors.iban}>
          <Input id="bank-iban" dir="ltr" value={b.iban} onChange={(e) => set("iban", e.target.value)} placeholder="SA00 0000 0000 0000 0000 0000" aria-invalid={Boolean(errors.iban)} />
        </Field>
        <Field id="bank-account" label="Account number" optional="(optional)" error={errors.account}>
          <Input id="bank-account" dir="ltr" value={b.account} onChange={(e) => set("account", e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" loading={busy}>
          Save bank details
        </Button>
      </div>
    </form>
  );
}
