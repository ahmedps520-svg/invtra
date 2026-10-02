import type { Metadata } from "next";

/**
 * Page-level Open Graph data. Next.js replaces (not merges) the root layout's
 * `openGraph` object when a page defines one, so the shared fields are restated here.
 */
export function openGraph(title: string, description: string, locale: "en" | "ar", path = "/"): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: "INVTRA",
    title,
    description,
    url: path,
    locale: locale === "ar" ? "ar_AE" : "en_GB",
    images: [{ url: "/brand/icon-512.png", width: 512, height: 512, alt: "INVTRA" }],
  };
}
