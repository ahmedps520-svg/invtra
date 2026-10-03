"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarHeart,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  Palette,
  ScanLine,
  ScrollText,
  Sparkles,
  UserSearch,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: ReactNode; badge?: number };

export type AdminBadges = { errors: number; failedJobs: number; pendingOrders: number; pendingTemplates: number };

function sections(b: AdminBadges): { label?: string; items: NavItem[] }[] {
  return [
    { items: [{ href: "/admin", label: "Overview", icon: <LayoutDashboard />, badge: b.failedJobs || undefined }] },
    {
      label: "Customers",
      items: [
        { href: "/admin/customers", label: "Customers", icon: <Users /> },
        { href: "/admin/events", label: "Events", icon: <CalendarHeart /> },
        { href: "/admin/guests", label: "Guests & invitations", icon: <UserSearch /> },
      ],
    },
    {
      label: "WhatsApp",
      items: [
        { href: "/admin/messages", label: "Messages", icon: <MessageSquare /> },
        { href: "/admin/templates", label: "Templates", icon: <FileText />, badge: b.pendingTemplates || undefined },
      ],
    },
    {
      label: "Business",
      items: [
        { href: "/admin/custom", label: "Custom events", icon: <Sparkles /> },
        { href: "/admin/payments", label: "Payments", icon: <CreditCard />, badge: b.pendingOrders || undefined },
        { href: "/admin/themes", label: "Themes", icon: <Palette /> },
      ],
    },
    {
      label: "Monitoring",
      items: [
        { href: "/admin/scans", label: "QR scans & views", icon: <ScanLine /> },
        { href: "/admin/errors", label: "System errors", icon: <AlertTriangle />, badge: b.errors || undefined },
        { href: "/admin/audit", label: "Audit log", icon: <ScrollText /> },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Nav({ badges, onNavigate }: { badges: AdminBadges; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-6">
      {sections(badges).map((s, i) => (
        <div key={i}>
          {s.label ? <p className="mb-2 px-3 text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-faint">{s.label}</p> : null}
          <ul className="space-y-0.5">
            {s.items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition-colors duration-200",
                      active ? "bg-paper text-ink shadow-soft ring-1 ring-line" : "text-ink-soft hover:bg-paper/70 hover:text-ink",
                    )}
                  >
                    <span className={cn("size-4 shrink-0 [&>svg]:size-4", active ? "text-bronze-600" : "text-ink-faint group-hover:text-bronze-600")}>
                      {it.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.badge ? (
                      <span className="rounded-full bg-bronze-100 px-1.5 text-[11px] font-medium tabular-nums text-bronze-800">{it.badge > 99 ? "99+" : it.badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Footer({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <Link href="/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-soft transition hover:bg-paper/70 hover:text-ink">
        <ArrowLeft className="size-4 text-ink-faint rtl:rotate-180" aria-hidden="true" />
        Back to the app
      </Link>
      <div className="flex items-center gap-3 px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-paper font-display text-sm text-bronze-700">
          {user.name.trim().charAt(0).toUpperCase() || "A"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
          <p className="truncate text-[11.5px] text-ink-faint">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="rounded-full p-2 text-ink-faint transition hover:bg-sand hover:text-ink disabled:opacity-50"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </div>
      <p className="px-3 text-[11px] text-ink-faint">All times are UTC.</p>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-3" aria-label="INVTRA Admin — overview">
      <Logo markClassName="h-8" />
      <span className="rounded-full border border-bronze-200 bg-bronze-50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.2em] text-bronze-700">Admin</span>
    </Link>
  );
}

/** Staff console chrome: fixed sidebar on desktop, slide-over drawer on mobile. */
export function AdminShell({ user, badges, children }: { user: { name: string; email: string }; badges: AdminBadges; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the drawer whenever the route changes (incl. back/forward).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div dir="ltr" lang="en" className="min-h-dvh bg-ivory">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-line bg-sand/40 px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="scrollbar-none mt-8 min-h-0 flex-1 overflow-y-auto">
          <Nav badges={badges} />
        </div>
        <Footer user={user} />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-ivory/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="rounded-full p-2 text-ink-soft transition hover:bg-sand hover:text-ink"
        >
          <MenuIcon className="size-5" />
        </button>
      </header>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <motion.div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col bg-ivory px-4 py-5 shadow-lift"
            >
              <div className="flex items-center justify-between px-2">
                <Brand />
                <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-full p-2 text-ink-faint hover:bg-sand hover:text-ink">
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
                <Nav badges={badges} onNavigate={() => setOpen(false)} />
              </div>
              <Footer user={user} />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <main className="lg:ps-64">
        <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
      </main>
    </div>
  );
}
