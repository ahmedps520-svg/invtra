import { z } from "zod";

/**
 * Men's and women's sections. Many Saudi weddings (and other occasions) celebrate in two
 * separate parties: each guest belongs to one, and a section may have its own start time,
 * venue, address, map link and an entrance note. Anything a section leaves empty falls back
 * to the event's main details. Shared by the dashboard (forms) and the server.
 */

export const SECTION_KEYS = ["MEN", "WOMEN"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, { en: string; ar: string }> = {
  MEN: { en: "Men's section", ar: "قسم الرجال" },
  WOMEN: { en: "Women's section", ar: "قسم النساء" },
};

export function isSectionKey(v: unknown): v is SectionKey {
  return v === "MEN" || v === "WOMEN";
}

const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const sectionDetailsSchema = z.object({
  /** Start time on the event's date ("21:00"); empty = the event's time. */
  time: z.union([timeStr, z.literal("")]).optional().nullable().transform((v) => (v ? v : null)),
  venueName: text(160),
  venueNameAr: text(160),
  address: text(300),
  addressAr: text(300),
  mapsUrl: z
    .string()
    .trim()
    .max(600)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl|apple\.com|waze\.com)\//i.test(v), {
      message: "Paste a Google Maps, Apple Maps or Waze link",
    }),
  /** e.g. "Entrance from gate 2" — shown on the guest's invitation. */
  note: text(300),
  noteAr: text(300),
});

export type SectionDetails = z.output<typeof sectionDetailsSchema>;
export type EventSections = Record<SectionKey, SectionDetails>;

export const sectionsSchema = z.object({ MEN: sectionDetailsSchema, WOMEN: sectionDetailsSchema });

export const EMPTY_SECTION: SectionDetails = {
  time: null,
  venueName: null,
  venueNameAr: null,
  address: null,
  addressAr: null,
  mapsUrl: null,
  note: null,
  noteAr: null,
};

/** The stored JSON → both sections (missing or invalid values read as empty). */
export function parseSections(json: unknown): EventSections {
  const raw = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const one = (v: unknown): SectionDetails => {
    const r = sectionDetailsSchema.safeParse(v ?? {});
    return r.success ? r.data : { ...EMPTY_SECTION };
  };
  return { MEN: one(raw.MEN), WOMEN: one(raw.WOMEN) };
}

/** True when the section changes anything printed on the invitation (time or place). */
export function sectionDiffers(s: SectionDetails): boolean {
  return Boolean(s.time || s.venueName || s.venueNameAr || s.address || s.addressAr);
}

const MEN_WORDS = new Set(["men", "mens", "man", "male", "m", "gents", "gentlemen", "رجال", "الرجال", "رجالي", "رجل", "ر"]);
const WOMEN_WORDS = new Set(["women", "womens", "woman", "female", "f", "w", "ladies", "نساء", "النساء", "نسائي", "حريم", "سيدات", "ن"]);

/** A spreadsheet cell ("Women", "Men's section", "نساء", "قسم الرجال", "F"…) → section; null when empty or not recognised. */
export function parseSectionValue(raw: string | null | undefined): SectionKey | null {
  const v = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s*section$/, "")
    .replace(/^قسم\s*/, "")
    .trim();
  if (MEN_WORDS.has(v)) return "MEN";
  if (WOMEN_WORDS.has(v)) return "WOMEN";
  return null;
}
