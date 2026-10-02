"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/provider";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { localePath, splitLocale } from "@/lib/i18n/routing";

/** Sticky, translucent marketing navigation with an animated mobile sheet. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const { dict, locale } = useI18n();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const nav = dict.common.nav;
  const links = [
    { href: "/#how-it-works", label: nav.howItWorks },
    { href: "/invitations", label: nav.occasions },
    { href: "/designs", label: nav.designs },
    { href: "/pricing", label: nav.pricing },
    { href: "/#faq", label: nav.faq },
  ].map((l) => ({ ...l, path: l.href, href: localePath(locale, l.href) }));
  const current = splitLocale(pathname ?? "/").path;
  const ctaHref = signedIn ? "/dashboard/events/new" : "/signup";
  const accountHref = signedIn ? "/dashboard" : "/login";
  const accountLabel = signedIn ? nav.dashboard : dict.common.actions.signIn;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-500 ease-luxe",
          scrolled || open
            ? "border-line/80 bg-ivory/85 shadow-[0_1px_0_rgb(30_26_22/0.02),0_12px_32px_-24px_rgb(30_26_22/0.25)] backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-ivory/60 backdrop-blur-md",
        )}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href={localePath(locale, "/")} onClick={close} aria-label={dict.marketing.nav.home} className="-m-1 shrink-0 rounded-lg p-1">
            <Logo markClassName="h-8 sm:h-9" />
          </Link>

          <nav aria-label={dict.marketing.nav.primary} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {links.map((l) => {
                const active = !l.path.includes("#") && (current === l.path || current.startsWith(`${l.path}/`));
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative rounded-full px-4 py-2 text-[14px] tracking-wide transition-colors duration-300",
                        active ? "text-ink" : "text-ink-soft hover:text-ink",
                      )}
                    >
                      {l.label}
                      {active ? <span className="absolute inset-x-4 -bottom-0.5 h-px bg-bronze-500" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher locale={locale} className="hidden sm:inline-flex" />
            <Link
              href={accountHref}
              className="hidden rounded-full px-4 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink lg:inline-flex"
            >
              {accountLabel}
            </Link>
            <Link href={ctaHref} className={buttonClasses("primary", "md", "hidden md:inline-flex")}>
              {nav.createInvitation}
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? dict.marketing.nav.closeMenu : dict.marketing.nav.openMenu}
              className="-me-2 inline-flex size-11 items-center justify-center rounded-full text-ink transition hover:bg-sand lg:hidden"
            >
              {open ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            key="sheet"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 top-[72px] z-40 overflow-y-auto border-t border-line/70 bg-ivory lg:hidden"
          >
            <nav
              aria-label={dict.marketing.nav.primary}
              className="mx-auto flex min-h-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-8"
            >
              <ul className="divide-y divide-line/70">
                {links.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Link
                      href={l.href}
                      onClick={close}
                      className="group flex items-center justify-between py-5 font-display text-[1.9rem] leading-none text-ink"
                    >
                      {l.label}
                      <ArrowRight
                        className="size-5 text-bronze-500 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                        strokeWidth={1.25}
                      />
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <motion.div
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-auto flex flex-col gap-3 pt-10"
              >
                <Link href={ctaHref} onClick={close} className={buttonClasses("primary", "lg", "w-full")}>
                  {nav.createInvitation}
                </Link>
                <Link href={accountHref} onClick={close} className={buttonClasses("outline", "lg", "w-full")}>
                  {accountLabel}
                </Link>
                <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-5">
                  <span className="text-[13px] text-ink-faint">{dict.common.language.label}</span>
                  <LanguageSwitcher locale={locale} />
                </div>
              </motion.div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
