"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, MessageCircle, Send, Users } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stepHref } from "./steps";
import { Bubble, ChatFrame } from "./whatsapp-preview";

export type ManualGuestRow = {
  id: string;
  name: string;
  phone: string;
  groupName: string | null;
  status: string;
  manualSentAt: string | null;
  sentByInvtra: boolean;
  link: string;
  text: string;
  waUrl: string;
};

const REPLIED = new Set(["ACCEPTED", "DECLINED", "INVITATION_SENT", "VIEWED", "QR_SCANNED"]);

/**
 * "From my own WhatsApp": a list of guests, each with a button that opens the host's
 * WhatsApp on that guest's chat with the invitation message (and personal link) typed in.
 * The host presses send in WhatsApp; the guest is counted as sent when the button is used.
 */
export function ManualSendPanel({ eventId, ready, guests: initial }: { eventId: string; ready: boolean; guests: ManualGuestRow[] }) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.send.manual;
  const toast = useToast();
  const [guests, setGuests] = useState(initial);
  const [filter, setFilter] = useState<"unsent" | "all">("unsent");
  const [justSent, setJustSent] = useState<string | null>(null);

  const isSent = (g: ManualGuestRow) => Boolean(g.manualSentAt) || g.sentByInvtra;
  const sentCount = guests.filter(isSent).length;
  const unsent = guests.filter((g) => !isSent(g));
  const shown = filter === "unsent" ? unsent : guests;
  const next = unsent[0] ?? null;
  const preview = next ?? guests[0] ?? null;
  const n = (v: number) => formatNumber(v, locale);

  function markSent(id: string) {
    const now = new Date().toISOString();
    setGuests((list) => list.map((g) => (g.id === id ? { ...g, manualSentAt: now } : g)));
    setJustSent(id);
    // keepalive: the request survives the switch to the WhatsApp app on phones.
    void fetch(`/api/events/${eventId}/guests/${id}/manual-sent`, { method: "POST", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
  }

  async function copy(g: ManualGuestRow) {
    try {
      await navigator.clipboard.writeText(g.text);
      toast(d.copied, "success");
    } catch {
      window.prompt(d.copy, g.text);
    }
  }

  if (!ready) {
    return (
      <Card className="px-6 py-10 text-center sm:px-10">
        <h2 className="font-display text-3xl text-ink">{d.notReadyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">{guests.length ? d.notReadyBody : d.noGuests}</p>
        <Link href={stepHref(eventId, guests.length ? "review" : "guests")} className={buttonClasses("primary", "md", "mt-6")}>
          {guests.length ? d.notReadyCta : d.addGuests}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="eyebrow">{dict.dashboard.send.eyebrow}</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl leading-[1.1] text-ink sm:text-5xl">{d.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">{d.body}</p>
      </div>

      {/* Progress + the next guest, one tap away */}
      <Card className="px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-display text-3xl text-ink lining-nums tabular-nums" aria-live="polite">
            {fmt(d.progress, { sent: n(sentCount), total: n(guests.length) })}
          </p>
          {next ? (
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <span className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">{d.nextLabel}</span>
              <SendLink g={next} onSend={markSent} className={buttonClasses("accent", "lg", "w-full sm:w-auto")}>
                <WhatsAppGlyph />
                {fmt(d.next, { name: next.name })}
              </SendLink>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[15px] font-medium text-sage">
              <Check className="size-5" />
              {d.allDone}
            </p>
          )}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuemin={0} aria-valuemax={guests.length} aria-valuenow={sentCount}>
          <div className="h-full rounded-full bg-[#25D366] transition-[width] duration-500" style={{ width: `${guests.length ? (sentCount / guests.length) * 100 : 0}%` }} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "unsent", label: fmt(d.filterUnsent, { n: n(unsent.length) }) },
                { value: "all", label: fmt(d.filterAll, { n: n(guests.length) }) },
              ]}
            />
          </div>
          {shown.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
              {shown.map((g) => {
                const sent = isSent(g);
                const replied = REPLIED.has(g.status);
                return (
                  <li key={g.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5", justSent === g.id && "bg-[#25D366]/[0.06]")}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{g.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-faint">
                        <span dir="ltr">{g.phone}</span>
                        {g.groupName ? <span>· {g.groupName}</span> : null}
                        <span className={cn(replied ? "text-sage" : sent ? "text-[#128C7E]" : "")}>
                          · {replied ? dict.common.guestStatus[g.status as keyof typeof dict.common.guestStatus] : g.manualSentAt ? d.sent : g.sentByInvtra ? d.sentByInvtra : d.notSent}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copy(g)}
                        className="flex size-9 items-center justify-center rounded-full text-ink-faint transition hover:bg-sand hover:text-ink"
                        aria-label={`${d.copy} — ${g.name}`}
                        title={d.copy}
                      >
                        <Copy className="size-4" />
                      </button>
                      <SendLink g={g} onSend={markSent} className={buttonClasses(sent ? "outline" : "primary", "sm")}>
                        <WhatsAppGlyph />
                        {sent ? d.sendAgain : d.send}
                      </SendLink>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-line bg-paper px-5 py-8 text-center text-[14px] text-ink-faint">
              <Check className="mx-auto mb-2 size-6 text-sage" />
              {d.allDone}
            </p>
          )}
        </div>

        <aside className="space-y-5">
          {preview ? (
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-ink-faint">{d.preview}</p>
              <ChatFrame title={preview.name} subtitle={preview.phone}>
                <Bubble side="out" body={preview.text} />
              </ChatFrame>
            </div>
          ) : null}
          <div className="rounded-2xl border border-line bg-ivory/60 px-5 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <Users className="size-4 text-bronze-600" />
              {d.howTitle}
            </p>
            <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-soft">
              {d.how.map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sand text-[11px] font-medium text-ink">{n(i + 1)}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Opens WhatsApp with the message ready, and counts the guest as sent. */
function SendLink({ g, onSend, className, children }: { g: ManualGuestRow; onSend: (id: string) => void; className?: string; children: ReactNode }) {
  return (
    <a href={g.waUrl} target="_blank" rel="noopener noreferrer" onClick={() => onSend(g.id)} className={className}>
      {children}
    </a>
  );
}

function WhatsAppGlyph() {
  return <MessageCircle className="size-4" aria-hidden="true" />;
}

/** Tabs on the Send step: INVTRA's own sending, or the host's WhatsApp. */
export function SendModes({ defaultMode, previewMode, invtra, manual }: { defaultMode: "invtra" | "manual"; previewMode: boolean; invtra: ReactNode; manual: ReactNode }) {
  const { dict } = useI18n();
  const d = dict.dashboard.send;
  const [mode, setMode] = useState(defaultMode);
  const tabs = useMemo(
    () => [
      { value: "manual" as const, label: d.modes.manual, icon: <MessageCircle className="size-4" /> },
      { value: "invtra" as const, label: d.modes.invtra, icon: <Send className="size-4 rtl:-scale-x-100" /> },
    ],
    [d],
  );
  return (
    <div className="mx-auto max-w-5xl">
      <div role="tablist" aria-label={d.modes.label} className="mx-auto mb-8 flex w-fit rounded-full border border-line bg-sand/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={mode === t.value}
            onClick={() => setMode(t.value)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-300 ease-luxe sm:px-5",
              mode === t.value ? "bg-paper text-ink shadow-soft" : "text-ink-faint hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {mode === "invtra" && previewMode ? (
        <p className="mx-auto mb-6 max-w-2xl rounded-2xl border border-ochre/25 bg-ochre-soft px-5 py-3 text-center text-[13.5px] text-ink-soft">{d.previewNote}</p>
      ) : null}
      <div role="tabpanel">{mode === "manual" ? manual : invtra}</div>
    </div>
  );
}
