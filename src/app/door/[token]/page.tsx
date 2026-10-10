import type { Metadata, Viewport } from "next";
import { getI18n } from "@/server/i18n";
import { pickNamespaces } from "@/lib/i18n";

import { I18nProvider } from "@/components/i18n/provider";
import { DoorApp, DoorClosed } from "@/components/door/door-app";
import { doorSummary, findDoorEvent } from "@/server/door/service";
import { whenLabel } from "@/lib/event-when";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  // The link is a secret: keep it out of search engines and other sites' referrer logs.
  return { title: dict.door.title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export const viewport: Viewport = { themeColor: "#14110e" };

/** Door check-in for staff: scan guests' QR codes or search by name — no account needed. */
export default async function DoorPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  const { locale } = await getI18n();
  const event = await findDoorEvent(token);
  const dict = pickNamespaces(locale, ["door"]);
  if (!event) {
    return (
      <I18nProvider locale={locale} dict={dict}>
        <DoorClosed />
      </I18nProvider>
    );
  }
  const summary = await doorSummary(event);
  const ar = locale === "ar";
  return (
    <I18nProvider locale={locale} dict={dict}>
      <DoorApp
        token={token}
        initial={JSON.parse(JSON.stringify(summary))}
        event={{
          title: ar ? event.titleAr || event.title : event.title,
          when: whenLabel(event, locale),
          sectionsEnabled: event.sectionsEnabled,
        }}
        lookup={typeof sp.g === "string" ? sp.g : null}
      />
    </I18nProvider>
  );
}
