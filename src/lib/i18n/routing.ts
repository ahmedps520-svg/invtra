import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Public marketing pages have one URL per language so search engines can index both:
 * English at `/designs`, Arabic at `/ar/designs`. (The signed-in app keeps the cookie choice.)
 */
const LOCALIZED = [/^\/$/, /^\/designs(?:\/[a-z-]+)?$/, /^\/pricing$/, /^\/privacy$/, /^\/terms$/, /^\/invitations(?:\/[a-z-]+)?$/];

export const LOCALE_HEADER = "x-invtra-locale";

export function isLocalizedPath(pathname: string): boolean {
  return LOCALIZED.some((r) => r.test(pathname));
}

/** "/ar/designs" → { locale: "ar", path: "/designs" }; "/designs" → { locale: null, path: "/designs" }. */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  if (pathname === "/ar") return { locale: "ar", path: "/" };
  if (pathname.startsWith("/ar/")) return { locale: "ar", path: pathname.slice(3) };
  return { locale: null, path: pathname };
}

/**
 * The address of `href` in `locale` — "/designs?occasion=baby" → "/ar/designs?occasion=baby",
 * "/#faq" → "/ar#faq". App pages (sign-up, dashboard…) and external links are returned unchanged.
 */
export function localePath(locale: Locale, href: string): string {
  if (locale === DEFAULT_LOCALE || !href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const path = cut < 0 ? href : href.slice(0, cut);
  const rest = cut < 0 ? "" : href.slice(cut);
  if (!isLocalizedPath(path)) return href;
  return (path === "/" ? "/ar" : `/ar${path}`) + rest;
}
