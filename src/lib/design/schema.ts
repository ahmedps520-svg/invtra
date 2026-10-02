import { z } from "zod";
import { FONTS, type FontKey } from "./fonts";

/**
 * The customer-editable design of an invitation. Stored as JSON on Event.design.
 * Always read through normalizeDesign() so older/partial documents get defaults.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #84664A");
const fontKey = z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]);
const shortText = z.string().trim().max(160);

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
  }),
  monogram: z.string().trim().max(8).default(""),
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
    qr: z.object({
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
