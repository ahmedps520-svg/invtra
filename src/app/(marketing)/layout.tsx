import type { ReactNode } from "react";
import "./marketing.css";
import { preload } from "react-dom";
import { getI18n, liveDictionary } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { companyDetails } from "@/server/legal";
import type { Dictionary } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WhatsAppChatButton } from "@/components/marketing/whatsapp-chat";
import { OfferBanner } from "@/components/offers/national-day";
import { activeOffer, offerInfo } from "@/lib/offers";
import { env } from "@/server/env";

/**
 * Marketing pages render on the server and hand their client components the copy they need as
 * props; only what client components read from context (header, chat button, FAQ) goes to the browser.
 */
function clientDict(locale: "en" | "ar"): Pick<Dictionary, "marketing"> {
  const { marketing } = liveDictionary(locale);
  const slim = { nav: marketing.nav, footer: marketing.footer, faq: marketing.faq, home: { header: marketing.home.header } };
  return { marketing: slim as unknown as Dictionary["marketing"] };
}

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const [{ locale, dict }, user] = await Promise.all([getI18n(), getSessionUser()]);
  const signedIn = Boolean(user);
  // The faces the first screen is set in, requested with the HTML instead of after the CSS.
  const firstScreenFonts = locale === "ar" ? ["ibm-plex-sans-arabic-400", "amiri-400"] : ["jost-400", "cormorant-garamond-400"];
  for (const f of firstScreenFonts) preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  return (
    <I18nProvider locale={locale} dict={clientDict(locale)}>
      <div className="flex min-h-dvh flex-col bg-cream">
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
        <SiteFooter dict={dict} locale={locale} signedIn={signedIn} company={companyDetails()} supportWhatsApp={env().SUPPORT_WHATSAPP} />
        <WhatsAppChatButton number={env().SUPPORT_WHATSAPP} />
      </div>
    </I18nProvider>
  );
}
