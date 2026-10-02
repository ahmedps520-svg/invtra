import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LogoMark, LogoWordmark } from "@/components/brand/logo";
import type { Dictionary } from "@/lib/i18n";
import { EYEBROW } from "./styles";

const CONTACT_EMAIL = "hello@invtra.store";

/** Marketing footer: brand, link columns, contact and legal line. */
export function SiteFooter({ dict, signedIn }: { dict: Dictionary; signedIn: boolean }) {
  const t = dict.marketing.footer;
  const nav = dict.common.nav;
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t.explore,
      links: [
        { href: "/#how-it-works", label: nav.howItWorks },
        { href: "/designs", label: nav.designs },
        { href: "/pricing", label: nav.pricing },
        { href: "/#faq", label: nav.faq },
      ],
    },
    {
      title: t.account,
      links: signedIn
        ? [
            { href: "/dashboard", label: nav.dashboard },
            { href: "/dashboard/events/new", label: nav.createInvitation },
          ]
        : [
            { href: "/login", label: dict.common.actions.signIn },
            { href: "/signup", label: t.createAccount },
          ],
    },
    {
      title: t.legal,
      links: [
        { href: "/privacy", label: dict.common.footer.privacy },
        { href: "/terms", label: dict.common.footer.terms },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-line bg-paper">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-16 sm:px-8 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Link
              href="/"
              aria-label={dict.marketing.nav.home}
              className="inline-flex items-center gap-3 text-bronze-600"
              dir="ltr"
            >
              <LogoMark className="h-11" />
              <LogoWordmark className="h-[17px]" />
            </Link>
            <p className="mt-6 max-w-sm font-display text-2xl leading-snug text-ink">{t.tagline}</p>
            <div className="mt-8">
              <p className={EYEBROW}>{t.contact}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group mt-3 inline-flex items-center gap-1.5 text-[15px] text-ink transition-colors hover:text-bronze-700"
              >
                {CONTACT_EMAIL}
                <ArrowUpRight
                  className="size-4 text-bronze-500 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
                  strokeWidth={1.5}
                />
              </a>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-ink-faint">{t.contactBody}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {columns.map((col) => (
              <div key={col.title}>
                <p className={EYEBROW}>{col.title}</p>
                <ul className="mt-5 space-y-3.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[15px] text-ink-soft transition-colors duration-300 hover:text-ink">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="hairline mt-16" />

        <div className="mt-8 flex flex-col gap-4 text-[13px] text-ink-faint md:flex-row md:items-start md:justify-between">
          <p>
            © {year} INVTRA. {dict.common.footer.rights} <span className="text-bronze-600">{dict.common.footer.madeFor}</span>
          </p>
          <p className="max-w-xl text-pretty md:text-end">{t.trademark}</p>
        </div>
      </div>
    </footer>
  );
}
