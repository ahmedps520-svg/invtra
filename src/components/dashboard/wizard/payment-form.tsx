"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, Copy, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { errorMessage } from "../i18n";

export type BankView = { bank: string; name: string; iban: string; account: string | null };
export type ReceiptView = { id: string; name: string; mimeType: string };

export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf";

/** Upload / remove the customer's transfer receipts (shared by the payment step and the order page). */
export function ReceiptUploader({ orderId, initial, disabled }: { orderId: string; initial: ReceiptView[]; disabled?: boolean }) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders.payment;
  const toast = useToast();
  const [files, setFiles] = useState(initial);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ file: ReceiptView }>(`/api/orders/${orderId}/receipts`, { method: "POST", body: form });
      setFiles((f) => [...f, res.file]);
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/orders/${orderId}/receipts/${id}`, { method: "DELETE" });
      setFiles((f) => f.filter((x) => x.id !== id));
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    }
  }

  return (
    <div>
      {files.length ? (
        <ul className="mb-3 space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-bronze-600" />
              <a
                href={`/api/orders/${orderId}/files/${f.id}?inline=1`}
                target="_blank"
                rel="noopener"
                className="min-w-0 flex-1 truncate text-ink hover:underline"
              >
                {f.name}
              </a>
              {disabled ? null : (
                <button type="button" onClick={() => remove(f.id)} className="text-ink-faint hover:text-rosewood" aria-label={d.remove}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {disabled ? null : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
            onClick={() => input.current?.click()}
          >
            {busy ? d.uploading : d.upload}
          </Button>
          <input ref={input} type="file" accept={RECEIPT_ACCEPT} className="sr-only" onChange={(e) => upload(e.target.files)} data-testid="receipt-input" />
        </>
      )}
    </div>
  );
}

function CopyRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders.payment;
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[12px] text-ink-faint">{label}</p>
        <p className="truncate font-medium text-ink" dir={ltr ? "ltr" : undefined}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(value.replace(/\s+/g, ltr ? "" : " ")).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-soft hover:border-bronze-300"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? d.copied : d.copy}
      </button>
    </div>
  );
}

/** The bank account to transfer to, with copy buttons. */
export function BankBox({ bank, reference }: { bank: BankView; reference: string }) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders.payment;
  return (
    <div className="rounded-2xl border border-line bg-ivory/60 px-5 py-3">
      <p className="pt-2 text-sm font-medium text-ink">{d.bank}</p>
      <div className="divide-y divide-line">
        <CopyRow label={d.bankName} value={bank.bank} />
        <CopyRow label={d.accountName} value={bank.name} />
        <CopyRow label={d.iban} value={bank.iban} ltr />
        {bank.account ? <CopyRow label={d.accountNumber} value={bank.account} ltr /> : null}
        <CopyRow label={d.quote} value={reference} ltr />
      </div>
    </div>
  );
}

/** Step 6: the amount, how to transfer it, optional receipt and reference, then submit. */
export function PaymentForm({
  orderId,
  amount,
  reference,
  bank,
  receipts,
  initialTransferRef,
}: {
  orderId: string;
  amount: string;
  reference: string;
  bank: BankView;
  receipts: ReceiptView[];
  initialTransferRef: string;
}) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders.payment;
  const router = useRouter();
  const toast = useToast();
  const [transferRef, setTransferRef] = useState(initialTransferRef);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await api(`/api/orders/${orderId}/submit`, { method: "POST", body: { reference: transferRef.trim() || null } });
      // The order page opens with the confirmation on top.
      router.push(`/dashboard/orders/${orderId}?submitted=1`);
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-6 pb-6">
      <div className="max-w-2xl">
        <p className="eyebrow">{d.eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{d.title}</h2>
        <p className="mt-2 text-[15px] text-ink-soft">{d.intro}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-6 sm:p-8">
          <p className="text-[13px] text-ink-faint">{d.amount}</p>
          <p className="mt-1 font-display text-4xl text-ink" data-testid="pay-amount">
            {amount}
          </p>
          <div className="mt-6">
            <BankBox bank={bank} reference={reference} />
          </div>
        </Card>
        <Card className="space-y-6 p-6 sm:p-8">
          <Field id="pay-ref" label={d.reference} hint={d.referenceHint}>
            <Input id="pay-ref" value={transferRef} maxLength={120} onChange={(e) => setTransferRef(e.target.value)} />
          </Field>
          <div>
            <p className="text-sm font-medium text-ink">{d.receipt}</p>
            <p className="mb-3 mt-1 text-[13px] text-ink-faint">{d.receiptHint}</p>
            <ReceiptUploader orderId={orderId} initial={receipts} />
          </div>
          <div className="border-t border-line pt-6">
            <Button size="lg" className="w-full" loading={submitting} onClick={submit}>
              {submitting ? d.submitting : d.submit}
            </Button>
            <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-faint">{d.terms}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
