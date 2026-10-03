import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/** Phone-field values: country picker + national number ⇄ "+966501234567". Client-safe (small metadata). */

/** Countries sharing a dial code → the one people mean (+1 → US, +44 → GB, +7 → RU…). */
const MAIN_COUNTRY: Record<string, CountryCode> = { "1": "US", "7": "RU", "39": "IT", "44": "GB", "47": "NO", "61": "AU", "212": "MA", "262": "RE", "290": "SH", "358": "FI", "590": "GP", "599": "CW" };

export function countryForCallingCode(code: string): CountryCode | null {
  return MAIN_COUNTRY[code] ?? getCountries().find((c) => getCountryCallingCode(c) === code) ?? null;
}

export function isCountry(code: string | null | undefined): code is CountryCode {
  return Boolean(code) && (getCountries() as string[]).includes(code!.toUpperCase());
}

/** Split a stored value ("+966501234567") into country + national digits for editing. */
export function splitPhone(value: string, fallback: CountryCode): { country: CountryCode; national: string } {
  const v = value.trim();
  if (!v) return { country: fallback, national: "" };
  if (v.startsWith("+")) {
    const p = parsePhoneNumberFromString(v);
    if (p?.country) return { country: p.country, national: p.nationalNumber };
    // Number not pinned to one country (e.g. a reserved range): use the dial code's main country.
    const byCode = p ? countryForCallingCode(p.countryCallingCode) : null;
    if (p && byCode) return { country: byCode, national: p.nationalNumber };
    return { country: fallback, national: v };
  }
  return { country: fallback, national: v };
}

/** Country + national number → the value the form stores (E.164 when it can be worked out). */
export function composePhone(country: CountryCode, national: string): string {
  const raw = national.trim();
  if (!raw) return "";
  if (/^(\+|00)/.test(raw)) return raw.replace(/^00/, "+").replace(/[^\d+]/g, "");
  const p = parsePhoneNumberFromString(raw, country);
  if (p?.isPossible()) return p.number;
  return `+${getCountryCallingCode(country)}${raw.replace(/\D/g, "").replace(/^0+/, "")}`;
}

