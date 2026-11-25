import { z } from "zod";
import { FONTS, type FontKey } from "@/lib/design/fonts";

/**
 * INVTRA Studio documents: a free-form invitation drawn on the card's 1080 × 1350 page from
 * elements (painted pieces and ornaments, photos, text, shapes, dividers and the guest's QR).
 * Stored on the design as `design.canvas`; when `enabled`, the card is drawn from it instead of
 * the template layout. Coordinates are card pixels: (x, y) is the top-left of the unrotated box,
 * rotation (degrees, clockwise) is about the box's centre.
 */

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;
/** Elements a document may hold. */
export const MAX_ELEMENTS = 300;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const fontKey = z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]);
const coord = z.number().finite().min(-5000).max(6000);
const length = z.number().finite().min(1).max(8000);
const unit = z.number().finite().min(0).max(1);
export const FOILS = ["gold", "silver", "rose"] as const;
const foil = z.enum(FOILS);

const base = {
  id: z.string().regex(/^[a-z0-9]{3,24}$/),
  /** The layer's name in the Layers panel ("" = automatic). */
  name: z.string().trim().max(60).default(""),
  x: coord,
  y: coord,
  w: length,
  h: length,
  rot: z.number().finite().min(-3600).max(3600).default(0),
  opacity: unit.default(1),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /** Elements sharing a group id are selected and moved together. */
  group: z.string().regex(/^[a-z0-9]{3,24}$/).nullable().default(null),
};

export const MASKS = ["none", "circle", "rounded", "arch", "heart", "star", "diamond"] as const;

export const imageSchema = z.object({
  ...base,
  type: z.literal("image"),
  /** A Studio asset id (public/studio) or a storage key of a photo uploaded to the event. */
  asset: z.string().regex(/^[a-z0-9-]{2,80}$/).nullable().default(null),
  upload: z.string().max(400).nullable().default(null),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  /** Part of the source shown, as fractions of it: [x0, y0, x1, y1]. */
  crop: z.tuple([unit, unit, unit, unit]).nullable().default(null),
  /** Shape the image is cut to (photo frames). */
  mask: z.enum(MASKS).default("none"),
  /**
   * Printed on paper: a soft white silhouette under the piece hides what's beneath and keeps its
   * watercolour true on dark paper (painted pieces only; how INVTRA's designs are printed).
   */
  print: z.boolean().default(false),
  filters: z
    .object({
      brightness: z.number().min(0.2).max(2).default(1),
      contrast: z.number().min(0.2).max(2).default(1),
      saturation: z.number().min(0).max(2).default(1),
      /** Wash the colours toward a tint (amount 0 = off). */
      tint: hex.nullable().default(null),
      tintAmount: unit.default(0),
      blur: z.number().min(0).max(20).default(0),
    })
    .default({}),
  shadow: z.object({ color: hex, blur: z.number().min(0).max(60), x: z.number().min(-80).max(80), y: z.number().min(-80).max(80), opacity: unit }).nullable().default(null),
});

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export const TEXT_EFFECTS = ["none", "shadow", "glow", "outline", "lift", "highlight"] as const;

export const textSchema = z.object({
  ...base,
  type: z.literal("text"),
  /** The text; {guest}, {admits}, {date}, {time}, {venue}, {address}, {hosts} and {title} are filled in per guest. */
  text: z.string().max(2000),
  font: fontKey,
  size: z.number().min(6).max(600),
  weight: z.number().int().min(100).max(900).default(400),
  italic: z.boolean().default(false),
  color: hex,
  /** Gold, silver or rose-gold foil instead of a flat colour. */
  foil: foil.nullable().default(null),
  align: z.enum(TEXT_ALIGNS).default("center"),
  /** Line height as a multiple of the size. */
  leading: z.number().min(0.6).max(3).default(1.25),
  /** Extra space between letters, in em (Latin text). */
  spacing: z.number().min(-0.1).max(1.5).default(0),
  upper: z.boolean().default(false),
  /** Reading direction and which language smart fields are filled in. */
  lang: z.enum(["en", "ar"]).default("en"),
  /** Bend the text along an arc: -100 (∪) … 0 (straight) … 100 (∩). */
  curve: z.number().min(-100).max(100).default(0),
  effect: z.enum(TEXT_EFFECTS).default("none"),
  effectColor: hex.default("#000000"),
  /** Strength of the effect, 0…1. */
  effectAmount: unit.default(0.5),
});

export const SHAPES = ["rect", "ellipse", "line", "triangle", "diamond", "star", "heart", "arch", "hexagon"] as const;

export const shapeSchema = z.object({
  ...base,
  type: z.literal("shape"),
  shape: z.enum(SHAPES),
  fill: hex.nullable().default("#E9DCC4"),
  /** Foil fill (overrides the colour). */
  foil: foil.nullable().default(null),
  stroke: hex.nullable().default(null),
  strokeFoil: foil.nullable().default(null),
  strokeWidth: z.number().min(0).max(60).default(0),
  dash: z.boolean().default(false),
  /** Corner radius (rectangles), card pixels. */
  radius: z.number().min(0).max(1000).default(0),
});

export const DIVIDER_STYLES = ["floral", "diamond", "hairline", "dots", "star", "heart", "moon"] as const;

export const dividerSchema = z.object({
  ...base,
  type: z.literal("divider"),
  style: z.enum(DIVIDER_STYLES),
  color: hex,
});

export const QR_ELEMENT_STYLES = ["rounded", "dots", "classic"] as const;

export const qrSchema = z.object({
  ...base,
  type: z.literal("qr"),
  style: z.enum(QR_ELEMENT_STYLES).default("rounded"),
  logo: z.boolean().default(true),
  fg: hex.default("#141210"),
  /** Plate behind the code (null = none). */
  plate: hex.nullable().default("#FFFFFF"),
  plateBorder: hex.nullable().default(null),
  /** Line under the code ("" = none); "{scan}" = "Scan for your invitation" in the card's language. */
  caption: z.string().trim().max(60).default("{scan}"),
  captionColor: hex.default("#3A332C"),
  captionFont: fontKey.default("jost"),
});

export const elementSchema = z.discriminatedUnion("type", [imageSchema, textSchema, shapeSchema, dividerSchema, qrSchema]);

export const washSchema = z.object({
  c: hex,
  x: z.number(),
  y: z.number(),
  r: z.number().min(1).max(3000),
  sx: z.number().min(0.1).max(10).default(1),
  sy: z.number().min(0.1).max(10).default(1),
  o: unit,
  /** Light on dark paper (screen) instead of a tint (multiply). */
  glow: z.boolean().default(false),
});

export const backgroundSchema = z.object({
  color: hex,
  /** Second colour, for a gentle top-to-bottom gradient (null = flat). */
  color2: hex.nullable().default(null),
  /** Paper grain, 0…1. */
  texture: unit.default(0.5),
  /** Darkened edges, 0…1. */
  vignette: unit.default(0),
  washes: z.array(washSchema).max(8).default([]),
  /** A picture behind everything: a design's painted artwork or a photo uploaded to the event. */
  image: z
    .object({
      art: z.string().regex(/^[a-z0-9-]{2,80}$/).nullable().default(null),
      upload: z.string().max(400).nullable().default(null),
      opacity: unit.default(1),
    })
    .nullable()
    .default(null),
});

/** Keep the valid elements of a stored list (a bad one is dropped, not the whole document). */
const elementList = z
  .array(z.unknown())
  .max(MAX_ELEMENTS * 2)
  .transform((items) => {
    const seen = new Set<string>();
    const out: CanvasElement[] = [];
    for (const item of items) {
      const r = elementSchema.safeParse(item);
      if (!r.success || seen.has(r.data.id)) continue;
      seen.add(r.data.id);
      out.push(r.data);
      if (out.length >= MAX_ELEMENTS) break;
    }
    return out;
  });

export const canvasSchema = z.object({
  /** Draw the card from this document instead of the template layout. */
  enabled: z.boolean().default(false),
  /** The INVTRA design it started from (null = blank). */
  source: z.string().max(80).nullable().default(null),
  bg: backgroundSchema.default({ color: "#FBF7F0" }),
  elements: elementList.default([]),
});

export type CanvasElement = z.infer<typeof elementSchema>;
export type ImageElement = z.infer<typeof imageSchema>;
export type TextElement = z.infer<typeof textSchema>;
export type ShapeElement = z.infer<typeof shapeSchema>;
export type DividerElement = z.infer<typeof dividerSchema>;
export type QrElement = z.infer<typeof qrSchema>;
export type CanvasBackground = z.infer<typeof backgroundSchema>;
export type CanvasDoc = z.infer<typeof canvasSchema>;
export type CanvasWash = z.infer<typeof washSchema>;
export type ElementType = CanvasElement["type"];
export type Foil = (typeof FOILS)[number];

export const EMPTY_CANVAS: CanvasDoc = canvasSchema.parse({});

/** Parse a stored document leniently (anything unusable becomes an empty, disabled document). */
export function parseCanvas(raw: unknown): CanvasDoc {
  const r = canvasSchema.safeParse(raw ?? {});
  return r.success ? r.data : EMPTY_CANVAS;
}

/** Defaults filled into a partially specified element (used when the editor creates one). */
export function makeElement<T extends CanvasElement>(raw: Partial<T> & Pick<T, "type" | "id">): T {
  return elementSchema.parse(raw) as T;
}
