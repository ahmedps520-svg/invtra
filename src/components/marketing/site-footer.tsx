import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LogoMark, LogoWordmark } from "@/components/brand/logo";
import type { Dictionary } from "@/lib/i18n";
import { EYEBROW } from "./styles";
import { localePath } from "@/lib/i18n/routing";
import { OCCASION_PAGES } from "@/lib/seo/occasion-pages";
import type { CompanyDetails } from "@/server/legal";
import { formatPhone } from "@/lib/phone";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { supportChatUrl } from "@/lib/support";
import { THEME_LIST } from "@/lib/themes/registry";
import { LanguagePill } from "./language-pill";

const CONTACT_EMAIL = "contact@invtra.store";
/** Designs listed by name in the footer (the full collection is one link away). */
const FOOTER_DESIGNS = ["royal", "luxury", "arabic", "teddy", "lantern", "garden"];

/** Marketing footer: brand, link columns, contact, language and the legal line. */
export function SiteFooter({
  dict,
  locale,
  signedIn,
  company,
  supportWhatsApp,
}: {
  dict: Dictionary;
  locale: "en" | "ar";
  signedIn: boolean;
  company?: CompanyDetails | null;
  /** INVTRA's support number on WhatsApp (digits), shown under the email. */
  supportWhatsApp?: string;
}) {
  const t = dict.marketing.footer;
  const f = dict.marketing.home.footer;
  const lp = (href: string) => localePath(locale, href);
  const nav = dict.common.nav;
  const year = new Date().getFullYear();

  const columns = [
    {
      title: f.product,
      links: [
        { href: lp("/#how-it-works"), label: nav.howItWorks },
        { href: lp("/pricing"), label: nav.pricing },
        { href: lp("/#find"), label: f.quiz },
        { href: lp("/#faq"), label: nav.faq },
        ...(signedIn
          ? [{ href: "/dashboard", label: nav.dashboard }]
          : [
              { href: "/signup", label: t.createAccount },
              { href: "/login", label: dict.common.actions.signIn },
            ]),
      ],
    },
    {
      title: f.occasions,
      links: OCCASION_PAGES.map((o) => ({ href: lp(`/invitations/${o.slug}`), label: o[locale].nav })),
    },
    {
      title: f.designs,
      links: [
        ...THEME_LIST.filter((th) => FOOTER_DESIGNS.includes(th.key)).map((th) => ({ href: lp(`/designs/${th.key}`), label: dict.themes[th.key].name })),
        { href: lp("/designs#upload"), label: f.uploadOwn },
        { href: lp("/designs"), label: f.allDesigns },
      ],
    },
    {
      title: f.company,
      links: [
        { href: lp("/privacy"), label: dict.common.footer.privacy },
        { href: lp("/terms"), label: dict.common.footer.terms },
        { href: `${lp("/terms")}#refunds`, label: dict.common.footer.refunds },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-hairline bg-[#fffcf6]">
      <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-16 sm:px-8 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href={lp("/")} aria-label={dict.marketing.nav.home} className="inline-flex items-center gap-3 text-gold-deep" dir="ltr">
              <LogoMark className="h-11" />
              <LogoWordmark className="h-[17px]" />
            </Link>
            <p className="mt-6 max-w-sm font-display text-2xl leading-snug text-ink">{t.tagline}</p>
            <div className="mt-8">
              <p className={EYEBROW}>{t.contact}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group mt-3 inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink transition-colors hover:text-gold-deep"
              >
                {CONTACT_EMAIL}
                <ArrowUpRight
                  className="size-4 text-gold transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
                  strokeWidth={1.5}
                />
              </a>
              {supportWhatsApp ? (
                <a
                  href={supportChatUrl(supportWhatsApp, t.chatMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 w-fit items-center gap-2 text-[15px] text-ink transition-colors hover:text-[#128C7E]"
                >
                  <WhatsAppIcon className="size-4 text-[#25D366]" />
                  <span dir="ltr">{formatPhone(`+${supportWhatsApp.replace(/\D/g, "")}`)}</span>
                  <span className="sr-only">— {t.chatLabel}</span>
                </a>
              ) : null}
              <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-faint">{t.contactBody}</p>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <span className="text-[13px] text-ink-faint">{f.language}</span>
              <LanguagePill locale={locale} label={f.language} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8 lg:col-start-5">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className={EYEBROW}>{col.title}</p>
                <ul className="mt-4 space-y-1">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="flex min-h-9 items-center text-[14.5px] text-ink-soft transition-colors duration-300 hover:text-ink">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="ivx-gold-rule mt-14 opacity-60" />

        <div className="mt-8 flex flex-col gap-4 text-[13px] text-ink-faint md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <p>
              © {year} INVTRA. {dict.common.footer.rights} <span className="text-gold-deep">{dict.common.footer.madeFor}</span>
            </p>
            {company ? (
              <p className="text-[12px]">
                {[
                  company.name ? `${dict.common.footer.operatedBy} ${company.name}` : null,
                  company.cr ? `${dict.common.footer.cr} ${company.cr}` : null,
                  company.vat ? `${dict.common.footer.vat} ${company.vat}` : null,
                  company.address,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <p className="max-w-xl text-pretty md:text-end">{t.trademark}</p>
        </div>

        <p className="mt-8 border-t border-hairline/70 pt-6 text-center text-[13px] text-ink-faint">
          {f.builtBy}{" "}
          <a
            href="https://mamar.site/"
            target="_blank"
            rel="noopener"
            lang="en"
            className="font-medium text-ink-soft underline decoration-gold/60 underline-offset-4 transition-colors hover:text-gold-deep hover:decoration-gold-deep"
          >
            Mamar
          </a>
        </p>
      </div>
    </footer>
  );
}
