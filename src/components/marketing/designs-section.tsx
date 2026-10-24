import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/routing";
import { THEME_LIST } from "@/lib/themes/registry";
import { OCCASION_GROUP_KEYS, occasionGroup } from "@/lib/events/types";
import { THEME_STYLE } from "@/lib/marketing/design-styles";
import { buttonClasses } from "@/components/ui/button";
import { DesignsBrowser, type BrowserItem } from "./designs-browser";
import { SectionHeading } from "./section-heading";
import { CONTAINER } from "./styles";

/** The design catalogue on the homepage, filterable (anchor: #designs). */
export function DesignsSection({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.marketing.designs;
  const h = dict.marketing.home.designs;
  const items: BrowserItem[] = THEME_LIST.map((theme) => ({
    key: theme.key,
    name: dict.themes[theme.key].name,
    premium: theme.premium,
    style: THEME_STYLE[theme.key],
    language: theme.recommendedLanguage,
    groups: OCCASION_GROUP_KEYS.filter((g) => theme.occasions.some((o) => o !== "OTHER" && occasionGroup(o) === g)),
  }));

  return (
    <section id="designs" aria-labelledby="designs-title" className="scroll-mt-20 border-t border-hairline/70 bg-[linear-gradient(180deg,var(--color-cream-deep),var(--color-cream)_60%)] py-16 sm:py-28">
      <div className={CONTAINER}>
        <SectionHeading eyebrow={t.eyebrow} title={<span id="designs-title">{t.title}</span>} body={t.body} />
        <div className="mt-12">
          <DesignsBrowser
            items={items}
            locale={locale}
            copy={{
              ...h,
              occasions: dict.marketing.designsPage.filters,
              premiumBadge: dict.themes.premium,
            }}
          />
        </div>
        <div className="mt-12 flex justify-center">
          <Link href={localePath(locale, "/designs")} className={buttonClasses("outline", "lg", "group")}>
            {t.cta}
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
