import type { Metadata } from "next";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { THEME_LIST } from "@/lib/themes/registry";
import { OCCASION_GROUP_KEYS, isOccasionGroup, occasionGroup } from "@/lib/events/types";
import { DesignsGallery, type GalleryItem } from "@/components/marketing/designs-gallery";
import { SectionHeading } from "@/components/marketing/section-heading";
import { OwnDesignTile } from "@/components/marketing/own-design-tile";
import { breadcrumbLd, jsonLdHtml, pageMetadata } from "@/components/marketing/seo";
import { localePath } from "@/lib/i18n/routing";
import { CONTAINER } from "@/components/marketing/styles";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  const t = dict.marketing.meta;
  return pageMetadata({ locale, path: "/designs", title: t.designsTitle, description: t.designsDescription, image: "designs" });
}

/** Where "Use this design" leads: straight to a new event, or through sign-up first. */
function startHref(signedIn: boolean, theme?: string): string {
  const target = theme ? `/dashboard/events/new?theme=${theme}` : "/dashboard/events/new";
  return signedIn ? target : `/signup?next=${encodeURIComponent(target)}`;
}

export default async function DesignsPage({ searchParams }: { searchParams: Promise<{ occasion?: string | string[] }> }) {
  const [{ dict, locale }, user, sp] = await Promise.all([getI18n(), getSessionUser(), searchParams]);
  const occasion = isOccasionGroup(sp.occasion) ? sp.occasion : "all";
  const signedIn = Boolean(user);
  const t = dict.marketing.designsPage;

  const items: GalleryItem[] = THEME_LIST.map((theme) => ({
    key: theme.key,
    name: dict.themes[theme.key].name,
    description: dict.themes[theme.key].description,
    premium: theme.premium,
    recommendedLanguage: theme.recommendedLanguage,
    useHref: startHref(signedIn, theme.key),
    // How central each occasion family is to the design (0 = made for it); absent = not suited.
    occasions: Object.fromEntries(
      OCCASION_GROUP_KEYS.map((g) => [g, theme.occasions.findIndex((o) => occasionGroup(o) === g)]).filter(([, i]) => (i as number) >= 0),
    ),
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
      itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: localePath(locale, `/designs/${it.key}`) })),
    },
  ]);

  return (
    <div className="relative">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-bronze-100),transparent)] opacity-70"
      />
      <div className={`${CONTAINER} relative pb-24 pt-16 sm:pb-32 sm:pt-24`}>
        <SectionHeading as="h1" eyebrow={t.eyebrow} title={t.title} body={t.body} />

        <div className="mt-12">
          <DesignsGallery
            items={items}
            initialOccasion={occasion}
            labels={{
              premium: dict.themes.premium,
              languages: { EN: dict.common.language.en, AR: dict.common.language.ar, BILINGUAL: dict.common.language.bilingual },
              languageNames: dict.themes.recommendedFor,
            }}
            extra={<OwnDesignTile dict={dict} locale={locale} href={startHref(signedIn)} />}
          />
        </div>
      </div>
    </div>
  );
}
