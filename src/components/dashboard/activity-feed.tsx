"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  Eye,
  FileSpreadsheet,
  Pencil,
  QrCode,
  Send,
  SendHorizontal,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { fmt, type Locale } from "@/lib/i18n/config";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { plural } from "./i18n";

export type ActivityItem = { id: string; kind: string; data: Record<string, unknown> | null; createdAt: string; guestId: string | null };

type Tone = "sage" | "rosewood" | "bronze" | "slate" | "neutral";

/** Human sentence + icon + tone for an activity row. */
export function describeActivity(a: ActivityItem, dict: Dictionary, locale: Locale): { text: string; note?: string; icon: React.ReactNode; tone: Tone } {
  const d = dict.dashboard.activity;
  const data = a.data ?? {};
  const name = String(data.name ?? "");
  const num = (k: string) => (typeof data[k] === "number" ? (data[k] as number) : Number(data[k] ?? 0) || 0);
  const n = (v: number) => formatNumber(v, locale);
  const reason = typeof data.reason === "string" ? data.reason : "";
  const failure = (dict.dashboard.failures as Record<string, { short: string }>)[reason]?.short;
  const source = data.source === "HOST" ? d.byHost : data.source === "WEB" ? d.byWeb : undefined;

  switch (a.kind) {
    case "event.created":
      return { text: fmt(d.created, { title: String(data.title ?? "") }), icon: <CalendarPlus />, tone: "bronze" };
    case "event.updated":
      return { text: d.updated, icon: <Pencil />, tone: "neutral" };
    case "guests.imported": {
      const skipped = num("duplicates") + num("invalid");
      return {
        text: plural(locale, d.imported, num("created")),
        note: skipped ? fmt(d.importedSkipped, { duplicates: n(num("duplicates")), invalid: n(num("invalid")) }) : undefined,
        icon: <FileSpreadsheet />,
        tone: "slate",
      };
    }
    case "batch.started":
      return {
        text: plural(locale, data.kind === "RESEND" ? d.batchResend : d.batchStarted, num("total")),
        icon: <Send className="rtl:-scale-x-100" />,
        tone: "slate",
      };
    case "batch.completed":
      if (data.cancelled) return { text: d.batchCancelled, icon: <XCircle />, tone: "neutral" };
      return {
        text: fmt(d.batchCompleted, { sent: n(num("sent")) }),
        note: num("failed") ? fmt(d.batchCompletedFailed, { failed: n(num("failed")) }) : undefined,
        icon: <SendHorizontal className="rtl:-scale-x-100" />,
        tone: num("failed") ? "rosewood" : "sage",
      };
    case "guest.accepted": {
      const attending = num("attending");
      return {
        text: attending > 1 ? fmt(d.acceptedWith, { name, n: n(attending) }) : fmt(d.accepted, { name }),
        note: source,
        icon: <CheckCircle2 />,
        tone: "sage",
      };
    }
    case "guest.declined":
      return { text: fmt(d.declined, { name }), note: source, icon: <XCircle />, tone: "rosewood" };
    case "guest.changed_to_declined":
      return { text: fmt(d.changedToDeclined, { name }), note: source, icon: <XCircle />, tone: "rosewood" };
    case "guest.changed_to_accepted":
      return { text: fmt(d.changedToAccepted, { name }), note: source, icon: <CheckCircle2 />, tone: "sage" };
    case "guest.invitation_sent":
      return { text: fmt(data.update ? d.invitationUpdated : d.invitationSent, { name }), icon: <Sparkles />, tone: "bronze" };
    case "guest.invitation_failed":
      return { text: fmt(d.invitationFailed, { name }), note: failure, icon: <AlertCircle />, tone: "rosewood" };
    case "guest.message_failed":
      return { text: fmt(d.messageFailed, { name }), note: failure, icon: <AlertCircle />, tone: "rosewood" };
    case "guest.viewed":
      return { text: fmt(d.viewed, { name }), icon: <Eye />, tone: "bronze" };
    case "guest.scanned":
      return { text: fmt(d.scanned, { name }), icon: <QrCode />, tone: "bronze" };
    case "guest.checked_in": {
      const count = num("count");
      return { text: count > 1 ? fmt(d.checkedInWith, { name, n: n(count) }) : fmt(d.checkedIn, { name }), icon: <DoorOpen />, tone: "sage" };
    }
    case "plan.purchased": {
      const plan = String(data.plan ?? data.tier ?? "");
      const label = (dict.common.plans as Record<string, string>)[plan];
      return { text: label ? fmt(d.planPurchased, { plan: label }) : d.planPurchasedGeneric, icon: <CreditCard />, tone: "bronze" };
    }
    default:
      return { text: d.unknown, icon: <Sparkles />, tone: "neutral" };
  }
}

const toneClass: Record<Tone, string> = {
  sage: "bg-sage-soft text-sage",
  rosewood: "bg-rosewood-soft text-rosewood",
  bronze: "bg-bronze-50 text-bronze-600",
  slate: "bg-slate-soft text-slate",
  neutral: "bg-sand text-ink-faint",
};

export function ActivityFeed({ items, dict, locale, now, empty }: { items: ActivityItem[]; dict: Dictionary; locale: Locale; now: number; empty: string }) {
  if (!items.length) return <p className="px-6 py-10 text-center text-sm leading-relaxed text-ink-faint">{empty}</p>;
  return (
    <ol className="relative px-6 py-4">
      <span className="absolute bottom-6 start-[2.4rem] top-6 w-px bg-line" aria-hidden />
      <AnimatePresence initial={false}>
        {items.map((a) => {
          const v = describeActivity(a, dict, locale);
          return (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex items-start gap-3.5 py-2.5"
            >
              <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-paper [&>svg]:size-3.5", toneClass[v.tone])}>
                {v.icon}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm leading-snug text-ink">{v.text}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {v.note ? <span>{v.note} · </span> : null}
                  <time dateTime={a.createdAt}>{formatRelative(new Date(a.createdAt), locale, new Date(now))}</time>
                </p>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
