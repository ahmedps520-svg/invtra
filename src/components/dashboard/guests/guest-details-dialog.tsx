"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCheck, Clock, Copy, ExternalLink, X } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Badge, GUEST_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { errorMessage, plural } from "../i18n";
import { failureKey, type GuestRow } from "./types";

type Message = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  purpose: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED";
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};
type RsvpEntry = { id: string; response: "ACCEPTED" | "DECLINED" | "PENDING"; source: "WHATSAPP" | "WEB" | "HOST"; attendingCount: number | null; createdAt: string };
type Detail = { guest: GuestRow; invitationUrl: string; messages: Message[]; rsvps: RsvpEntry[]; scans: { id: string; createdAt: string; byHost: boolean }[] };

export function DeliveryTicks({ status }: { status: Message["status"] }) {
  if (status === "FAILED") return <X className="size-3.5 text-rosewood" strokeWidth={2.5} />;
  if (status === "QUEUED") return <Clock className="size-3.5 text-ink-faint" />;
  if (status === "SENT") return <Check className="size-3.5 text-ink-faint" strokeWidth={2.5} />;
  if (status === "DELIVERED") return <CheckCheck className="size-3.5 text-ink-faint" strokeWidth={2.5} />;
  if (status === "READ") return <CheckCheck className="size-3.5 text-[#34B7F1]" strokeWidth={2.5} />;
  return null;
}

/** Everything about one guest: replies, messages with delivery ticks, views, scans, check-in and failures. */
export function GuestDetailsDialog({
  open,
  onClose,
  eventId,
  guestId,
  onEdit,
  onResend,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  guestId: string | null;
  onEdit: (g: GuestRow) => void;
  onResend: (g: GuestRow) => void;
  onCopy: (url: string) => void;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.guestDetails;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !guestId) return;
    const ctrl = new AbortController();
    api<Detail>(`/api/events/${eventId}/guests/${guestId}`, { signal: ctrl.signal })
      .then((res) => {
        setDetail(res);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError(errorMessage(e, dict));
      });
    return () => ctrl.abort();
  }, [open, guestId, eventId, dict]);

  const g = detail && detail.guest.id === guestId ? detail.guest : null;
  const dt = (iso: string | null) => (iso ? formatDateTime(new Date(iso), { locale }) : d.never);
  const failure = g?.deliveryError ? dict.dashboard.failures[failureKey(g.deliveryError)] : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={g ? g.name : " "}
      size="lg"
      footer={
        g ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              {dict.common.actions.close}
            </Button>
            <Button variant="outline" onClick={() => onEdit(g)}>
              {dict.dashboard.guests.menu.edit}
            </Button>
            {g.rsvpStatus !== "DECLINED" ? (
              <Button variant="primary" onClick={() => onResend(g)}>
                {dict.dashboard.guests.menu.resend}
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {!g ? (
        <div className="flex justify-center py-16 text-ink-faint">{error ? <p className="text-sm text-rosewood">{error}</p> : <Spinner />}</div>
      ) : (
        <div className="space-y-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={GUEST_STATUS_TONE[g.status]} dot>
              {dict.common.guestStatus[g.status]}
            </Badge>
            {g.rsvpStatus === "ACCEPTED" && g.attendingCount ? (
              <Badge tone="sage">{plural(locale, d.attendingN, g.attendingCount)}</Badge>
            ) : null}
          </div>

          {failure ? (
            <div className="flex gap-3 rounded-2xl border border-rosewood/20 bg-rosewood-soft/60 px-4 py-3.5" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rosewood" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-rosewood">{d.problem}</p>
                <p className="mt-1 text-sm font-medium text-ink">{failure.title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{failure.fix}</p>
              </div>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Info label={d.phone}>
              <span dir="ltr" className="tabular-nums">
                {formatPhone(g.phone)}
              </span>
            </Info>
            <Info label={d.group}>{g.groupName || "—"}</Info>
            <Info label={d.admits}>{formatNumber(g.allowedCount, locale)}</Info>
            <Info label={d.language}>{g.locale === "ar" ? dict.dashboard.guestForm.ar : g.locale === "en" ? dict.dashboard.guestForm.en : d.languageDefault}</Info>
          </dl>

          <section>
            <h3 className="eyebrow">{d.invitation}</h3>
            {g.requestSentAt || g.invitationSentAt ? (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-line bg-ivory px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft" dir="ltr">
                  {detail!.invitationUrl}
                </span>
                <button
                  type="button"
                  onClick={() => onCopy(detail!.invitationUrl)}
                  className="rounded-full p-1.5 text-ink-faint transition hover:bg-sand hover:text-ink"
                  aria-label={dict.dashboard.guests.link.copy}
                  title={dict.dashboard.guests.link.copy}
                >
                  <Copy className="size-4" />
                </button>
                <a
                  href={detail!.invitationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full p-1.5 text-ink-faint transition hover:bg-sand hover:text-ink"
                  aria-label={dict.dashboard.guests.link.open}
                  title={dict.dashboard.guests.link.open}
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">{d.noLink}</p>
            )}
          </section>

          <section>
            <h3 className="eyebrow">{d.engagement}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Info label={d.views}>{formatNumber(g.viewCount, locale)}</Info>
              <Info label={d.firstViewed}>{dt(g.firstViewedAt)}</Info>
              <Info label={d.lastViewed}>{dt(g.lastViewedAt)}</Info>
              <Info label={d.scans}>{formatNumber(g.scanCount, locale)}</Info>
              <Info label={d.firstScanned}>{dt(g.firstScannedAt)}</Info>
              <Info label={d.checkedIn}>
                {g.checkedInAt
                  ? fmt(d.checkedInAt, { time: dt(g.checkedInAt), n: formatNumber(g.checkedInCount ?? 1, locale) })
                  : d.notCheckedIn}
              </Info>
            </dl>
          </section>

          <section>
            <h3 className="eyebrow">{d.rsvp}</h3>
            {detail!.rsvps.length ? (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
                {detail!.rsvps.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", r.response === "ACCEPTED" ? "bg-sage" : r.response === "DECLINED" ? "bg-rosewood" : "bg-ochre")} />
                      <span className="font-medium text-ink">{d.responses[r.response]}</span>
                      <span className="text-ink-faint">{d.sources[r.source]}</span>
                      {r.response === "ACCEPTED" && r.attendingCount ? (
                        <span className="text-ink-faint">· {plural(locale, d.attendingN, r.attendingCount)}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink-faint">{dt(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">{d.rsvpEmpty}</p>
            )}
          </section>

          <section>
            <h3 className="eyebrow">{d.messages}</h3>
            {detail!.messages.length ? (
              <ol className="mt-3 space-y-2">
                {detail!.messages.map((m) => {
                  const inbound = m.direction === "INBOUND";
                  const mf = m.status === "FAILED" ? dict.dashboard.failures[failureKey(m.errorCode)] : null;
                  return (
                    <li key={m.id} className={cn("flex", inbound ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                          inbound ? "rounded-se-sm bg-sage-soft text-ink" : "rounded-ss-sm border border-line bg-ivory text-ink",
                          m.status === "FAILED" && "border-rosewood/25 bg-rosewood-soft/50",
                        )}
                      >
                        <p className="font-medium">{(d.purposes as Record<string, string>)[m.purpose] ?? d.purposes.OTHER}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
                          <span>{dt(m.createdAt)}</span>
                          {!inbound ? (
                            <>
                              <span>·</span>
                              <span className={cn(m.status === "FAILED" && "text-rosewood")}>{d.messageStatus[m.status]}</span>
                              <DeliveryTicks status={m.status} />
                            </>
                          ) : null}
                        </p>
                        {mf ? <p className="mt-1 text-xs text-rosewood">{mf.title}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">{d.messagesEmpty}</p>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}
