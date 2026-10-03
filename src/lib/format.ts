import type { Locale } from "@/lib/i18n/config";

/**
 * Locale-aware formatting. `digits` controls Arabic-Indic vs Latin numerals for
 * Arabic text: invitations default to Arabic-Indic, the dashboard to Latin.
 */
export type DigitStyle = "arab" | "latn";

export function intlLocale(locale: Locale, digits: DigitStyle = "latn"): string {
  return locale === "ar" ? `ar-u-ca-gregory-nu-${digits}` : "en-GB";
}

export function formatDate(
  date: Date,
  opts: { locale: Locale; timeZone: string; digits?: DigitStyle; style?: "full" | "long" | "medium" | "short" },
): string {
  const style = opts.style ?? "full";
  const o: Intl.DateTimeFormatOptions =
    style === "full"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : style === "long"
        ? { day: "numeric", month: "long", year: "numeric" }
        : style === "medium"
          ? { day: "numeric", month: "short", year: "numeric" }
          : { day: "2-digit", month: "2-digit", year: "numeric" };
  return new Intl.DateTimeFormat(intlLocale(opts.locale, opts.digits), { ...o, timeZone: opts.timeZone }).format(date);
}

/** English times use "7:30 PM" (en-US style) — the convention on invitations. */
function timeLocale(locale: Locale, digits: DigitStyle = "latn") {
  return locale === "ar" ? intlLocale(locale, digits) : "en-US";
}

export function formatTime(date: Date, opts: { locale: Locale; timeZone: string; digits?: DigitStyle }): string {
  return new Intl.DateTimeFormat(timeLocale(opts.locale, opts.digits), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: opts.timeZone,
  }).format(date);
}

/** "19:30" (event-local wall time) → "7:30 PM" / "٧:٣٠ م" */
export function formatWallTime(hhmm: string, locale: Locale, digits: DigitStyle = "latn"): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(timeLocale(locale, digits), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(date: Date, opts: { locale: Locale; timeZone?: string }): string {
  return new Intl.DateTimeFormat(intlLocale(opts.locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: opts.timeZone,
  }).format(date);
}

/** "02/12/2026 19:30" — day first, 24-hour, Latin digits (exports and spreadsheets). */
export function formatNumericDateTime(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatNumber(n: number, locale: Locale, digits: DigitStyle = "latn"): string {
  return new Intl.NumberFormat(intlLocale(locale, digits)).format(n);
}

export function formatMoney(minor: number, currency: string, locale: Locale): string {
  const fractionDigits = ["KWD", "BHD", "OMR"].includes(currency) ? 3 : 2;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 10 ** fractionDigits === 0 ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(minor / 10 ** fractionDigits);
}

/** "3 minutes ago" style relative time. */
export function formatRelative(date: Date, locale: Locale, now = new Date()): string {
  const diff = (date.getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}
