import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getI18n } from "@/server/i18n";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Logo } from "@/components/brand/logo";
import { AuthArt } from "@/components/auth/auth-art";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { description: dict.auth.meta.description, robots: { index: false, follow: true } };
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { locale, dict } = await getI18n();
  const year = new Date().getFullYear();

  return (
    <I18nProvider locale={locale} dict={pickNamespaces(locale, ["auth"])}>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="relative flex min-h-dvh flex-col">
          <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0 opacity-50" />
          <header className="relative flex items-center justify-between px-5 py-5 sm:px-10 sm:py-7">
            <Link href="/" aria-label={dict.auth.backHome} className="-m-1 rounded-lg p-1">
              <Logo markClassName="h-8" />
            </Link>
            <LanguageSwitcher locale={locale} />
          </header>

          <main className="relative flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-10">
            <div className="w-full max-w-[25rem] animate-fade-up">{children}</div>
          </main>

          <footer className="relative flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 pb-8 text-[12.5px] text-ink-faint sm:px-10">
            <span>© {year} INVTRA</span>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              {dict.common.footer.privacy}
            </Link>
            <Link href="/terms" className="transition-colors hover:text-ink">
              {dict.common.footer.terms}
            </Link>
            <a href="mailto:hello@invtra.store" className="transition-colors hover:text-ink">
              hello@invtra.store
            </a>
          </footer>
        </div>

        <aside aria-hidden="true" className="sticky top-0 hidden h-dvh lg:block">
          <AuthArt dict={dict} locale={locale} />
        </aside>
      </div>
    </I18nProvider>
  );
}
