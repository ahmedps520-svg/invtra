"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Circle, Download, FileText, Lock, MessageSquare } from "lucide-react";
import type { OrderStage } from "@prisma/client";
import { useI18n } from "@/components/i18n/provider";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { errorMessage } from "../i18n";
import { BankBox, ReceiptUploader, type BankView, type ReceiptView } from "../wizard/payment-form";

export const STAGE_TONE: Record<OrderStage, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "ochre",
  PENDING_VERIFICATION: "ochre",
  INFO_REQUIRED: "rosewood",
  REJECTED: "rosewood",
  APPROVED: "sage",
  IN_PRODUCTION: "bronze",
  READY: "sage",
  DELIVERED: "sage",
  CANCELLED: "neutral",
};

export type OrderDetailData = {
  id: string;
  reference: string;
  stage: OrderStage;
  placed: string;
  amount: string;
  productName: string;
  eventId: string | null;
  eventTitle: string | null;
  path: { stage: OrderStage; at: string | null }[];
  rejectionReason: string | null;
  infoRequest: string | null;
  transferReference: string | null;
  receipts: ReceiptView[];
  files: { id: string; name: string; size: string }[] | null;
  receiptUrl: string | null;
  receiptNumber: string | null;
  guests: boolean;
  bank: BankView | null;
};

/** The customer's order: where it stands, what staff need, how to pay, and the files once approved. */
export function OrderDetail({ order, justSubmitted = false }: { order: OrderDetailData; justSubmitted?: boolean }) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders;
  const p = d.page;
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [reference, setReference] = useState(order.transferReference ?? "");
  const [busy, setBusy] = useState(false);
  const awaiting = order.stage === "DRAFT" || order.stage === "SUBMITTED" || order.stage === "PENDING_VERIFICATION";
  const current = order.path.findIndex((s) => s.stage === order.stage);

  async function reply() {
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/reply`, { method: "POST", body: { note, reference: reference.trim() || null } });
      toast(p.sent);
      setNote("");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  async function resubmit() {
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/submit`, { method: "POST", body: { reference: reference.trim() || null } });
      toast(p.resubmitted);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-6 pb-8">
      {justSubmitted && order.stage === "PENDING_VERIFICATION" ? (
        <Card className="border-sage/30 bg-sage-soft/40 p-6 sm:p-8" role="status">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-8 shrink-0 text-sage" />
            <div>
              <h2 className="font-display text-2xl text-ink sm:text-3xl">{d.done.title}</h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{d.done.body}</p>
              <p className="mt-3 inline-flex rounded-full bg-ochre-soft px-3.5 py-1 text-[13px] font-medium text-ochre">{d.done.status}</p>
            </div>
          </div>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{order.productName}</p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{fmt(p.title, { reference: order.reference })}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {order.eventTitle ? `${order.eventTitle} · ` : ""}
            {fmt(p.placed, { date: order.placed })} · {order.amount}
          </p>
        </div>
        <Badge tone={STAGE_TONE[order.stage]} dot className="text-[13px]">
          {d.stages[order.stage]}
        </Badge>
      </div>
      <p className="max-w-2xl text-[15px] text-ink-soft" role="status">
        {d.stageHelp[order.stage]}
      </p>

      {order.stage === "REJECTED" ? (
        <Card className="border-rosewood/30 p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-medium text-rosewood">
            <AlertTriangle className="size-4" />
            {p.reasonTitle}
          </h2>
          <p className="mt-2 whitespace-pre-line text-[15px] text-ink">{order.rejectionReason}</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="o-ref" label={d.payment.reference} hint={d.payment.referenceHint}>
              <Input id="o-ref" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <div>
              <p className="text-sm font-medium text-ink">{d.payment.receipt}</p>
              <p className="mb-3 mt-1 text-[13px] text-ink-faint">{d.payment.receiptHint}</p>
              <ReceiptUploader orderId={order.id} initial={order.receipts} />
            </div>
          </div>
          <Button className="mt-6" loading={busy} onClick={resubmit}>
            {p.resubmit}
          </Button>
        </Card>
      ) : null}

      {order.stage === "INFO_REQUIRED" ? (
        <Card className="border-ochre/40 p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-medium text-ink">
            <MessageSquare className="size-4 text-ochre" />
            {p.infoTitle}
          </h2>
          <p className="mt-2 whitespace-pre-line text-[15px] text-ink">{order.infoRequest}</p>
          <div className="mt-6 space-y-5">
            <Field id="o-note" label={p.reply}>
              <Textarea id="o-note" rows={4} maxLength={2000} value={note} placeholder={p.replyPlaceholder} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="o-ref2" label={d.payment.reference} hint={d.payment.referenceHint}>
                <Input id="o-ref2" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
              </Field>
              <div>
                <p className="text-sm font-medium text-ink">{d.payment.receipt}</p>
                <p className="mb-3 mt-1 text-[13px] text-ink-faint">{d.payment.receiptHint}</p>
                <ReceiptUploader orderId={order.id} initial={order.receipts} />
              </div>
            </div>
            <Button loading={busy} disabled={note.trim().length < 2} onClick={reply}>
              {p.send}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <h2 className="font-display text-2xl text-ink">{p.files}</h2>
            {order.files ? (
              <ul className="mt-4 space-y-2">
                {order.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
                    <FileText className="size-4 shrink-0 text-bronze-600" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.name}</span>
                    <span className="text-[12px] text-ink-faint">{f.size}</span>
                    <a href={`/api/orders/${order.id}/files/${f.id}`} className={buttonClasses("primary", "sm")} download data-testid="final-download">
                      <Download className="size-3.5" />
                      {p.download}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-start gap-2 text-[14px] text-ink-soft">
                <Lock className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                {p.filesLocked}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {order.receiptUrl ? (
                <a href={order.receiptUrl} className={buttonClasses("outline", "sm")}>
                  {fmt(p.receiptLink, { number: order.receiptNumber ?? "" })}
                </a>
              ) : null}
              {order.eventId ? (
                <Link href={`/dashboard/events/${order.eventId}`} className={buttonClasses("ghost", "sm")}>
                  {p.openEvent}
                </Link>
              ) : null}
              {order.guests && order.files && order.eventId ? (
                <Link href={`/dashboard/events/${order.eventId}/guests`} className={buttonClasses("outline", "sm")}>
                  {p.addGuests}
                </Link>
              ) : null}
            </div>
          </Card>

          {awaiting && order.bank ? (
            <Card className="p-6 sm:p-8">
              <h2 className="font-display text-2xl text-ink">{p.payNow}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {d.payment.amount}: <span className="font-medium text-ink">{order.amount}</span>
              </p>
              <div className="mt-4">
                <BankBox bank={order.bank} reference={order.reference} />
              </div>
              <div className="mt-6">
                <p className="text-sm font-medium text-ink">{d.payment.receipt}</p>
                <p className="mb-3 mt-1 text-[13px] text-ink-faint">{d.payment.receiptHint}</p>
                <ReceiptUploader orderId={order.id} initial={order.receipts} />
              </div>
            </Card>
          ) : order.receipts.length && order.stage !== "REJECTED" && order.stage !== "INFO_REQUIRED" ? (
            <Card className="p-6 sm:p-8">
              <h2 className="font-medium text-ink">{p.receipts}</h2>
              <div className="mt-3">
                <ReceiptUploader orderId={order.id} initial={order.receipts} disabled />
              </div>
            </Card>
          ) : null}
        </div>

        <Card className="p-6">
          <h2 className="font-medium text-ink">{p.timeline}</h2>
          <ol className="mt-4 space-y-4">
            {order.path.map((s, i) => {
              const done = current >= 0 ? i <= current : Boolean(s.at);
              const now = i === current;
              return (
                <li key={s.stage} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                      done ? "bg-bronze-600 text-white" : "border border-line-strong bg-paper text-ink-faint",
                      now && "ring-4 ring-bronze-200",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : <Circle className="size-2" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm", done ? "font-medium text-ink" : "text-ink-faint")}>{d.stages[s.stage]}</span>
                    {s.at ? <span className="block text-[12px] text-ink-faint">{s.at}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}
