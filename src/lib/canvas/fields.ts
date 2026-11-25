import type { CardContent } from "@/lib/card/build";
import { CARD_PHRASES } from "@/lib/invitation-copy";
import { fmt } from "@/lib/i18n/config";

/**
 * Smart fields: placeholders in Studio text that are filled in for every guest and kept up to date
 * with the event's details ({date} follows the date set in Details, {guest} is each guest's name…).
 */

export const FIELDS = ["guest", "admits", "date", "time", "venue", "address", "hosts", "title"] as const;
export type FieldKey = (typeof FIELDS)[number];

/** Fields that only exist on a guest's own card (left off the shared teaser image). */
export const GUEST_FIELDS: readonly FieldKey[] = ["guest", "admits"];

/** {field}, or {field.ar} / {field.en} to fix the language (bilingual lines). */
const TOKEN = /\{(guest|admits|date|time|venue|address|hosts|title|scan)(?:\.(en|ar))?\}/g;

export interface FieldValues {
  content: CardContent;
  guest: { name: string; allowedCount: number } | null;
  digits?: "arab" | "latn";
}

export function hasGuestField(text: string): boolean {
  return /\{(guest|admits)(\.(en|ar))?\}/.test(text);
}

export function hasField(text: string): boolean {
  return new RegExp(TOKEN.source).test(text);
}

function number(n: number, lang: "en" | "ar", digits: "arab" | "latn" = "arab"): string {
  return lang === "ar" ? new Intl.NumberFormat(`ar-u-nu-${digits}`).format(n) : String(n);
}

/** One field's value in a language ("" when the event doesn't have it). */
export function fieldValue(key: FieldKey | "scan", lang: "en" | "ar", v: FieldValues): string {
  const c = v.content;
  const ph = CARD_PHRASES[lang];
  switch (key) {
    case "guest":
      return v.guest?.name ?? "";
    case "admits":
      if (!v.guest) return "";
      return v.guest.allowedCount > 1 ? fmt(ph.admits, { n: number(v.guest.allowedCount, lang, v.digits) }) : ph.admitsOne;
    case "date":
      return lang === "ar" ? c.date.ar || c.date.en : c.date.en || c.date.ar;
    case "time":
      return lang === "ar" ? c.time.ar || c.time.en : c.time.en || c.time.ar;
    case "venue":
      return (lang === "ar" ? c.venueNameAr || c.venueName : c.venueName || c.venueNameAr) ?? "";
    case "address":
      return (lang === "ar" ? c.addressAr || c.address : c.address || c.addressAr) ?? "";
    case "hosts":
      return (lang === "ar" ? c.hostNamesAr || c.hostNames : c.hostNames || c.hostNamesAr) ?? "";
    case "title":
      return (lang === "ar" ? c.titleAr || c.title : c.title || c.titleAr) ?? "";
    case "scan":
      return ph.scan;
  }
}

/** Fill a text's fields in for a guest (or the sample guest in the editor). */
export function fillFields(text: string, lang: "en" | "ar", v: FieldValues): string {
  return text.replace(TOKEN, (_m, key: FieldKey | "scan", only?: "en" | "ar") => fieldValue(key, only ?? lang, v));
}
