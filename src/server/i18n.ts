import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dirOf, isLocale, type Locale } from "@/lib/i18n/config";
import { LOCALE_HEADER } from "@/lib/i18n/routing";
import { getDictionary } from "@/lib/i18n";

/** Locale for the site UI: the URL (/ar/… marketing pages, set by the proxy) → explicit cookie → Accept-Language → English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("ar")) return "ar";
  return DEFAULT_LOCALE;
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, dir: dirOf(locale), dict: getDictionary(locale) };
}
