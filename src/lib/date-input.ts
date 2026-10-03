/**
 * Day-first dates (dd/mm/yyyy) for the date fields. Values are exchanged as ISO calendar
 * dates ("2026-12-02", the same as <input type="date">); only what people see and type is
 * day-first. No time zones here — these are wall-calendar dates.
 */

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based
}

/** "2026-12-02" → { y: 2026, m: 12, d: 2 } (null when not a real date). */
export function splitIso(
  iso: string,
): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export const toIso = (y: number, m: number, d: number) =>
  `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** "2026-12-02" → "02/12/2026" ("" for an empty or invalid value). */
export function isoToDMY(iso: string | null | undefined): string {
  const p = iso ? splitIso(iso) : null;
  return p ? `${pad(p.d)}/${pad(p.m)}/${pad(p.y, 4)}` : "";
}

/** "2/12/2026", "02-12-2026", "02.12.2026" → "2026-12-02"; null when incomplete or not a real date. */
export function parseDMY(text: string): string | null {
  const match = /^\s*(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})\s*$/.exec(text);
  if (!match) return null;
  const [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1900 || y > 2200) return null;
  const iso = toIso(y, m, d);
  return splitIso(iso) ? iso : null;
}

/**
 * Formats what is being typed: digits get their slashes added ("02122026" → "02/12/2026"),
 * typed separators are kept ("2/1" stays "2/1"), and a pasted ISO date is converted.
 * `prev` tells typing from deleting, so a slash is never re-added while deleting.
 */
export function typeDMY(raw: string, prev: string): string {
  const iso = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(raw);
  if (iso) return isoToDMY(`${iso[1]}-${iso[2]}-${iso[3]}`) || raw.trim();
  const deleting = raw.length < prev.length;
  if (/[/.\-\s]/.test(raw.trim())) {
    const parts = raw
      .trim()
      .split(/[/.\-\s]+/)
      .map((p) => p.replace(/\D/g, ""));
    const [d = "", m = "", y = ""] = parts;
    let out = d.slice(0, 2);
    if (parts.length > 1) out += `/${m.slice(0, 2)}`;
    if (parts.length > 2) out += `/${y.slice(0, 4)}`;
    if (!deleting && parts.length === 1 && d.length === 2) out += "/";
    if (!deleting && parts.length === 2 && m.length === 2) out += "/";
    return out;
  }
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2 || (!deleting && digits.length === 2))
    out += `/${digits.slice(2, 4)}`;
  if (digits.length > 4 || (!deleting && digits.length === 4))
    out += `/${digits.slice(4, 8)}`;
  return out;
}

/** Today in the visitor's own calendar. */
export function todayIso(now = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(iso: string, n: number): string {
  const p = splitIso(iso)!;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Same day next/previous month, kept inside the month (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const p = splitIso(iso)!;
  const index = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return toIso(y, m, Math.min(p.d, daysInMonth(y, m)));
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string): number {
  const p = splitIso(iso)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function clampIso(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** Weeks of a month, Sunday first (the Gulf week); null pads the days of other months. */
export function monthWeeks(year: number, month: number): (string | null)[][] {
  const first = weekday(toIso(year, month, 1));
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= daysInMonth(year, month); d++)
    cells.push(toIso(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
