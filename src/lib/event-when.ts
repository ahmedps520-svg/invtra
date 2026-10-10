import type { Event } from "@prisma/client";
import { formatDate, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

/**
 * An event's date and time for display, when either may be "to be announced" (a baby's
 * arrival, a date not fixed yet). Everything shown to hosts and guests goes through here.
 */

export const TBA = {
  date: { en: "Date to be announced", ar: "الموعد يُعلن لاحقًا" },
  time: { en: "Time to be announced", ar: "الوقت يُعلن لاحقًا" },
} as const;

type When = Pick<Event, "startsAt" | "timezone"> & Partial<Pick<Event, "dateTbd" | "timeTbd">>;
type Digits = "arab" | "latn";

export function whenDate(e: When, locale: Locale, opts: { style?: "full" | "long" | "medium" | "short"; digits?: Digits } = {}): string {
  return e.dateTbd ? TBA.date[locale] : formatDate(e.startsAt, { locale, timeZone: e.timezone, style: opts.style ?? "full", digits: opts.digits });
}

/** The time, or null when it isn't known. */
export function whenTime(e: When, locale: Locale, opts: { digits?: Digits } = {}): string | null {
  return e.timeTbd ? null : formatTime(e.startsAt, { locale, timeZone: e.timezone, digits: opts.digits });
}

/** "Saturday, 12 December 2026 · 8:00 PM", "Date to be announced · 8:00 PM", or just the date. */
export function whenLabel(e: When, locale: Locale, opts: { style?: "full" | "long" | "medium" | "short"; digits?: Digits } = {}): string {
  const time = whenTime(e, locale, opts);
  return [whenDate(e, locale, opts), time].filter(Boolean).join(" · ");
}
