"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Palette, RefreshCw, Send, Sparkles } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, ProgressBar } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { percent } from "@/lib/utils";
import { ActivityFeed, type ActivityItem } from "./activity-feed";
import { errorMessage, plural } from "./i18n";
import { ResponseRing, Tile } from "./stats";
import { stepHref } from "./steps";

type PreviewProps = React.ComponentProps<typeof CardPreview>;

export type OverviewStats = {
  total: number;
  sent: number;
  accepted: number;
  declined: number;
  pending: number;
  failed: number;
  attending: number;
  views: number;
  scans: number;
  viewedGuests: number;
  scannedGuests: number;
  checkedIn: number;
};

export type BatchSummary = { id: string; total: number; sent: number; failed: number; skipped: number; status: string; kind: string } | null;

export type OverviewData = {
  stats: OverviewStats;
  activity: ActivityItem[];
  latestBatch: BatchSummary;
  staleAccepted: number;
};

const running = (b: BatchSummary) => Boolean(b && (b.status === "QUEUED" || b.status === "RUNNING"));

export function EventOverview({
  eventId,
  eventTitle,
  initial,
  preview,
  ready,
  unsent,
  serverNow,
}: {
  eventId: string;
  eventTitle: string;
  initial: OverviewData;
  preview: PreviewProps;
  ready: boolean;
  unsent: number;
  serverNow: number;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.overview;
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<OverviewData>(initial);
  const [now, setNow] = useState(serverNow);
  const [updating, setUpdating] = useState(false);
  const wasRunning = useRef(running(initial.latestBatch));

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const next = await api<OverviewData>(`/api/events/${eventId}/stats`);
      setData(next);
      setNow(Date.now());
      const isRunning = running(next.latestBatch);
      if (wasRunning.current && !isRunning) router.refresh();
      wasRunning.current = isRunning;
    } catch {
      // keep showing the last numbers; the next poll will try again
    }
  }, [eventId, router]);

  useEffect(() => {
    const t = setInterval(poll, 5000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(t);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [poll]);

  async function sendUpdate() {
    setUpdating(true);
    try {
      const res = await api<{ count: number }>(`/api/events/${eventId}/send-update`, { method: "POST", body: {} });
      toast(plural(locale, dict.dashboard.form.update.sent, res.count));
      setData((x) => ({ ...x, staleAccepted: 0 }));
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setUpdating(false);
    }
  }

  const s = data.stats;
  const batch = data.latestBatch;
  const isRunning = running(batch);
  const awaiting = Math.max(0, s.pending - unsent - s.failed);

  // What to do next, in workflow order.
  const n = d.next;
  let next: { title: string; body: string; cta: string; href: string; icon: React.ReactNode } | null = null;
  if (s.total === 0) next = { ...n.guests, href: stepHref(eventId, "guests"), icon: <Sparkles /> };
  else if (!ready && unsent > 0) next = { ...n.review, href: stepHref(eventId, "review"), icon: <Palette /> };
  else if (unsent > 0 && !isRunning)
    next = { title: plural(locale, n.send.title, unsent), body: n.send.body, cta: n.send.cta, href: stepHref(eventId, "send"), icon: <Send className="rtl:-scale-x-100" /> };
  else if (s.failed > 0)
    next = { title: plural(locale, n.failed.title, s.failed), body: n.failed.body, cta: n.failed.cta, href: `${stepHref(eventId, "guests")}?status=FAILED`, icon: <RefreshCw /> };
  else if (awaiting > 0 && !isRunning)
    next = {
      title: plural(locale, n.followUp.title, awaiting),
      body: n.followUp.body,
      cta: n.followUp.cta,
      href: `${stepHref(eventId, "guests")}?status=MESSAGE_SENT`,
      icon: <RefreshCw />,
    };
  else if (!isRunning && s.total > 0 && s.pending === 0) next = { ...n.allDone, href: stepHref(eventId, "guests"), icon: <Sparkles /> };

  const t = d.tiles;
  const processed = batch ? batch.sent + batch.failed + batch.skipped : 0;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {data.staleAccepted > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4 rounded-2xl border border-ochre/25 bg-ochre-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div>
              <p className="font-medium text-ink">{d.update.title}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{plural(locale, d.update.body, data.staleAccepted)}</p>
            </div>
            <Button variant="primary" loading={updating} onClick={sendUpdate} className="shrink-0">
              {d.update.action}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isRunning && batch ? (
        <Card className="px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-xl text-ink lining-nums" aria-live="polite">
              {fmt(d.sending, { done: formatNumber(processed, locale), total: formatNumber(batch.total, locale) })}
            </p>
            <Link href={stepHref(eventId, "send")} className="text-[13px] font-medium text-bronze-700 hover:text-bronze-900">
              {d.viewProgress}
            </Link>
          </div>
          <ProgressBar value={processed} max={batch.total} className="mt-4" />
        </Card>
      ) : next ? (
        <div className="relative overflow-hidden rounded-3xl border border-bronze-200 bg-gradient-to-br from-bronze-50 via-paper to-paper px-6 py-6 shadow-soft sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-bronze-200 bg-paper text-bronze-600 [&>svg]:size-4">
                {next.icon}
              </span>
              <div>
                <p className="eyebrow">{n.eyebrow}</p>
                <p className="mt-1.5 font-display text-2xl leading-snug text-ink">{next.title}</p>
                <p className="mt-1 max-w-xl text-sm text-ink-soft">{next.body}</p>
              </div>
            </div>
            <Link href={next.href} className={buttonClasses("primary", "md", "shrink-0 self-start sm:self-center")}>
              {next.cta}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Tile label={t.guests} value={s.total} locale={locale} tone="default" />
        <Tile label={t.accepted} value={s.accepted} locale={locale} tone="sage" />
        <Tile label={t.declined} value={s.declined} locale={locale} tone="rosewood" />
        <Tile label={t.pending} value={s.pending} locale={locale} tone="ochre" hint={t.pendingHint} />
        <Tile label={t.views} value={s.views} locale={locale} tone="bronze" hint={plural(locale, t.viewsHint, s.viewedGuests)} />
        <Tile label={t.scans} value={s.scans} locale={locale} tone="bronze" hint={plural(locale, t.scansHint, s.scannedGuests)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={d.responses.title} description={d.responses.description} />
            <div className="flex flex-col items-center gap-8 px-6 py-7 sm:flex-row sm:items-center sm:gap-10">
              <ResponseRing accepted={s.accepted} declined={s.declined} pending={s.pending} label={d.responses.replied} locale={locale} />
              <div className="w-full min-w-0 flex-1">
                <ul className="space-y-3">
                  {[
                    { label: t.accepted, value: s.accepted, color: "bg-sage" },
                    { label: t.declined, value: s.declined, color: "bg-rosewood" },
                    { label: t.pending, value: s.pending, color: "bg-ochre" },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center gap-3 text-sm">
                      <span className={`size-2.5 shrink-0 rounded-full ${row.color}`} />
                      <span className="flex-1 text-ink-soft">{row.label}</span>
                      <span className="font-medium text-ink tabular-nums">{formatNumber(row.value, locale)}</span>
                      <span className="w-12 text-end text-xs text-ink-faint tabular-nums">{formatNumber(percent(row.value, s.total), locale)}%</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
                  <MiniStat label={t.sent} value={s.sent} locale={locale} />
                  <MiniStat label={t.attending} value={s.attending} locale={locale} />
                  <MiniStat label={t.failed} value={s.failed} locale={locale} tone={s.failed ? "text-rosewood" : undefined} />
                  <MiniStat label={t.checkedIn} value={s.checkedIn} locale={locale} />
                </div>
                {s.total && !s.sent ? <p className="mt-4 text-[13px] text-ink-faint">{d.responses.empty}</p> : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={d.activity.title}
              action={
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-sage">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage opacity-40" />
                    <span className="relative inline-flex size-2 rounded-full bg-sage" />
                  </span>
                  {d.activity.live}
                </span>
              }
            />
            <div className="max-h-[32rem] overflow-y-auto">
              <ActivityFeed items={data.activity} dict={dict} locale={locale} now={now} empty={d.activity.empty} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title={d.preview.title}
              action={
                <Link href={stepHref(eventId, "design")} className="text-[13px] font-medium text-bronze-700 hover:text-bronze-900">
                  {d.preview.edit}
                </Link>
              }
            />
            <div className="paper-grain flex justify-center bg-sand px-8 py-8">
              <CardPreview {...preview} className="w-full max-w-[260px] rounded-[3px] shadow-lift ring-1 ring-ink/5" title={eventTitle} />
            </div>
          </Card>

          <DeleteEvent eventId={eventId} eventTitle={eventTitle} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, locale, tone }: { label: string; value: number; locale: "en" | "ar"; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="min-h-[2.2em] text-[11px] uppercase leading-tight tracking-[0.12em] text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl leading-none lining-nums tabular-nums ${tone ?? "text-ink"}`}>{formatNumber(value, locale)}</p>
    </div>
  );
}

function DeleteEvent({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const { dict } = useI18n();
  const d = dict.dashboard.overview.danger;
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLocaleLowerCase() === eventTitle.trim().toLocaleLowerCase();

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/events/${eventId}`, { method: "DELETE" });
      toast(d.deleted);
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rosewood/20 bg-paper px-6 py-5">
      <h3 className="font-display text-xl text-ink">{d.title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">{d.body}</p>
      <Button variant="outline" size="sm" className="mt-4 border-rosewood/30 text-rosewood hover:border-rosewood hover:bg-rosewood-soft" onClick={() => setOpen(true)}>
        {d.button}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setTyped("");
          }
        }}
        title={d.confirmTitle}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="danger" disabled={!matches} loading={busy} onClick={remove}>
              {d.confirm}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{d.confirmBody}</p>
        <p className="mt-4 rounded-xl bg-sand px-3.5 py-2.5 font-display text-lg text-ink" dir="auto">
          {eventTitle}
        </p>
        <Field id="delete-confirm" label={d.confirmLabel} className="mt-4">
          <Input
            id="delete-confirm"
            value={typed}
            dir="auto"
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches && !busy) remove();
            }}
          />
        </Field>
      </Dialog>
    </div>
  );
}
