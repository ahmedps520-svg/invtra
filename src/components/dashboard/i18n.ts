import { ApiError } from "@/lib/api-client";
import { fmt, type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Plural } from "@/lib/i18n/dictionaries/en/dashboard";

const rules = new Map<Locale, Intl.PluralRules>();

/** Pick the right plural form ("{n} guests") for `n` and interpolate it (Latin digits). */
export function plural(locale: Locale, forms: Plural, n: number, vars: Record<string, string | number> = {}): string {
  let r = rules.get(locale);
  if (!r) {
    r = new Intl.PluralRules(locale === "ar" ? "ar" : "en");
    rules.set(locale, r);
  }
  const category = n === 0 && forms.zero ? "zero" : r.select(n);
  const form = (forms as Record<string, string | undefined>)[category] ?? forms.other;
  return fmt(form, { n: formatNumber(n, locale), ...vars });
}

/** Friendly, localised message for an API error. */
export function errorMessage(err: unknown, dict: Dictionary): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return dict.common.errors.network;
    if (err.status === 429 || err.code === "rate_limited") return dict.dashboard.errors.rate_limited;
    const known = (dict.dashboard.errors as Record<string, string>)[err.code];
    if (known) return known;
    if (err.status === 401) return dict.common.errors.unauthorized;
    if (err.status === 403) return dict.common.errors.forbidden;
    if (err.status === 404) return dict.dashboard.errors.not_found;
    if (err.status === 422) return dict.common.errors.validation;
  }
  return dict.dashboard.errors.generic;
}

/** Theme display name from the `themes` dictionary. */
export function themeName(dict: Dictionary, key: string): string {
  const t = (dict.themes as unknown as Record<string, { name?: string } | undefined>)[key];
  return t?.name ?? key;
}
