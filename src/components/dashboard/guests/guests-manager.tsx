"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Info,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Badge, GUEST_STATUS_TONE } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Checkbox } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { errorMessage, plural } from "../i18n";
import { stepHref } from "../steps";
import { GuestDetailsDialog } from "./guest-details-dialog";
import { GuestFormDialog } from "./guest-form-dialog";
import { ImportDialog } from "./import-dialog";
import { failureKey, GUEST_STATUSES, type GuestList, type GuestRow, type GuestStatusKey } from "./types";

type Sort = "created" | "name" | "status" | "activity";
const PAGE_SIZE = 50;

export function GuestsManager({
  eventId,
  eventLanguage,
  defaultCountry,
  initial,
  initialStatus,
  serverNow,
}: {
  eventId: string;
  eventLanguage: "EN" | "AR" | "BILINGUAL";
  defaultCountry: string;
  initial: GuestList;
  initialStatus: GuestStatusKey | null;
  serverNow: number;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.guests;
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState<GuestList>(initial);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<GuestStatusKey | null>(initialStatus);
  const [sort, setSort] = useState<Sort>("created");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(serverNow);

  const [form, setForm] = useState<{ open: boolean; guest: GuestRow | null; key: number }>({ open: false, guest: null, key: 0 });
  const [importState, setImportState] = useState({ open: false, key: 0 });
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const [attend, setAttend] = useState<{ guest: GuestRow; count: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const firstLoad = useRef(true);
  const dialogOpen = form.open || importState.open || Boolean(detailsId) || Boolean(toDelete) || Boolean(attend);

  const fetchList = useCallback(
    async (silent: boolean, signal?: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (!silent) setLoading(true);
      try {
        const res = await api<GuestList>(`/api/events/${eventId}/guests?${params}`, { signal });
        if (signal?.aborted) return;
        setData(res);
        setNow(Date.now());
        // Drop selections that are no longer visible.
        setSelected((sel) => {
          const visible = new Set(res.guests.map((g) => g.id));
          const next = new Set([...sel].filter((x) => visible.has(x)));
          return next.size === sel.size ? sel : next;
        });
      } catch (e) {
        if (!silent && !signal?.aborted) toast(errorMessage(e, dict), "error");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [eventId, page, sort, query, status, toast, dict],
  );

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reload when the filters change (the first render already has server data).
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => fetchList(false, ctrl.signal), 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [fetchList]);

  // Keep the status filter in the URL so links like ?status=FAILED work and survive reloads.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (status) url.searchParams.set("status", status);
    else url.searchParams.delete("status");
    window.history.replaceState(window.history.state, "", url);
  }, [status]);

  // Live statuses while the page is open.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !dialogOpen) fetchList(true);
    }, 8000);
    return () => clearInterval(t);
  }, [fetchList, dialogOpen]);

  const refresh = useCallback(() => {
    fetchList(true);
    router.refresh();
  }, [fetchList, router]);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast(d.link.copied);
  }

  async function resend(ids: string[]) {
    setBusy("resend");
    try {
      const r = await api<{ requested: number; redelivered: number; skipped: number }>(
        ids.length === 1 ? `/api/events/${eventId}/guests/${ids[0]}/resend` : `/api/events/${eventId}/guests/resend`,
        { method: "POST", body: ids.length === 1 ? {} : { ids } },
      );
      if (r.requested + r.redelivered === 0) toast(d.resendNothing, "info");
      else
        toast(
          fmt(d.resendResult, {
            requested: formatNumber(r.requested, locale),
            redelivered: formatNumber(r.redelivered, locale),
            skipped: formatNumber(r.skipped, locale),
          }),
        );
      setSelected(new Set());
      refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(ids: string[]) {
    setBusy("delete");
    try {
      if (ids.length === 1) await api(`/api/events/${eventId}/guests/${ids[0]}`, { method: "DELETE" });
      else await api(`/api/events/${eventId}/guests/bulk-delete`, { method: "POST", body: { ids } });
      toast(plural(locale, d.deleteConfirm.done, ids.length));
      setSelected(new Set());
      setToDelete(null);
      if (detailsId && ids.includes(detailsId)) setDetailsId(null);
      refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  async function mark(g: GuestRow, response: "ACCEPTED" | "DECLINED" | "PENDING", attendingCount?: number) {
    setBusy("mark");
    try {
      await api(`/api/events/${eventId}/guests/${g.id}/rsvp`, { method: "POST", body: { response, ...(attendingCount ? { attendingCount } : {}) } });
      toast(`${fmt(d.marked[response], { name: g.name })}. ${d.markNote}`);
      setAttend(null);
      refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  const openAdd = () => setForm((f) => ({ open: true, guest: null, key: f.key + 1 }));
  const openEdit = (g: GuestRow) => setForm((f) => ({ open: true, guest: g, key: f.key + 1 }));
  const openImport = () => setImportState((s) => ({ open: true, key: s.key + 1 }));

  const menuFor = (g: GuestRow): (MenuItem | "divider")[] => {
    const items: (MenuItem | "divider")[] = [
      { label: d.menu.details, icon: <Eye />, onSelect: () => setDetailsId(g.id) },
      { label: d.menu.edit, icon: <Pencil />, onSelect: () => openEdit(g) },
      { label: d.menu.resend, icon: <RefreshCw />, onSelect: () => resend([g.id]), disabled: g.rsvpStatus === "DECLINED" },
    ];
    if (g.invitationUrl) items.push({ label: d.menu.copyLink, icon: <Copy />, onSelect: () => copy(g.invitationUrl!) });
    items.push("divider");
    if (g.rsvpStatus !== "ACCEPTED")
      items.push({
        label: d.menu.markAccepted,
        icon: <CheckCircle2 />,
        onSelect: () => (g.allowedCount > 1 ? setAttend({ guest: g, count: g.allowedCount }) : mark(g, "ACCEPTED")),
      });
    if (g.rsvpStatus !== "DECLINED") items.push({ label: d.menu.markDeclined, icon: <XCircle />, onSelect: () => mark(g, "DECLINED") });
    if (g.rsvpStatus !== "PENDING") items.push({ label: d.menu.markPending, icon: <CircleDashed />, onSelect: () => mark(g, "PENDING") });
    items.push("divider", { label: d.menu.delete, icon: <Trash2 />, danger: true, onSelect: () => setToDelete([g.id]) });
    return items;
  };

  const totalAll = Object.values(data.counts).reduce((s, n) => s + (n ?? 0), 0);
  const filtered = Boolean(query || status);
  const pageIds = data.guests.map((g) => g.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const from = data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = Math.min(data.total, data.page * data.pageSize);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const rel = (iso: string) => formatRelative(new Date(iso), locale, new Date(now));

  const statusCell = (g: GuestRow) => (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={GUEST_STATUS_TONE[g.status]} dot>
        {dict.common.guestStatus[g.status]}
      </Badge>
      {g.status === "FAILED" ? (
        <span className="text-xs text-rosewood">{dict.dashboard.failures[failureKey(g.deliveryError)].short}</span>
      ) : g.rsvpStatus === "ACCEPTED" && g.attendingCount && g.allowedCount > 1 ? (
        <span className="text-xs text-ink-faint">{fmt(d.attending, { n: g.attendingCount, max: g.allowedCount })}</span>
      ) : null}
    </div>
  );

  const linkCell = (g: GuestRow) =>
    g.invitationUrl && (g.requestSentAt || g.invitationSentAt) ? (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => copy(g.invitationUrl!)}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-bronze-700 transition hover:bg-bronze-50"
        >
          <Copy className="size-3.5" />
          {d.link.copy}
        </button>
        <a
          href={g.invitationUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${d.link.open} — ${g.name}`}
          title={d.link.open}
          className="rounded-full p-1.5 text-ink-faint transition hover:bg-sand hover:text-ink"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    ) : (
      <span className="text-[13px] text-ink-faint">{d.link.notYet}</span>
    );

  const guestCell = (g: GuestRow) => (
    <div className="min-w-0">
      <button type="button" onClick={() => setDetailsId(g.id)} className="max-w-full truncate text-start font-medium text-ink hover:text-bronze-700">
        {g.name}
      </button>
      <p className="mt-0.5 truncate text-xs text-ink-faint">
        {g.groupName ? <span>{g.groupName} · </span> : null}
        {plural(locale, d.admits, g.allowedCount)}
      </p>
    </div>
  );

  return (
    <div className="animate-fade-up pb-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">{d.eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{d.title}</h2>
          <p className="mt-2 text-[15px] text-ink-soft">{d.description}</p>
        </div>
        {totalAll > 0 ? (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <a href={`/api/events/${eventId}/guests/export`} className={buttonClasses("ghost", "md", "order-2 sm:order-none")} download>
              <Download className="size-4" />
              {d.export}
            </a>
            <Button variant="outline" icon={<FileSpreadsheet className="size-4" />} onClick={openImport} className="order-3 sm:order-none">
              {d.import}
            </Button>
            <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={openAdd} className="order-1 col-span-2 sm:order-none">
              {d.add}
            </Button>
          </div>
        ) : null}
      </div>

      {totalAll === 0 ? (
        <div className="mt-10 overflow-hidden rounded-3xl border border-line bg-paper shadow-soft">
          <div className="paper-grain flex flex-col items-center px-6 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-line bg-sand text-bronze-600">
              <Users className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl text-ink">{d.empty.title}</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-faint">{d.empty.body}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="lg" icon={<UserPlus className="size-4" />} onClick={openAdd}>
                {d.add}
              </Button>
              <Button variant="outline" size="lg" icon={<FileSpreadsheet className="size-4" />} onClick={openImport}>
                {d.import}
              </Button>
            </div>
          </div>
          <Rules />
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={d.searchPh}
                aria-label={d.searchPh}
                className="ps-10"
              />
            </div>
            <div className="sm:w-60">
              <label htmlFor="g-sort" className="sr-only">
                {d.sort.label}
              </label>
              <Select
                id="g-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);
                  setPage(1);
                }}
              >
                {(["created", "name", "status", "activity"] as Sort[]).map((s) => (
                  <option key={s} value={s}>
                    {d.sort.label}: {d.sort[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={dict.common.actions.filter}>
            <Chip active={!status} onClick={() => (setStatus(null), setPage(1))} label={d.all} count={totalAll} />
            {GUEST_STATUSES.map((s) => (
              <Chip
                key={s}
                active={status === s}
                onClick={() => (setStatus(status === s ? null : s), setPage(1))}
                label={dict.common.guestStatus[s]}
                count={data.counts[s] ?? 0}
                tone={GUEST_STATUS_TONE[s]}
              />
            ))}
          </div>

          <div className={cn("mt-5 overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition-opacity duration-300", loading && "opacity-60")} aria-busy={loading}>
            {data.guests.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <p className="font-display text-2xl text-ink">{d.noResults.title}</p>
                <p className="mt-1 text-sm text-ink-faint">{d.noResults.body}</p>
                {filtered ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5"
                    onClick={() => {
                      setQ("");
                      setQuery("");
                      setStatus(null);
                      setPage(1);
                    }}
                  >
                    {d.noResults.clear}
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <table className="hidden w-full table-fixed text-sm md:table">
                  <thead>
                    <tr className="border-b border-line bg-ivory/70 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                      <th className="w-12 py-3 ps-5 text-start font-medium">
                        <Checkbox
                          checked={allSelected}
                          ariaLabel={d.columns.selectAll}
                          onChange={(on) => setSelected(on ? new Set([...selected, ...pageIds]) : new Set([...selected].filter((x) => !pageIds.includes(x))))}
                        />
                      </th>
                      <th className="w-[28%] px-3 py-3 text-start font-medium">{d.columns.guest}</th>
                      <th className="w-[18%] px-3 py-3 text-start font-medium">{d.columns.phone}</th>
                      <th className="w-[17%] px-3 py-3 text-start font-medium">{d.columns.status}</th>
                      <th className="w-[17%] px-3 py-3 text-start font-medium">{d.columns.invitation}</th>
                      <th className="px-3 py-3 text-start font-medium">{d.columns.activity}</th>
                      <th className="w-14 py-3 pe-4">
                        <span className="sr-only">{dict.common.actions.edit}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.guests.map((g) => (
                      <tr key={g.id} className={cn("border-t border-line transition-colors first:border-t-0 hover:bg-ivory/70", selected.has(g.id) && "bg-bronze-50/60")}>
                        <td className="py-3.5 ps-5 align-middle">
                          <Checkbox checked={selected.has(g.id)} ariaLabel={fmt(d.columns.select, { name: g.name })} onChange={(on) => toggle(g.id, on)} />
                        </td>
                        <td className="px-3 py-3.5 align-middle">{guestCell(g)}</td>
                        <td className="px-3 py-3.5 align-middle">
                          <span dir="ltr" className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
                            {formatPhone(g.phone)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 align-middle">{statusCell(g)}</td>
                        <td className="px-3 py-3.5 align-middle">{linkCell(g)}</td>
                        <td className="px-3 py-3.5 align-middle text-[13px] text-ink-faint">{rel(g.lastActivityAt)}</td>
                        <td className="py-3.5 pe-4 text-end align-middle">
                          <Menu trigger={<MoreHorizontal className="size-4" />} items={menuFor(g)} label={fmt(d.columns.actions, { name: g.name })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="flex items-center gap-3 border-b border-line bg-ivory/70 px-4 py-2.5 md:hidden">
                  <Checkbox
                    checked={allSelected}
                    ariaLabel={d.columns.selectAll}
                    label={<span className="text-xs text-ink-faint">{d.columns.selectAll}</span>}
                    onChange={(on) => setSelected(on ? new Set([...selected, ...pageIds]) : new Set([...selected].filter((x) => !pageIds.includes(x))))}
                  />
                </div>
                <ul className="divide-y divide-line md:hidden">
                  {data.guests.map((g) => (
                    <li key={g.id} className={cn("flex gap-3 px-4 py-4", selected.has(g.id) && "bg-bronze-50/60")}>
                      <div className="pt-0.5">
                        <Checkbox checked={selected.has(g.id)} ariaLabel={fmt(d.columns.select, { name: g.name })} onChange={(on) => toggle(g.id, on)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          {guestCell(g)}
                          <div className="-me-1.5 -mt-1 shrink-0">
                            <Menu trigger={<MoreHorizontal className="size-4" />} items={menuFor(g)} label={fmt(d.columns.actions, { name: g.name })} />
                          </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                          {statusCell(g)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-ink-faint">
                          <span dir="ltr" className="tabular-nums">
                            {formatPhone(g.phone)}
                          </span>
                          <span>{rel(g.lastActivityAt)}</span>
                        </div>
                        {g.invitationUrl && (g.requestSentAt || g.invitationSentAt) ? <div className="-ms-2 mt-1.5">{linkCell(g)}</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {data.total > data.pageSize ? (
              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-faint">
                <span className="tabular-nums">
                  {fmt(d.pagination.range, { from: formatNumber(from, locale), to: formatNumber(to, locale), total: formatNumber(data.total, locale) })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label={d.pagination.prev}
                    className="rounded-full p-2 transition hover:bg-sand hover:text-ink disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4 rtl:rotate-180" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label={d.pagination.next}
                    className="rounded-full p-2 transition hover:bg-sand hover:text-ink disabled:opacity-30"
                  >
                    <ChevronRight className="size-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="overflow-hidden rounded-2xl border border-line bg-paper/60">
              <Rules />
            </div>
            <Link href={stepHref(eventId, "review")} className={buttonClasses("primary", "lg", "justify-self-end")}>
              {d.continue}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </>
      )}

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.size > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
          >
            <div className="flex items-center gap-1 rounded-full border border-ink/10 bg-ink py-1.5 pe-1.5 ps-5 text-sm text-ivory shadow-lift">
              <span className="me-2 whitespace-nowrap font-medium tabular-nums">{plural(locale, d.bulk.selected, selected.size)}</span>
              <button
                type="button"
                disabled={busy === "resend"}
                onClick={() => resend([...selected])}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3.5", busy === "resend" && "animate-spin")} />
                {d.bulk.resend}
              </button>
              <button
                type="button"
                onClick={() => setToDelete([...selected])}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#f0b8aa] transition hover:bg-white/10"
              >
                <Trash2 className="size-3.5" />
                {d.bulk.delete}
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                aria-label={d.bulk.clear}
                title={d.bulk.clear}
                className="rounded-full p-2 text-ivory/70 transition hover:bg-white/10 hover:text-ivory"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <GuestFormDialog
        key={`form-${form.key}`}
        open={form.open}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        eventId={eventId}
        eventLanguage={eventLanguage}
        guest={form.guest}
        onSaved={refresh}
      />
      <ImportDialog
        key={`import-${importState.key}`}
        open={importState.open}
        onClose={() => setImportState((s) => ({ ...s, open: false }))}
        eventId={eventId}
        defaultCountry={defaultCountry}
        onImported={refresh}
      />
      <GuestDetailsDialog
        open={Boolean(detailsId)}
        onClose={() => setDetailsId(null)}
        eventId={eventId}
        guestId={detailsId}
        onCopy={copy}
        onEdit={(g) => {
          setDetailsId(null);
          openEdit(g);
        }}
        onResend={(g) => resend([g.id])}
      />

      <Dialog
        open={Boolean(toDelete)}
        onClose={() => busy !== "delete" && setToDelete(null)}
        title={toDelete ? plural(locale, d.deleteConfirm.title, toDelete.length) : ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)} disabled={busy === "delete"}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="danger" loading={busy === "delete"} onClick={() => toDelete && remove(toDelete)}>
              {d.deleteConfirm.confirm}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{d.deleteConfirm.body}</p>
      </Dialog>

      <Dialog
        open={Boolean(attend)}
        onClose={() => busy !== "mark" && setAttend(null)}
        title={d.attendDialog.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAttend(null)}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="primary" loading={busy === "mark"} onClick={() => attend && mark(attend.guest, "ACCEPTED", attend.count)}>
              {d.attendDialog.confirm}
            </Button>
          </>
        }
      >
        {attend ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{fmt(d.attendDialog.body, { name: attend.guest.name, n: attend.guest.allowedCount })}</p>
            <div>
              <label htmlFor="attend-count" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
                {d.attendDialog.label}
              </label>
              <Select id="attend-count" value={String(attend.count)} onChange={(e) => setAttend({ ...attend, count: Number(e.target.value) })}>
                {Array.from({ length: attend.guest.allowedCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {formatNumber(n, locale)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Chip({ active, onClick, label, count, tone }: { active: boolean; onClick: () => void; label: string; count: number; tone?: string }) {
  const dots: Record<string, string> = { neutral: "bg-ink-faint", slate: "bg-slate", sage: "bg-sage", rosewood: "bg-rosewood", bronze: "bg-bronze-500", ochre: "bg-ochre" };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-300 ease-luxe",
        active ? "border-ink bg-ink text-ivory" : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink",
        !active && count === 0 && "opacity-55",
      )}
    >
      {tone ? <span className={cn("size-1.5 rounded-full", active ? "bg-ivory" : dots[tone])} /> : null}
      {label}
      <span className={cn("tabular-nums", active ? "text-ivory/70" : "text-ink-faint")}>{count}</span>
    </button>
  );
}

function Rules() {
  const { dict } = useI18n();
  const r = dict.dashboard.guests.rules;
  return (
    <div className="border-t border-line bg-ivory/60 px-6 py-5 first:border-t-0">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <Info className="size-4 text-bronze-600" />
        {r.title}
      </p>
      <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-ink-soft">
        {[r.duplicates, r.deleting, r.resend].map((t) => (
          <li key={t} className="flex gap-2.5">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-bronze-400" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
