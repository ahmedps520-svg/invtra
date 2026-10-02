import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/routing";

export const SITE_NAME = "INVTRA";
export const SITE_NAME_AR = "إنفترا";
export const CONTACT_EMAIL = "hello@invtra.store";

/** Absolute site origin (no trailing slash). */
export function siteUrl(path = ""): string {
  const base = (process.env.APP_URL || "https://invtra.store").replace(/\/$/, "");
  return path === "/" || path === "" ? base : `${base}${path}`;
}

/** hreflang alternates for a marketing path ("/designs"): English, Arabic and the default. */
export function languageAlternates(path: string) {
  return { en: localePath("en", path), ar: localePath("ar", path), "x-default": localePath("en", path) };
}

/**
 * Complete metadata for an indexable marketing page: canonical + hreflang, Open Graph and
 * X/Twitter cards with a 1200×630 share image. `image` is the share-image key (/og/<key>-<locale>.png).
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image = "home",
  absoluteTitle = false,
  keywords,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string;
  absoluteTitle?: boolean;
  keywords?: string[];
}): Metadata {
  const url = localePath(locale, path);
  const og = { url: `/og/${image}-${locale}.png`, width: 1200, height: 630, alt: title };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: locale === "ar" ? "ar_AE" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_AE"],
      images: [og],
    },
    twitter: { card: "summary_large_image", title, description, images: [og.url] },
  };
}

/** @deprecated use pageMetadata — kept for pages outside the marketing site. */
export function openGraph(title: string, description: string, locale: Locale, path = "/"): Metadata["openGraph"] {
  return pageMetadata({ locale, path, title, description }).openGraph;
}

/* ───────────── Structured data (schema.org JSON-LD) ───────────── */

export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": `${siteUrl()}/#organization`,
    name: SITE_NAME,
    alternateName: [SITE_NAME_AR, "Invtra", "invtra.store"],
    url: siteUrl(),
    logo: { "@type": "ImageObject", url: siteUrl("/brand/icon-512.png"), width: 512, height: 512 },
    email: CONTACT_EMAIL,
    ...(process.env.SOCIAL_PROFILES ? { sameAs: process.env.SOCIAL_PROFILES.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
  };
}

export function websiteLd(locale: Locale) {
  return {
    "@type": "WebSite",
    "@id": `${siteUrl()}/#website`,
    name: SITE_NAME,
    alternateName: [SITE_NAME_AR, "Invtra"],
    url: siteUrl(),
    inLanguage: ["en", "ar"],
    publisher: { "@id": `${siteUrl()}/#organization` },
    ...(locale === "ar" ? { description: "دعوات إلكترونية للمناسبات تصل عبر واتساب" } : { description: "Digital event invitations delivered on WhatsApp" }),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[], locale: Locale) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: siteUrl(localePath(locale, it.path)),
    })),
  };
}

export function faqLd(items: { q: string; a: string }[], locale: Locale) {
  return {
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Serialise a JSON-LD graph for a <script type="application/ld+json"> tag. */
export function jsonLdHtml(graph: object[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
