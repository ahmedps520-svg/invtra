"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Item = { id: string; kind: string; data: Record<string, string | number | null>; href: string; read: boolean; createdAt: string };

/** In-app notifications (order received, payment approved, files ready…), polled every minute. */
export function NotificationBell() {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.orders.notifications;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* offline: try again on the next tick */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(ids?: string[]) {
    await fetch("/api/notifications/read", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    }).catch(() => undefined);
    setItems((list) => list.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids ? Math.max(0, u - ids.filter((id) => items.find((n) => n.id === id && !n.read)).length) : 0));
  }

  const text = (n: Item) => {
    const t = (d.kinds as Record<string, string>)[n.kind];
    return t ? fmt(t, Object.fromEntries(Object.entries(n.data).map(([k, v]) => [k, String(v ?? "")]))) : n.kind;
  };
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `${d.label} (${unread})` : d.label}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink"
        data-testid="notification-bell"
      >
        <Bell className="size-[18px]" />
        {unread ? (
          <span className="absolute -end-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rosewood px-1 text-[10px] font-semibold leading-[18px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label={d.label}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -end-12 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-paper shadow-lift sm:end-0"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-medium text-ink">{d.label}</p>
              {unread ? (
                <button type="button" onClick={() => markRead()} className="text-[12px] font-medium text-bronze-700 hover:text-bronze-900">
                  {d.markAll}
                </button>
              ) : null}
            </div>
            {items.length ? (
              <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => {
                        if (!n.read) markRead([n.id]);
                        setOpen(false);
                      }}
                      className={cn("flex gap-3 px-4 py-3 text-sm transition hover:bg-sand/60", n.read ? "text-ink-soft" : "text-ink")}
                    >
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-bronze-500")} aria-hidden />
                      <span className="min-w-0">
                        <span className="block leading-snug">{text(n)}</span>
                        <span className="mt-0.5 block text-[12px] text-ink-faint">{when(n.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-ink-faint">{d.empty}</p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
