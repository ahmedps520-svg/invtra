import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { EventLanguage } from "@prisma/client";
import { db } from "@/server/db";
import { getI18n } from "@/server/i18n";
import { sampleEvent } from "@/server/invitations/sample";
import { buildInvitationVM } from "@/server/invitations/view-model";
import { InvitationExperience } from "@/components/invitation/experience";
import { getTheme, isThemeKey } from "@/lib/themes/registry";
import { pageMetadata } from "@/components/marketing/seo";
import { appUrl } from "@/server/env";
import { localePath } from "@/lib/i18n/routing";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  if (!isThemeKey(key)) return {};
  const { dict, locale } = await getI18n();
  const theme = getTheme(key);
  const occasions = theme.occasions
    .filter((o) => o !== "OTHER")
    .slice(0, 3)
    .map((o) => dict.common.eventTypes[o])
    .join(locale === "ar" ? "، " : ", ");
  const title = locale === "ar" ? `تصميم دعوة «${dict.themes[key].name}» — ${occasions}` : `${dict.themes[key].name} Invitation Design — ${occasions}`;
  return pageMetadata({ locale, path: `/designs/${key}`, title, description: dict.themes[key].description, image: key });
}

/** Public, interactive demo of a theme's guest website with sample content. */
export default async function DesignDemoPage({ params, searchParams }: Props) {
  const { key } = await params;
  const sp = await searchParams;
  if (!isThemeKey(key)) notFound();
  const row = await db.invitationTheme.findUnique({ where: { key } });
  if (row && !row.isActive) notFound();
  const { locale } = await getI18n();
  const theme = getTheme(key);
  const requested = typeof sp.lang === "string" ? sp.lang.toUpperCase() : null;
  const language: EventLanguage =
    requested === "AR" || requested === "EN" || requested === "BILINGUAL"
      ? requested
      : theme.recommendedLanguage !== "EN"
        ? theme.recommendedLanguage
        : locale === "ar"
          ? "AR"
          : "EN";
  const ar = language === "AR";
  const vm = await buildInvitationVM({
    event: sampleEvent(key, language),
    guest: {
      name: ar ? "خالد الهاشمي" : "Khalid Al Hashimi",
      allowedCount: 2,
      attendingCount: null,
      rsvpStatus: "PENDING",
      checkedInAt: null,
      checkedInCount: null,
      scanCount: 0,
      locale: null,
    },
    token: null,
    mode: "demo",
    // Scanning the sample pass opens this demo on the phone.
    qrText: appUrl(localePath(locale, `/designs/${key}`)),
  });
  return <InvitationExperience vm={{ ...vm, demoBackHref: localePath(locale, "/designs") }} />;
}
