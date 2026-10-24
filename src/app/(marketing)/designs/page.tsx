import type { Metadata } from "next";
import { headers } from "next/headers";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { THEME_LIST } from "@/lib/themes/registry";
import { OCCASION_GROUP_KEYS, isOccasionGroup, occasionGroup } from "@/lib/events/types";
import { DesignsBrowser, type BrowserItem } from "@/components/marketing/designs-browser";
import { THEME_STYLE } from "@/lib/marketing/design-styles";
import { startHref as wizardHref } from "@/lib/marketing/links";
import { SectionHeading } from "@/components/marketing/section-heading";
import { OwnDesignTile } from "@/components/marketing/own-design-tile";
import { breadcrumbLd, jsonLdHtml, pageMetadata, siteUrl } from "@/components/marketing/seo";
import { localePath } from "@/lib/i18n/routing";
import { CONTAINER } from "@/components/marketing/styles";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  const t = dict.marketing.meta;
  return pageMetadata({ locale, path: "/designs", title: t.designsTitle, description: t.designsDescription, image: "designs" });
}

export default async function DesignsPage({ searchParams }: { searchParams: Promise<{ occasion?: string | string[] }> }) {
  const [{ dict, locale }, user, sp, nonce] = await Promise.all([getI18n(), getSessionUser(), searchParams, headers().then((h) => h.get("x-nonce") ?? undefined)]);
  const occasion = isOccasionGroup(sp.occasion) ? sp.occasion : null;
  const signedIn = Boolean(user);
  const t = dict.marketing.designsPage;

  const items: BrowserItem[] = THEME_LIST.map((theme) => ({
    key: theme.key,
    name: dict.themes[theme.key].name,
    premium: theme.premium,
    style: THEME_STYLE[theme.key],
    language: theme.recommendedLanguage,
    groups: OCCASION_GROUP_KEYS.filter((g) => theme.occasions.some((o) => o !== "OTHER" && occasionGroup(o) === g)),
  }));

  const jsonLd = jsonLdHtml([
    breadcrumbLd(
      [
        { name: "INVTRA", path: "/" },
        { name: t.title, path: "/designs" },
      ],
      locale,
    ),
    {
      "@type": "ItemList",
      name: t.title,
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: siteUrl(localePath(locale, `/designs/${it.key}`)) })),
    },
  ]);

  return (
    <div className="relative">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-gold-soft),transparent)] opacity-70"
      />
      <div className={`${CONTAINER} relative pb-24 pt-16 sm:pb-32 sm:pt-24`}>
        <SectionHeading as="h1" eyebrow={t.eyebrow} title={t.title} body={t.body} />

        <div className="mt-12">
          <DesignsBrowser
            items={items}
            locale={locale}
            initialGroup={occasion}
            capped={false}
            copy={{ ...dict.marketing.home.designs, occasions: t.filters, premiumBadge: dict.themes.premium }}
          />
        </div>
        <div id="upload" className="mt-20 scroll-mt-24">
          <OwnDesignTile dict={dict} locale={locale} href={wizardHref(signedIn)} />
        </div>
      </div>
    </div>
  );
}
