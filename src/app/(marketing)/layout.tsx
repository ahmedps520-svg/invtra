import type { ReactNode } from "react";
import { preload } from "react-dom";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { companyDetails } from "@/server/legal";
import { pickNamespaces, type Dictionary } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { OfferBanner } from "@/components/offers/national-day";
import { activeOffer, offerInfo } from "@/lib/offers";
import { env } from "@/server/env";

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
  // The faces the first screen is set in, requested with the HTML instead of after the CSS.
  const firstScreenFonts = locale === "ar" ? ["ibm-plex-sans-arabic-400", "amiri-400"] : ["jost-400", "cormorant-garamond-400"];
  for (const f of firstScreenFonts) preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  return (
    <I18nProvider locale={locale} dict={clientDict(locale)}>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-sm text-ivory focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {dict.marketing.nav.skip}
        </a>
        <OfferBanner
          offer={offerInfo(activeOffer(), env().PAYMENT_CURRENCY)}
          currency={env().PAYMENT_CURRENCY}
          href={signedIn ? "/dashboard/events/new" : "/signup?next=%2Fdashboard%2Fevents%2Fnew"}
        />
        <SiteHeader signedIn={signedIn} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter dict={dict} locale={locale} signedIn={signedIn} company={companyDetails()} />
      </div>
    </I18nProvider>
  );
}
