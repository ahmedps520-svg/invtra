import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getI18n } from "@/server/i18n";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/sw-register";

const appUrl = process.env.APP_URL || "https://invtra.store";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "INVTRA — Digital Event Invitations & E-Invites on WhatsApp", template: "%s · INVTRA" },
  description:
    "Digital event invitations sent on WhatsApp — weddings, newborns, baby showers, birthdays, Ramadan & corporate events. One-tap RSVP and a QR code for every guest.",
  applicationName: "INVTRA",
  authors: [{ name: "INVTRA", url: appUrl }],
  creator: "INVTRA",
  publisher: "INVTRA",
  category: "events",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    siteName: "INVTRA",
    title: "INVTRA — Your Invitation. Reimagined.",
    description: "Digital invitations delivered on WhatsApp, with a personal invitation and QR code for every guest.",
    url: appUrl,
    images: [{ url: "/og/home-en.png", width: 1200, height: 630, alt: "INVTRA — digital invitations on WhatsApp" }],
  },
  twitter: { card: "summary_large_image", images: ["/og/home-en.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  // Search Console / Bing Webmaster / Meta domain ownership (values from their "HTML tag" / "Meta-tag" method).
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    other: {
      ...(process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : {}),
      ...(process.env.META_DOMAIN_VERIFICATION ? { "facebook-domain-verification": process.env.META_DOMAIN_VERIFICATION } : {}),
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getI18n();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-dvh">
        <I18nProvider locale={locale} dict={pickNamespaces(locale, ["common"])}>
          <ToastProvider>{children}</ToastProvider>
          <ServiceWorkerRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
