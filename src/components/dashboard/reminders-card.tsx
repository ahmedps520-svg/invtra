"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BellRing, Check, Loader2, MessageCircle, Send, Settings2 } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { SECTION_LABELS } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { errorMessage, plural } from "./i18n";
import { stepHref } from "./steps";
import type { FollowUpKind, FollowUpRow, ReminderOverview } from "@/server/reminders/service";

/**
 * Reminders on the event overview: the automatic day-before reminder (INVTRA), and
 * reminding guests who haven't replied — through INVTRA or from the host's own WhatsApp.
 */
export function RemindersCard({ eventId, data }: { eventId: string; data: ReminderOverview }) {
  const { dict, locale } = useI18n();
  const t = dict.dashboard.reminders;
  const toast = useToast();
  const router = useRouter();
  const [list, setList] = useState<FollowUpKind | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function nudge() {
    setBusy(true);
    try {
      const r = await api<{ queued: number }>(`/api/events/${eventId}/nudge`, { method: "POST", body: {} });
      toast(plural(locale, t.nudged, r.queued));
      setConfirm(false);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  const autoText = !data.autoReminder ? t.autoOff : data.autoCount ? plural(locale, t.autoOn, data.autoCount) : t.autoNone;

  return (
    <Card>
      <CardHeader title={t.title} description={t.description} />
      <div className="divide-y divide-line px-6 pb-2">
        <Row icon={<BellRing />} title={t.dayBefore}>
          <p>{autoText}</p>
          {data.autoReminder && data.autoCount > 0 && !data.reminderTemplate ? <p className="mt-1.5 text-ochre">{t.pendingApproval}</p> : null}
          {data.accepted ? <p className="mt-1.5 text-ink-faint">{plural(locale, t.reminded, data.reminded)}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.accepted && !data.past ? (
              <Button variant="outline" size="sm" icon={<MessageCircle className="size-3.5" />} onClick={() => setList("reminder")}>
                {t.fromMine}
              </Button>
            ) : null}
            <Link href={`${stepHref(eventId, "event")}#ev-autoReminder`} className={buttonClasses("ghost", "sm")}>
              <Settings2 className="size-3.5" />
              {t.settings}
            </Link>
          </div>
        </Row>
        <Row icon={<MessageCircle />} title={data.waiting ? plural(locale, t.waiting, data.waiting) : t.noneWaiting}>
          {!data.repliesOpen ? (
            <p className="text-ink-faint">{t.closed}</p>
          ) : data.waiting ? (
            <>
              <p>{t.nudgeHint}</p>
              {data.canNudge && !data.nudgeTemplate ? <p className="mt-1.5 text-ochre">{t.nudgeApproval}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {data.canNudge && data.nudgeTemplate ? (
                  <Button variant="primary" size="sm" icon={<Send className="size-3.5 rtl:-scale-x-100" />} onClick={() => setConfirm(true)}>
                    {t.nudge} · {formatNumber(data.canNudge, locale)}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" icon={<MessageCircle className="size-3.5" />} onClick={() => setList("nudge")}>
                  {t.fromMine}
                </Button>
              </div>
            </>
          ) : null}
        </Row>
      </div>

      <Dialog
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title={plural(locale, t.nudgeConfirm, data.canNudge)}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="primary" loading={busy} onClick={nudge}>
              {t.nudgeSend}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{t.nudgeHint}</p>
      </Dialog>

      {list ? <FollowUpDialog key={list} eventId={eventId} kind={list} onClose={() => (setList(null), router.refresh())} /> : null}
    </Card>
  );
}

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-5">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-ivory text-bronze-600 [&>svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-soft">
        <p className="mb-1 font-medium text-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Guests to remind from the host's own WhatsApp — one tap each opens the chat with the message ready. */
function FollowUpDialog({ eventId, kind, onClose }: { eventId: string; kind: FollowUpKind; onClose: () => void }) {
  const { dict, locale } = useI18n();
  const t = dict.dashboard.reminders.dialog;
  const [rows, setRows] = useState<FollowUpRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api<{ guests: FollowUpRow[] }>(`/api/events/${eventId}/followups?kind=${kind}`, { signal: ctrl.signal })
      .then((r) => setRows(r.guests))
      .catch((e) => !ctrl.signal.aborted && setError(errorMessage(e, dict)));
    return () => ctrl.abort();
  }, [eventId, kind, dict]);

  function mark(id: string) {
    const now = new Date().toISOString();
    setRows((list) => list?.map((g) => (g.id === id ? { ...g, doneAt: now } : g)) ?? list);
    // keepalive: survives the switch to the WhatsApp app on phones.
    void fetch(`/api/events/${eventId}/guests/${id}/followup`, {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    }).catch(() => undefined);
  }

  const todo = rows?.filter((g) => !g.doneAt && !g.auto) ?? [];
  const done = rows?.filter((g) => g.doneAt).length ?? 0;
  const next = todo[0] ?? null;

  return (
    <Dialog open onClose={onClose} title={kind === "reminder" ? t.reminderTitle : t.nudgeTitle} size="md">
      <p className="text-sm leading-relaxed text-ink-soft">{kind === "reminder" ? t.reminderBody : t.nudgeBody}</p>
      {error ? <p className="mt-4 text-sm text-rosewood">{error}</p> : null}
      {!rows && !error ? (
        <p className="mt-6 flex justify-center text-ink-faint">
          <Loader2 className="size-5 animate-spin" />
        </p>
      ) : null}
      {rows ? (
        rows.length ? (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-ink-faint tabular-nums">{fmt(t.progress, { done: formatNumber(done, locale), total: formatNumber(rows.length, locale) })}</p>
              {next ? (
                <a href={next.waUrl} target="_blank" rel="noopener noreferrer" onClick={() => mark(next.id)} className={buttonClasses("accent", "sm")}>
                  <MessageCircle className="size-3.5" />
                  {fmt(t.next, { name: next.name })}
                </a>
              ) : null}
            </div>
            <ul className="mt-3 max-h-[50vh] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
              {rows.map((g) => (
                <li key={g.id} className={cn("flex items-center gap-3 px-4 py-3", g.doneAt && "bg-ivory/60")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink" dir="auto">
                      {g.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-ink-faint">
                      <span dir="ltr">{g.phone}</span>
                      {g.section ? <span>· {SECTION_LABELS[g.section][locale]}</span> : null}
                      {g.doneAt ? (
                        <span className="inline-flex items-center gap-1 text-sage">
                          · <Check className="size-3" /> {t.done}
                        </span>
                      ) : g.auto ? (
                        <span className="text-[#128C7E]">· {t.auto}</span>
                      ) : null}
                    </p>
                  </div>
                  <a
                    href={g.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => mark(g.id)}
                    className={buttonClasses(g.doneAt || g.auto ? "outline" : "primary", "sm")}
                  >
                    <MessageCircle className="size-3.5" />
                    {g.doneAt ? t.again : t.send}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-line bg-ivory/60 px-4 py-6 text-center text-[13.5px] text-ink-faint">{t.empty}</p>
        )
      ) : null}
    </Dialog>
  );
}
