"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useI18n } from "@/components/i18n/provider";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { localePath, splitLocale } from "@/lib/i18n/routing";
import { LanguagePill } from "./language-pill";

/**
 * Marketing navigation: transparent over the hero, frosted cream with a hairline once the page
 * scrolls. On phones the menu is a full-screen sheet with large items.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const { dict, locale } = useI18n();
  const pathname = usePathname();
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
  const languageLabel = dict.marketing.home.header.language;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
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
          "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ease-luxe",
          scrolled || open
            ? "border-hairline/80 bg-cream/80 shadow-[0_14px_32px_-28px_rgb(60_44_24/0.35)] backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-6 px-5 sm:h-[72px] sm:px-8">
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
                      {active ? <span className="absolute inset-x-4 -bottom-0.5 h-px bg-gold" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <LanguagePill locale={locale} label={languageLabel} className="hidden sm:inline-flex" />
            <Link
              href={accountHref}
              className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink xl:inline-flex"
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
              className="-me-2 inline-flex size-11 items-center justify-center rounded-full text-ink transition hover:bg-cream-deep lg:hidden"
            >
              {open ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen sheet (phones and tablets). Always mounted so it can fade both ways. */}
      <div
        id="mobile-menu"
        inert={!open}
        className={cn(
          "fixed inset-x-0 bottom-0 top-[68px] z-40 overflow-y-auto bg-cream transition-[opacity,translate,visibility] duration-500 ease-luxe sm:top-[72px] lg:hidden",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-3 opacity-0",
        )}
      >
        <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0 opacity-50" />
        <nav aria-label={dict.marketing.nav.primary} className="relative mx-auto flex min-h-full max-w-7xl flex-col px-5 pb-10 pt-4 sm:px-8">
          <ul className="divide-y divide-hairline/80">
            {links.map((l, i) => (
              <li
                key={l.href}
                style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" }}
                className={cn("transition-[opacity,translate] duration-500 ease-luxe", open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}
              >
                <Link href={l.href} onClick={close} className="group flex min-h-16 items-center justify-between py-4 font-display text-[2rem] leading-none text-ink">
                  {l.label}
                  <ArrowRight
                    className="size-5 text-gold transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                    strokeWidth={1.25}
                  />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-3 pt-10">
            <Link href={ctaHref} onClick={close} className={buttonClasses("primary", "lg", "w-full")}>
              {nav.createInvitation}
            </Link>
            <Link href={accountHref} onClick={close} className={buttonClasses("outline", "lg", "w-full")}>
              {accountLabel}
            </Link>
            <div className="mt-4 flex items-center justify-between border-t border-hairline/80 pt-5">
              <span className="text-[13px] text-ink-faint">{languageLabel}</span>
              <LanguagePill locale={locale} label={languageLabel} />
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
