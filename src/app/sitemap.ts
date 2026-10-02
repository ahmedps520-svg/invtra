export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { THEME_LIST } from "@/lib/themes/registry";
import { OCCASION_PAGES } from "@/lib/seo/occasion-pages";
import { localePath } from "@/lib/i18n/routing";
import { siteUrl } from "@/components/marketing/seo";

/** Every public page in English and Arabic, each listing its other-language alternate (hreflang). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let inactive = new Set<string>();
  try {
    inactive = new Set((await db.invitationTheme.findMany({ where: { isActive: false }, select: { key: true } })).map((t) => t.key));
  } catch {
    /* database unavailable — list every design */
  }
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/invitations", priority: 0.9, changeFrequency: "monthly" },
    ...OCCASION_PAGES.map((p) => ({ path: `/invitations/${p.slug}`, priority: 0.9, changeFrequency: "monthly" as const })),
    { path: "/designs", priority: 0.8, changeFrequency: "monthly" },
    ...THEME_LIST.filter((t) => !inactive.has(t.key)).map((t) => ({ path: `/designs/${t.key}`, priority: 0.6, changeFrequency: "monthly" as const })),
    { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  ];
  return pages.flatMap((p) => {
    const languages = { en: siteUrl(localePath("en", p.path)), ar: siteUrl(localePath("ar", p.path)) };
    return (["en", "ar"] as const).map((locale) => ({
      url: languages[locale],
      changeFrequency: p.changeFrequency,
      priority: locale === "en" ? p.priority : Math.max(0.1, p.priority - 0.1),
      alternates: { languages: { ...languages, "x-default": languages.en } },
    }));
  });
}
