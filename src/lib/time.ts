/**
 * Timezone helpers built on Intl (no dependencies). Events store a UTC instant plus
 * the IANA zone in which the host entered the date/time; everything shown to guests
 * is rendered back in that zone.
 */

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-12-12" + "19:30" in "Asia/Dubai" → UTC Date. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const o1 = zoneOffsetMs(new Date(guess), timeZone);
  let ts = guess - o1;
  const o2 = zoneOffsetMs(new Date(ts), timeZone);
  if (o2 !== o1) ts = guess - o2;
  return new Date(ts);
}

/** UTC Date → { date: "YYYY-MM-DD", time: "HH:mm" } in `timeZone`. */
export function utcToZoned(date: Date, timeZone: string): { date: string; time: string } {
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Zones offered in the event form — the markets INVTRA serves first, then the rest. */
export const COMMON_TIME_ZONES = [
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Bahrain",
  "Asia/Muscat",
  "Africa/Cairo",
  "Asia/Amman",
  "Asia/Beirut",
  "Asia/Baghdad",
  "Africa/Casablanca",
  "Europe/London",
  "Europe/Paris",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];
