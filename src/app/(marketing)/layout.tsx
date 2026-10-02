import type { ReactNode } from "react";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { pickNamespaces, type Dictionary } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * The long-form legal copy is only rendered by server components, so it is left out of
 * the dictionary sent to the browser.
 */
function clientDict(locale: "en" | "ar"): Pick<Dictionary, "marketing"> {
  const { marketing } = pickNamespaces(locale, ["marketing"]);
  const slim: Partial<Dictionary["marketing"]> = { ...marketing };
  delete slim.legal;
  return { marketing: slim as Dictionary["marketing"] };
}

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const [{ locale, dict }, user] = await Promise.all([getI18n(), getSessionUser()]);
  const signedIn = Boolean(user);

  return (
    <I18nProvider locale={locale} dict={clientDict(locale)}>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-sm text-ivory focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {dict.marketing.nav.skip}
        </a>
        <SiteHeader signedIn={signedIn} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter dict={dict} signedIn={signedIn} />
      </div>
    </I18nProvider>
  );
}
