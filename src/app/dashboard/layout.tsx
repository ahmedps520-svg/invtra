import type { Metadata } from "next";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { env } from "@/server/env";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { DashboardTopBar } from "@/components/dashboard/top-bar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const { locale } = await getI18n();
  return (
    <I18nProvider locale={locale} dict={pickNamespaces(locale, ["dashboard", "themes"])}>
      <div className="flex min-h-dvh flex-col bg-ivory">
        <DashboardTopBar
          user={{ name: user.name, email: user.email, role: user.role }}
          showSimulator={env().WHATSAPP_PROVIDER === "mock"}
        />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
