import { formatMoney, formatNumber } from "@/lib/format";
import { isUnlimited } from "@/lib/plans";

/**
 * Formatting for the (English-only) admin area. System timestamps are shown in UTC so
 * every staff member reads the same clock; event dates use the event's own time zone.
 */

export const ADMIN_TZ = "UTC";

const dtFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ADMIN_TZ,
});
const dFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ADMIN_TZ,
});

export function dt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dtFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function day(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function eventDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function eventDateTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
}

export function rel(
  d: Date | string | null | undefined,
  now = Date.now(),
): string {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const s = Math.round((now - t) / 1000);
  const abs = Math.abs(s);
  const suffix = s >= 0 ? " ago" : "";
  const prefix = s < 0 ? "in " : "";
  if (abs < 45) return s >= 0 ? "just now" : "in a moment";
  if (abs < 3600) return `${prefix}${Math.round(abs / 60)}m${suffix}`;
  if (abs < 86400) return `${prefix}${Math.round(abs / 3600)}h${suffix}`;
  if (abs < 86400 * 45) return `${prefix}${Math.round(abs / 86400)}d${suffix}`;
  if (abs < 86400 * 365)
    return `${prefix}${Math.round(abs / (86400 * 30))}mo${suffix}`;
  return `${prefix}${Math.round(abs / (86400 * 365))}y${suffix}`;
}

/** "3m 20s" / "2h 5m" / "4d 1h" */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400)
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export const num = (n: number) => formatNumber(n, "en");
/** A plan's guest allowance — custom packages can be unlimited. */
export const guestLimit = (n: number) =>
  isUnlimited(n) ? "Unlimited" : num(n);
export const money = (minor: number, currency: string) =>
  formatMoney(minor, currency, "en");
export const pct = (part: number, total: number) =>
  total ? `${Math.round((part / total) * 100)}%` : "—";

/** "1 order" / "3 orders" */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${num(n)} ${n === 1 ? one : many}`;
