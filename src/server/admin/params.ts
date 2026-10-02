/**
 * Helpers for reading admin list filters from (async) page searchParams.
 * Everything is validated against allow-lists; unknown values are ignored.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 25;

export function str(sp: SearchParams, key: string, max = 200): string {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? "").trim().slice(0, max);
}

export function oneOf<T extends string>(sp: SearchParams, key: string, values: readonly T[]): T | undefined {
  const v = str(sp, key);
  return (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function pageOf(sp: SearchParams): number {
  const n = Number.parseInt(str(sp, "page"), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function paging(sp: SearchParams, pageSize = PAGE_SIZE) {
  const page = pageOf(sp);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** "YYYY-MM-DD" → Date at 00:00 UTC (or end of that day with `endOfDay`). */
export function dateParam(sp: SearchParams, key: string, endOfDay = false): Date | undefined {
  const v = str(sp, key, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return endOfDay ? new Date(d.getTime() + 86_400_000 - 1) : d;
}

/** Plain record of the current filters (for pagination links / filter bars). */
export function currentParams(sp: SearchParams, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = str(sp, k);
    if (v) out[k] = v;
  }
  return out;
}

/** Digits only — "+971 50-123 4567" → "971501234567". */
export function phoneDigits(s: string): string {
  return s.replace(/\D/g, "");
}
