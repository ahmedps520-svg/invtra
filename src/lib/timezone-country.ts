/** IANA time zone → ISO country, used to read local phone numbers. */
export const TIMEZONE_COUNTRY: Record<string, string> = {
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Kuwait": "KW",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Muscat": "OM",
  "Africa/Cairo": "EG",
  "Asia/Amman": "JO",
  "Asia/Beirut": "LB",
  "Asia/Baghdad": "IQ",
  "Africa/Casablanca": "MA",
  "Europe/London": "GB",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Los_Angeles": "US",
};

/** The country an event is in (for phone numbers typed without a country code). */
export function countryForTimezone(timezone: string | null | undefined): string {
  return (timezone && TIMEZONE_COUNTRY[timezone]) ?? "SA";
}
