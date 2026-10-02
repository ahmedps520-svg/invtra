import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getI18n } from "@/server/i18n";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { ToastProvider } from "@/components/ui/toast";

const appUrl = process.env.APP_URL || "https://invtra.store";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "INVTRA — Your Invitation. Reimagined.", template: "%s · INVTRA" },
  description:
    "Create beautiful digital invitations, send them directly through WhatsApp, and let every guest receive their own personalised invitation and QR code.",
  applicationName: "INVTRA",
  openGraph: {
    type: "website",
    siteName: "INVTRA",
    title: "INVTRA — Your Invitation. Reimagined.",
    description: "Premium digital invitations delivered through WhatsApp, with a personal QR code for every guest.",
    url: appUrl,
    images: [{ url: "/brand/icon-512.png", width: 512, height: 512 }],
  },
  robots: { index: true, follow: true },
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
        </I18nProvider>
      </body>
    </html>
  );
}
