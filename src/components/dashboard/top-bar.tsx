"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CreditCard, LogOut, Settings, Shield, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/provider";
import { Spinner } from "@/components/ui/spinner";
import { cn, monogramOf } from "@/lib/utils";

type NavItem = { href: string; label: string; match: (p: string) => boolean; icon?: React.ReactNode; external?: boolean };

export function DashboardTopBar({
  user,
  showSimulator,
}: {
  user: { name: string; email: string; role: string };
  showSimulator: boolean;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.nav;
  const pathname = usePathname() ?? "";

  const items: NavItem[] = [
    { href: "/dashboard", label: d.events, match: (p) => p === "/dashboard" || p.startsWith("/dashboard/events") },
    { href: "/dashboard/billing", label: d.billing, match: (p) => p.startsWith("/dashboard/billing") },
    { href: "/dashboard/settings", label: d.settings, match: (p) => p.startsWith("/dashboard/settings") },
  ];
  if (user.role === "ADMIN") items.push({ href: "/admin", label: d.admin, match: () => false, icon: <Shield className="size-3.5" /> });
  if (showSimulator)
    items.push({ href: "/dev/whatsapp", label: d.simulator, match: () => false, icon: <Smartphone className="size-3.5" /> });

  const link = (it: NavItem, mobile = false) => {
    const active = it.match(pathname);
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-wide transition-colors duration-300",
          active ? "text-ink" : "text-ink-faint hover:text-ink",
          mobile && active && "bg-paper shadow-soft",
        )}
      >
        {it.icon}
        {it.label}
        {active && !mobile ? (
          <motion.span layoutId="dash-nav" className="absolute inset-x-3.5 -bottom-[17px] h-px bg-bronze-600" transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
        ) : null}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="shrink-0 rounded-md" aria-label="INVTRA">
          <Logo markClassName="h-8" />
        </Link>
        <span className="hidden h-6 w-px bg-line md:block" aria-hidden />
        <nav aria-label={d.main} className="hidden items-center gap-1 md:flex">
          {items.map((it) => link(it))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
          <LanguageSwitcher locale={locale} compact />
          <UserMenu user={user} />
        </div>
      </div>
      <nav aria-label={d.main} className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2.5 md:hidden">
        {items.map((it) => link(it, true))}
      </nav>
    </header>
  );
}

function UserMenu({ user }: { user: { name: string; email: string } }) {
  const { dict } = useI18n();
  const d = dict.dashboard.nav;
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.replace("/");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={d.menu}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-full border border-bronze-200 bg-bronze-50 font-display text-[15px] text-bronze-700 transition hover:border-bronze-400"
      >
        <span dir="ltr">{monogramOf(user.name).replace("&", "") || "·"}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute end-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-paper shadow-lift"
          >
            <div className="border-b border-line px-4 py-3.5">
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
              <p className="truncate text-[13px] text-ink-faint" dir="ltr">
                {user.email}
              </p>
            </div>
            <div className="py-1.5">
              <MenuLink href="/dashboard/settings" icon={<Settings />} onClick={() => setOpen(false)}>
                {d.settings}
              </MenuLink>
              <MenuLink href="/dashboard/billing" icon={<CreditCard />} onClick={() => setOpen(false)}>
                {d.billing}
              </MenuLink>
            </div>
            <div className="border-t border-line py-1.5">
              <button
                role="menuitem"
                type="button"
                onClick={signOut}
                disabled={leaving}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-start text-sm text-ink-soft transition hover:bg-sand hover:text-ink disabled:opacity-60"
              >
                {leaving ? <Spinner className="size-4" /> : <LogOut className="size-4 rtl:rotate-180" />}
                {leaving ? d.signingOut : d.signOut}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-soft transition hover:bg-sand hover:text-ink [&>svg]:size-4"
    >
      {icon}
      {children}
    </Link>
  );
}
