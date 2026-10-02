import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type PhoneResult = { ok: true; e164: string; national: string; country?: string } | { ok: false; reason: "empty" | "invalid" };

/**
 * Normalise user input to E.164. Accepts "+971 50 123 4567", "00971501234567",
 * or national formats when a default country is supplied.
 */
export function normalizePhone(input: string, defaultCountry?: string): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  const cleaned = raw.replace(/^00/, "+").replace(/[^\d+]/g, "");
  const parsed = parsePhoneNumberFromString(cleaned, (defaultCountry?.toUpperCase() as CountryCode) || undefined);
  if (!parsed || !parsed.isValid()) return { ok: false, reason: "invalid" };
  return { ok: true, e164: parsed.number, national: parsed.formatInternational(), country: parsed.country };
}

/** WhatsApp Cloud API expects the number without "+". */
export function toWhatsAppId(e164: string): string {
  return e164.replace(/^\+/, "");
}

export function fromWhatsAppId(waId: string): string {
  return waId.startsWith("+") ? waId : `+${waId}`;
}

export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Common defaults offered in forms. */
export const PHONE_COUNTRIES = ["AE", "SA", "KW", "QA", "BH", "OM", "EG", "JO", "LB", "IQ", "MA", "GB", "US"] as const;
