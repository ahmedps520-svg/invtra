import { z } from "zod";
import { FONTS, type FontKey } from "./fonts";

/**
 * The customer-editable design of an invitation. Stored as JSON on Event.design.
 * Always read through normalizeDesign() so older/partial documents get defaults.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #84664A");
const fontKey = z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]);
const shortText = z.string().trim().max(160);
/** Extra lines printed on the card (custom events): up to a few short lines. */
const extraText = z.string().trim().max(300).default("");
/** Where a QR can point instead of the guest's own invitation: any web link. */
const qrLink = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Use a full web link, like https://example.com")
  .default("");

export const QR_POSITIONS = ["bottom-center", "bottom-start", "bottom-end"] as const;
export const QR_SIZES = ["sm", "md", "lg"] as const;
export const QR_STYLES = ["rounded", "dots", "classic"] as const;
export const ANIMATIONS = ["none", "subtle", "elegant"] as const;
export const BACKGROUND_MODES = ["theme", "solid", "image"] as const;

export const designSchema = z.object({
  palette: z.object({
    background: hex,
    surface: hex,
    text: hex,
    muted: hex,
    accent: hex,
  }),
  fonts: z.object({
    display: fontKey,
    body: fontKey,
    arabicDisplay: fontKey,
    arabicBody: fontKey,
  }),
  texts: z.object({
    eyebrow: shortText.default(""),
    intro: shortText.default(""),
    closing: shortText.default(""),
    eyebrowAr: shortText.default(""),
    introAr: shortText.default(""),
    closingAr: shortText.default(""),
    /** Your own extra lines on the card and the guest page (e.g. "Children are welcome"). */
    extra: extraText,
    extraAr: extraText,
  }),
  monogram: z.string().trim().max(8).default(""),
  /**
   * The names (the couple, the baby, the graduate…) can have their own typeface and colour;
   * null follows the display typefaces and the text colour.
   */
  names: z
    .object({ font: fontKey.nullable(), fontAr: fontKey.nullable(), color: hex.nullable() })
    .default({ font: null, fontAr: null, color: null }),
  sections: z.object({
    countdown: z.boolean(),
    schedule: z.boolean(),
    gallery: z.boolean(),
    details: z.boolean(),
    map: z.boolean(),
    rsvp: z.boolean(),
    music: z.boolean(),
    contact: z.boolean(),
  }),
  animation: z.enum(ANIMATIONS),
  background: z.object({
    mode: z.enum(BACKGROUND_MODES),
    imageKey: z.string().max(400).nullable().default(null),
    overlay: z.number().min(0).max(0.9),
  }),
  card: z.object({
    showBranding: z.boolean(),
    showGuestName: z.boolean(),
    showVenueAddress: z.boolean(),
    /** Which of the event's lines are printed on the card (any can be left off). */
    lines: z
      .object({ eyebrow: z.boolean(), names: z.boolean(), intro: z.boolean(), date: z.boolean(), time: z.boolean(), venue: z.boolean() })
      .default({ eyebrow: true, names: true, intro: true, date: true, time: true, venue: true }),
    qr: z.object({
      /** Print a QR code at all. */
      enabled: z.boolean().default(true),
      /** Encode this link instead of the guest's personal invitation link ("" = the guest's own). */
      link: qrLink,
      /** Line under the code ("" = "Scan for your invitation"). */
      caption: z.string().trim().max(60).default(""),
      position: z.enum(QR_POSITIONS),
      size: z.enum(QR_SIZES),
      style: z.enum(QR_STYLES),
      showLogo: z.boolean(),
    }),
  }),
  /** QR placement on a customer-uploaded image: centre (x, y) and width, as fractions of the image. */
  customQr: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    size: z.number().min(0.12).max(0.45),
  }),
  digits: z.enum(["arab", "latn"]),
});

export type InvitationDesign = z.infer<typeof designSchema>;
export type CardLines = InvitationDesign["card"]["lines"];

/** Card lines that can be left off, in the order they are printed. */
export const CARD_LINE_KEYS = ["eyebrow", "names", "intro", "date", "time", "venue"] as const satisfies readonly (keyof CardLines)[];

/**
 * What the card's QR encodes: nothing when the QR is turned off, the custom link when one is
 * set, otherwise the guest's personal link (`personal`, null on non-personal cards).
 */
export function cardQrText(design: Pick<InvitationDesign, "card">, personal: string | null | undefined): string | null {
  const qr = design.card.qr;
  if (qr.enabled === false || !personal) return null;
  return qr.link || personal;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

/**
 * Merge a stored (possibly partial or outdated) design over the theme defaults and
 * validate. Invalid fields fall back to defaults instead of breaking the page.
 */
export function normalizeDesign(defaults: InvitationDesign, raw: unknown): InvitationDesign {
  const merged = deepMerge(defaults, isPlainObject(raw) ? raw : {});
  const parsed = designSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  // Drop the offending top-level keys and retry against defaults.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  const cleaned = Object.fromEntries(Object.entries(isPlainObject(raw) ? raw : {}).filter(([k]) => !bad.has(k)));
  const retry = designSchema.safeParse(deepMerge(defaults, cleaned));
  return retry.success ? retry.data : defaults;
}

/** Patch accepted from the editor (any subset of the design). */
export const designPatchSchema = designSchema.deepPartial();
