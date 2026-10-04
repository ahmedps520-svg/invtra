import type { GuestSection } from "@prisma/client";

/** groupBy(section) rows → { MEN, WOMEN, NONE }. */
export function sectionCounts(rows: { section: GuestSection | null; _count: number }[]) {
  const n = (s: GuestSection | null) => rows.find((r) => r.section === s)?._count ?? 0;
  return { MEN: n("MEN"), WOMEN: n("WOMEN"), NONE: n(null) };
}
