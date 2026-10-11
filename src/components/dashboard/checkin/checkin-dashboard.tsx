"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Copy, Download, MessageCircle, Minus, Plus, ScanLine, Search, ShieldX, Undo2, UserCheck, Users } from "lucide-react";
import type { DoorScanResult } from "@prisma/client";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt, type Locale } from "@/lib/i18n/config";
import { formatNumber, formatTime } from "@/lib/format";
import { qrSvg } from "@/lib/qr";
import { SECTION_LABELS, type SectionKey } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { DoorGuest } from "@/server/door/service";
import type { CheckinData, CheckinGuest, CheckinScan } from "@/server/door/dashboard";
import { errorMessage } from "../i18n";
import { stepHref } from "../steps";

type Filter = "all" | "arrived" | "expected" | "pending" | "declined";
const FILTERS: Filter[] = ["all", "arrived", "expected", "pending", "declined"];
const POLL_MS = 5000;
const SECTION_COLOR: Record<SectionKey, string> = { MEN: "#2f5d8a", WOMEN: "#a2456b" };
const FLAGGED: DoorScanResult[] = ["NOT_ACCEPTED", "UNKNOWN", "OTHER_EVENT", "REVOKED"];
const PAGE = 80;
const WINDOW_MS = 12 * 3600_000;

const matches: Record<Filter, (g: CheckinGuest) => boolean> = {
  all: () => true,
  arrived: (g) => Boolean(g.checkedInAt),
  expected: (g) => !g.checkedInAt && g.rsvpStatus === "ACCEPTED" && !g.revoked,
  pending: (g) => !g.checkedInAt && g.rsvpStatus === "PENDING" && !g.revoked,
  declined: (g) => g.rsvpStatus === "DECLINED",
};

/** People a guest's invitation brings: what they confirmed, else everyone invited. */
const partySize = (g: Pick<DoorGuest, "attendingCount" | "allowedCount">) => g.attendingCount ?? g.allowedCount;

/**
 * The host's view of the door on the night: arrivals against the guest list, refreshed every
 * few seconds, with every scan the staff make — and check-in or undo for any guest.
 */
export function CheckinDashboard({
  eventId,
  eventTitle,
  timeZone,
  initial,
}: {
  eventId: string;
  eventTitle: string;
  timeZone: string;
  initial: CheckinData;
}) {
  const { dict, locale } = useI18n();
  const t = dict.door.checkin;
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [online, setOnline] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [section, setSection] = useState<SectionKey | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<CheckinGuest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const sinceRef = useRef(initial.now);
  const n = useCallback((v: number) => formatNumber(v, locale), [locale]);
  const clock = useCallback((iso: string) => formatTime(new Date(iso), { locale, timeZone }), [locale, timeZone]);

  // ── Live updates: only guests changed since the last poll come back ─────────
  const refresh = useCallback(async () => {
    // A little overlap so a change written during the previous poll isn't missed.
    const since = new Date(new Date(sinceRef.current).getTime() - 3000).toISOString();
    try {
      const next = await api<CheckinData>(`/api/events/${eventId}/checkin?since=${encodeURIComponent(since)}`);
      sinceRef.current = next.now;
      setOnline(true);
      setData((prev) => ({ ...next, full: true, guests: mergeGuests(prev.guests, next.guests) }));
    } catch {
      setOnline(false);
    }
  }, [eventId]);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    const onShow = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [refresh]);

  // ── Check in / undo ─────────────────────────────────────────────────────────
  async function checkIn(guest: CheckinGuest, opts: { count?: number; undo?: boolean }) {
    setBusy(guest.id);
    try {
      const r = await api<{ guest: DoorGuest }>(`/api/events/${eventId}/checkin`, { method: "POST", body: { guestId: guest.id, ...opts } });
      setData((prev) => ({ ...prev, guests: prev.guests.map((g) => (g.id === guest.id ? { ...g, ...r.guest } : g)) }));
      toast(opts.undo ? t.undone : fmt(t.checkedIn, { name: guest.name }));
      setEditing(null);
      void refresh();
    } catch (e) {
      toast(errorMessage(e, dict) || t.error, "error");
    } finally {
      setBusy(null);
    }
  }

  function quickCheckIn(guest: CheckinGuest) {
    if (partySize(guest) > 1) setEditing(guest);
    else void checkIn(guest, { count: 1 });
  }

  // ── Derived numbers ─────────────────────────────────────────────────────────
  const tally = section !== "ALL" && data.sections ? data.sections[section] : data.total;
  const toCome = Math.max(0, tally.expected - tally.arrived);
  const pct = tally.expected ? Math.min(100, Math.round((tally.arrived / tally.expected) * 100)) : 0;
  const inSection = useCallback((g: CheckinGuest) => section === "ALL" || g.section === section, [section]);
  const arrivals = useMemo(() => data.guests.filter((g) => g.checkedInAt && inSection(g)), [data.guests, inSection]);
  const last = useMemo(() => arrivals.reduce<string | null>((m, g) => (!m || g.checkedInAt! > m ? g.checkedInAt : m), null), [arrivals]);

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f] = data.guests.filter((g) => inSection(g) && matches[f](g)).length;
    return out;
  }, [data.guests, inSection]);

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    const digits = text.replace(/\D/g, "");
    const rows = data.guests.filter(
      (g) =>
        inSection(g) &&
        matches[filter](g) &&
        (!text ||
          g.name.toLowerCase().includes(text) ||
          (g.groupName ?? "").toLowerCase().includes(text) ||
          (digits.length >= 3 && g.phone.replace(/\D/g, "").includes(digits))),
    );
    if (filter === "arrived") rows.sort((a, b) => (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""));
    return rows;
  }, [data.guests, filter, q, inSection]);

  const flagged = FLAGGED.reduce((s, r) => s + data.scanTotals[r], 0);
  const totalScans = Object.values(data.scanTotals).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-3xl text-ink">{t.title}</h2>
            <LiveDot online={online} label={online ? t.live : t.offline} />
          </div>
          <p className="mt-1 text-sm text-ink-faint">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/events/${eventId}/checkin/csv`} className={buttonClasses("outline", "sm")} data-testid="checkin-csv">
            <Download className="size-3.5" />
            {t.download}
          </a>
          {data.door.url ? (
            <a href={data.door.url} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "sm")}>
              <ScanLine className="size-3.5" />
              {t.openScanner}
            </a>
          ) : null}
        </div>
      </div>

      {data.sections ? (
        <div role="radiogroup" aria-label={t.guests} className="inline-flex rounded-full border border-line bg-paper p-1 shadow-soft">
          {(["ALL", "MEN", "WOMEN"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={section === k}
              onClick={() => setSection(k)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
                section === k ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink",
              )}
            >
              {k === "ALL" ? t.filters.all : SECTION_LABELS[k][locale]}
            </button>
          ))}
        </div>
      ) : null}

      {/* Headline numbers */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <Card className="flex items-center gap-5 px-5 py-4">
          <Ring pct={pct} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">{t.arrived}</p>
            <motion.p
              key={tally.arrived}
              initial={{ opacity: 0.4, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 font-display text-[2.6rem] leading-none text-ink tabular-nums"
              data-testid="checkin-arrived"
            >
              {n(tally.arrived)}
            </motion.p>
            <p className="mt-1.5 text-xs text-ink-faint">{fmt(t.ofExpected, { n: n(tally.expected) })}</p>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:contents">
          <Stat label={t.invitations} value={n(tally.arrivedGuests)} hint={fmt(t.ofAccepted, { n: n(tally.accepted) })} tone="bg-sage" />
          <Stat label={t.toCome} value={n(toCome)} hint={t.toComeHint} tone="bg-ochre" />
          <Stat
            label={t.lastArrival}
            value={last ? clock(last) : "—"}
            hint={last ? (arrivals.find((g) => g.checkedInAt === last)?.name ?? "") : t.nobodyYet}
            tone="bg-bronze-500"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      {data.sections && section === "ALL" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["MEN", "WOMEN"] as const).map((k) => {
            const x = data.sections![k];
            const p = x.expected ? Math.min(100, (x.arrived / x.expected) * 100) : 0;
            return (
              <div key={k} className="rounded-2xl border border-line bg-paper px-5 py-4 shadow-soft">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <span className="size-2 rounded-full" style={{ background: SECTION_COLOR[k] }} aria-hidden />
                    {SECTION_LABELS[k][locale]}
                  </span>
                  <span className="text-ink-soft tabular-nums">
                    {n(x.arrived)} <span className="text-ink-faint">{fmt(t.ofExpected, { n: n(x.expected) })}</span>
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist">
                  <div className="h-full rounded-full transition-[width] duration-700 ease-luxe" style={{ width: `${p}%`, background: SECTION_COLOR[k] }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t.timeline} description={t.timelineHint} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <ArrivalsChart guests={arrivals} timeZone={timeZone} locale={locale} empty={t.timelineEmpty} label={t.slot} />
            </div>
          </Card>

          <Card>
            <CardHeader title={t.guests} />
            <div className="space-y-3 border-b border-line px-4 py-4 sm:px-6">
              <label className="relative block">
                <span className="sr-only">{t.searchPh}</span>
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShown(PAGE);
                  }}
                  placeholder={t.searchPh}
                  className="h-11 w-full rounded-xl border border-line bg-ivory/60 pe-3 ps-10 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-bronze-400 focus:bg-paper"
                />
              </label>
              <div role="tablist" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => {
                      setFilter(f);
                      setShown(PAGE);
                    }}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                      filter === f ? "border-ink bg-ink text-ivory" : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {t.filters[f]}
                    <span className={cn("tabular-nums", filter === f ? "text-ivory/70" : "text-ink-faint")}>{n(counts[f])}</span>
                  </button>
                ))}
              </div>
            </div>
            {data.guests.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-ink-faint">{t.noGuests}</p>
                <Link href={stepHref(eventId, "guests")} className={buttonClasses("outline", "sm", "mt-4")}>
                  <Users className="size-3.5" />
                  {t.addGuests}
                </Link>
              </div>
            ) : list.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-ink-faint">{t.noMatch}</p>
            ) : (
              <ul className="max-h-[42rem] divide-y divide-line overflow-y-auto overscroll-contain" data-testid="checkin-guests">
                {list.slice(0, shown).map((g) => (
                  <GuestRow
                    key={g.id}
                    guest={g}
                    busy={busy === g.id}
                    clock={clock}
                    n={n}
                    locale={locale}
                    onCheckIn={() => quickCheckIn(g)}
                    onEdit={() => setEditing(g)}
                    onUndo={() => checkIn(g, { undo: true })}
                  />
                ))}
              </ul>
            )}
            {list.length > shown ? (
              <div className="border-t border-line px-6 py-3 text-center">
                <button type="button" onClick={() => setShown((s) => s + PAGE)} className="text-[13px] font-medium text-bronze-700 hover:text-bronze-900">
                  {fmt(t.more, { n: n(list.length - shown) })}
                </button>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <DoorStaffCard eventId={eventId} eventTitle={eventTitle} url={data.door.url} onUrl={(url) => setData((d) => ({ ...d, door: { ...d.door, url } }))} />

          <Card>
            <CardHeader
              title={t.feed}
              description={t.feedHint}
              action={
                totalScans ? (
                  <div className="text-end text-[11.5px] leading-snug text-ink-faint tabular-nums">
                    <div>{fmt(t.scans, { n: n(totalScans) })}</div>
                    {flagged ? <div className="text-rosewood">{fmt(t.flagged, { n: n(flagged) })}</div> : null}
                  </div>
                ) : null
              }
            />
            {data.scans.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] leading-relaxed text-ink-faint">{t.feedEmpty}</p>
            ) : (
              <ul className="max-h-[30rem] divide-y divide-line overflow-y-auto" data-testid="checkin-feed">
                <AnimatePresence initial={false}>
                  {data.scans.map((s) => (
                    <ScanRow key={s.id} scan={s} label={t.results[s.result]} unknown={t.unknownGuest} time={clock(s.at)} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Card>
        </div>
      </div>

      <CountDialog guest={editing} busy={busy !== null} onClose={() => setEditing(null)} onSave={(g, count) => checkIn(g, { count })} />
    </div>
  );
}

function mergeGuests(prev: CheckinGuest[], changed: CheckinGuest[]): CheckinGuest[] {
  if (!changed.length) return prev;
  const byId = new Map(prev.map((g) => [g.id, g]));
  let added = false;
  for (const g of changed) {
    if (!byId.has(g.id)) added = true;
    byId.set(g.id, g);
  }
  const out = [...byId.values()];
  return added ? out.sort((a, b) => a.name.localeCompare(b.name)) : out;
}

function LiveDot({ online, label }: { online: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em]", online ? "text-sage" : "text-ochre")}>
      <span className="relative flex size-2">
        {online ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage opacity-40" /> : null}
        <span className={cn("relative inline-flex size-2 rounded-full", online ? "bg-sage" : "bg-ochre")} />
      </span>
      {label}
    </span>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-mist)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--color-sage)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-ink tabular-nums" dir="ltr">
        {pct}%
      </span>
    </div>
  );
}

function Stat({ label, value, hint, tone, className }: { label: string; value: string; hint: string; tone: string; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-line bg-paper px-4 py-4 shadow-soft sm:px-5", className)}>
      <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-faint sm:text-[11px]">
        <span className={cn("size-1.5 shrink-0 rounded-full", tone)} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2.5 truncate font-display text-3xl leading-none text-ink tabular-nums sm:text-[2.2rem]">{value}</p>
      <p className="mt-2 truncate text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

/** People checked in per 15 minutes (30 or 60 over a long evening), in the event's time zone. */
function ArrivalsChart({ guests, timeZone, locale, empty, label }: { guests: CheckinGuest[]; timeZone: string; locale: Locale; empty: string; label: string }) {
  const bars = useMemo(() => {
    if (!guests.length) return [];
    // The evening's arrivals: a test check-in days earlier would stretch the chart to nothing.
    const all = guests.map((g) => ({ at: new Date(g.checkedInAt!).getTime(), people: g.checkedInCount ?? 1 }));
    const lastT = Math.max(...all.map((a) => a.at));
    const recent = all.filter((a) => a.at > lastT - WINDOW_MS);
    const first = Math.min(...recent.map((a) => a.at));
    const step = lastT - first > 8 * 3600_000 ? 60 * 60_000 : lastT - first > 4 * 3600_000 ? 30 * 60_000 : 15 * 60_000;
    const start = Math.floor(first / step) * step;
    const slots = Math.floor((lastT - start) / step) + 1;
    const out = Array.from({ length: Math.max(slots, 4) }, (_, i) => ({ at: start + i * step, people: 0 }));
    for (const a of recent) out[Math.floor((a.at - start) / step)].people += a.people;
    return out;
  }, [guests]);

  if (!bars.length) {
    return (
      <div className="relative flex h-40 items-end gap-1.5 rounded-xl bg-ivory/60 px-4 pb-4">
        {[18, 30, 46, 64, 52, 38, 24, 14].map((h, i) => (
          <div key={i} aria-hidden className="flex-1 rounded-t-md bg-mist/70" style={{ height: `${h}%` }} />
        ))}
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-[13px] text-ink-faint">{empty}</p>
      </div>
    );
  }
  const max = Math.max(...bars.map((b) => b.people), 1);
  const tick = Math.ceil(bars.length / 4);
  const time = (ms: number) => formatTime(new Date(ms), { locale, timeZone });
  return (
    <div>
      <div className="flex h-44 items-end gap-1 sm:gap-1.5" role="img" aria-label={bars.map((b) => fmt(label, { time: time(b.at), n: b.people })).join(", ")}>
        {bars.map((b) => (
          <div key={b.at} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-ivory opacity-0 transition group-hover:opacity-100">
              {fmt(label, { time: time(b.at), n: formatNumber(b.people, locale) })}
            </span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(b.people ? 4 : 1.5, (b.people / max) * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={cn("w-full rounded-t-md", b.people ? "bg-gradient-to-t from-bronze-600 to-bronze-400" : "bg-mist")}
            />
          </div>
        ))}
      </div>
      <div className="relative mt-2 h-6 border-t border-line">
        {bars.map((b, i) =>
          i % tick === 0 ? (
            <span
              key={b.at}
              className="absolute top-2 -translate-x-1/2 whitespace-nowrap text-[10.5px] text-ink-faint tabular-nums rtl:translate-x-1/2"
              style={{ insetInlineStart: `${((i + 0.5) / bars.length) * 100}%` }}
            >
              {time(b.at)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function GuestRow({
  guest: g,
  busy,
  clock,
  n,
  locale,
  onCheckIn,
  onEdit,
  onUndo,
}: {
  guest: CheckinGuest;
  busy: boolean;
  clock: (iso: string) => string;
  n: (v: number) => string;
  locale: Locale;
  onCheckIn: () => void;
  onEdit: () => void;
  onUndo: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.door.checkin;
  const status = dict.door.status;
  const meta = [g.groupName, g.section ? SECTION_LABELS[g.section][locale] : null, g.phoneTail ? `•••${g.phoneTail}` : null].filter(Boolean);
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-6" data-guest={g.id}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
          g.checkedInAt ? "bg-sage text-white" : "bg-sand text-ink-soft",
        )}
        aria-hidden
      >
        {g.checkedInAt ? <Check className="size-4" strokeWidth={2.5} /> : (g.name.trim()[0] ?? "?").toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{g.name}</p>
        <p className="mt-0.5 truncate text-[12px] text-ink-faint">
          {g.checkedInAt ? (
            <span className="font-medium text-sage">
              {fmt(t.arrivedAt, { time: clock(g.checkedInAt) })} · <Users className="mb-0.5 inline size-3" /> {n(g.checkedInCount ?? 1)}
            </span>
          ) : g.revoked ? (
            <span className="font-medium text-rosewood">{t.revoked}</span>
          ) : g.rsvpStatus === "ACCEPTED" ? (
            <span className="text-ink-soft">{fmt(t.coming, { n: n(partySize(g)) })}</span>
          ) : (
            <span className={g.rsvpStatus === "DECLINED" ? "text-rosewood" : "text-ochre"}>{status[g.rsvpStatus]}</span>
          )}
          {meta.length ? <span dir="auto"> · {meta.join(" · ")}</span> : null}
        </p>
      </div>
      {g.checkedInAt ? (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onEdit} disabled={busy} className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-sand hover:text-ink disabled:opacity-50">
            {t.edit}
          </button>
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-ink-faint hover:bg-rosewood-soft hover:text-rosewood disabled:opacity-50"
          >
            <Undo2 className="size-3.5" />
            {t.undo}
          </button>
        </div>
      ) : (
        <Button variant={g.rsvpStatus === "ACCEPTED" ? "primary" : "outline"} size="sm" loading={busy} onClick={onCheckIn} icon={<UserCheck className="size-3.5" />}>
          {t.checkIn}
        </Button>
      )}
    </li>
  );
}

function ScanRow({ scan, label, unknown, time }: { scan: CheckinScan; label: string; unknown: string; time: string }) {
  const good = scan.result === "VALID";
  const warn = scan.result === "ALREADY_IN" || scan.result === "NOT_ACCEPTED";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 px-5 py-3"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          good ? "bg-sage-soft text-sage" : warn ? "bg-ochre-soft text-ochre" : "bg-rosewood-soft text-rosewood",
        )}
        aria-hidden
      >
        {good ? <Check className="size-4" strokeWidth={2.5} /> : warn ? <AlertTriangle className="size-4" /> : <ShieldX className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{scan.name ?? unknown}</p>
        <p className={cn("truncate text-[12px]", good ? "text-ink-faint" : warn ? "text-ochre" : "text-rosewood")}>{label}</p>
      </div>
      <span className="shrink-0 text-[11.5px] text-ink-faint tabular-nums">{time}</span>
    </motion.li>
  );
}

function CountDialog({ guest, busy, onClose, onSave }: { guest: CheckinGuest | null; busy: boolean; onClose: () => void; onSave: (g: CheckinGuest, count: number) => void }) {
  const { dict, locale } = useI18n();
  const t = dict.door.checkin;
  const [count, setCount] = useState(1);
  const [for_, setFor] = useState<string | null>(null);
  // Start from what was recorded (or expected) each time the dialog opens for a guest.
  if (guest && for_ !== guest.id) {
    setFor(guest.id);
    setCount(guest.checkedInCount ?? partySize(guest));
  }
  if (!guest && for_ !== null) setFor(null);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <Dialog
      open={guest !== null}
      onClose={() => !busy && onClose()}
      title={guest ? fmt(t.countTitle, { name: guest.name }) : ""}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {dict.common.actions.cancel}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => guest && onSave(guest, count)} data-testid="checkin-save">
            {fmt(guest?.checkedInAt ? t.saveChange : t.save, { n: n(count) })}
          </Button>
        </>
      }
    >
      {guest ? (
        <div className="text-center">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-faint">{t.countLabel}</p>
          <div className="mt-4 flex items-center justify-center gap-5">
            <button
              type="button"
              aria-label="−"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              disabled={count <= 1}
              className="flex size-12 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-sand disabled:opacity-40"
            >
              <Minus className="size-5" />
            </button>
            <span className="w-16 font-display text-5xl text-ink tabular-nums">{n(count)}</span>
            <button
              type="button"
              aria-label="+"
              onClick={() => setCount((c) => Math.min(50, c + 1))}
              className="flex size-12 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-sand"
            >
              <Plus className="size-5" />
            </button>
          </div>
          <p className="mt-4 text-[13px] text-ink-faint">
            {fmt(t.countHint, { allowed: n(guest.allowedCount), confirmed: guest.attendingCount === null ? "—" : n(guest.attendingCount) })}
          </p>
        </div>
      ) : null}
    </Dialog>
  );
}

/** The door link for staff, as a QR code to scan from another phone, with copy and WhatsApp. */
function DoorStaffCard({ eventId, eventTitle, url, onUrl }: { eventId: string; eventTitle: string; url: string | null; onUrl: (url: string | null) => void }) {
  const { dict } = useI18n();
  const t = dict.door.checkin;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const svg = useMemo(() => (url ? qrSvg({ text: url, size: 176, style: "rounded", fg: "#14110e", bg: "#ffffff" }) : null), [url]);

  async function create() {
    setBusy(true);
    try {
      const r = await api<{ url: string | null }>(`/api/events/${eventId}/door`, { method: "POST", body: { action: "create" } });
      onUrl(r.url);
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast(t.copied);
    } catch {
      window.prompt(t.copy, url);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title={t.staff} />
      {url && svg ? (
        <div className="px-6 pb-6 pt-5">
          <div className="flex justify-center">
            <div className="rounded-2xl border border-line bg-white p-2.5 shadow-soft" data-testid="door-qr" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">{t.staffBody}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "sm", "col-span-2")}>
              <ScanLine className="size-3.5" />
              {t.openScanner}
            </a>
            <Button variant="outline" size="sm" icon={<Copy className="size-3.5" />} onClick={copy}>
              {t.copy}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(fmt(dict.door.card.shareText, { event: eventTitle, url }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("outline", "sm")}
            >
              <MessageCircle className="size-3.5" />
              {t.share}
            </a>
          </div>
        </div>
      ) : (
        <div className="px-6 pb-6 pt-5">
          <p className="text-[13px] leading-relaxed text-ink-soft">{t.staffNone}</p>
          <Button variant="primary" size="sm" className="mt-4" loading={busy} onClick={create} icon={<ScanLine className="size-3.5" />}>
            {t.create}
          </Button>
        </div>
      )}
    </Card>
  );
}
