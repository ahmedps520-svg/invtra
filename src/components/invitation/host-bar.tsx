"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ScanLine } from "lucide-react";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { useInvitation } from "./primitives";

/**
 * Shown when the event's host (signed in) opens a guest's invitation — typically by
 * scanning the guest's QR at the door. Lets the host verify and check the guest in.
 */
export function HostBar({ status, highlight }: { status: "PENDING" | "ACCEPTED" | "DECLINED"; highlight?: boolean }) {
  const { vm, d } = useInvitation();
  const guest = vm.guest!;
  const [checkedInAt, setCheckedInAt] = useState<string | null>(guest.checkedInAt);
  const [count, setCount] = useState<number>(guest.checkedInCount ?? guest.attendingCount ?? guest.allowedCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = guest.attendingCount ?? guest.allowedCount;

  async function submit(undo: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/i/${vm.token}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(undo ? { undo: true } : { count }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { checkedInAt: string | null; checkedInCount: number | null };
      setCheckedInAt(body.checkedInAt);
    } catch {
      setError(d.rsvp.error);
    } finally {
      setBusy(false);
    }
  }

  const time = checkedInAt
    ? new Intl.DateTimeFormat(vm.lang === "ar" ? "ar-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(checkedInAt))
    : null;

  return (
    <div className={cn("sticky top-0 z-50 border-b border-white/10 bg-[#1e1a16]/95 text-[#faf7f2] backdrop-blur", highlight && "shadow-2xl")}>
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#c9b092]">{d.host.label}</span>
          <Link href="/dashboard" className="text-xs text-white/50 hover:text-white">
            {d.host.dashboard}
          </Link>
        </div>
        <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-tight">{guest.name}</p>
            <p className="mt-0.5 text-xs text-white/60">
              {guest.allowedCount > 1 ? fmt(d.admits, { n: limit }) : d.admitsOne}
              <span className="mx-1.5 opacity-50">·</span>
              {d.host.statuses[status]}
              {vm.section ? (
                <>
                  <span className="mx-1.5 opacity-50">·</span>
                  {vm.lang === "ar" ? vm.section.label.ar : vm.section.label.en}
                </>
              ) : null}
              <span className="mx-1.5 opacity-50">·</span>
              {d.host.scans}: {guest.scanCount}
            </p>
          </div>
          {checkedInAt ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-[#b9d3b2]">
                <CheckCircle2 className="size-4" />
                {fmt(d.host.checkedIn, { time: time ?? "" })}
              </span>
              <button type="button" disabled={busy} onClick={() => submit(true)} className="text-xs text-white/60 underline underline-offset-4 hover:text-white">
                {d.host.undo}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {limit > 1 ? (
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <span className="sr-only">{d.host.checkInCount}</span>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    aria-label={d.host.checkInCount}
                    className="h-10 rounded-full border border-white/20 bg-transparent px-3 text-sm text-white"
                  >
                    {Array.from({ length: Math.max(limit, count) + 2 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n} className="text-black">
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(false)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#c9b092] px-5 text-sm font-medium text-[#1e1a16] transition hover:bg-[#e0cfb9] disabled:opacity-60 sm:flex-none"
              >
                <ScanLine className="size-4" />
                {d.host.checkIn}
              </button>
            </div>
          )}
        </div>
        {status !== "ACCEPTED" ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-[#a2513f]/25 px-3 py-2 text-[13px] text-[#f5cfc5]">
            <AlertTriangle className="size-4 shrink-0" />
            {status === "DECLINED" ? d.host.declinedWarning : d.host.pendingWarning}
          </p>
        ) : null}
        {count > limit ? <p className="mt-2 text-xs text-[#f5cfc5]">{fmt(d.host.over, { n: count - limit })}</p> : null}
        {error ? <p className="mt-2 text-xs text-[#f5cfc5]">{error}</p> : null}
      </div>
    </div>
  );
}
