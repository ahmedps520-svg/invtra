import type { InvitationDesign } from "@/lib/design/schema";
import type { FontKey } from "@/lib/design/fonts";
import type { Asset } from "./assets";
import type { Point } from "./geometry";
import { newId } from "./ids";
import { placeAt } from "./ops";
import { DIVIDER_SIZE } from "./render";
import {
  CANVAS_H,
  CANVAS_W,
  makeElement,
  type CanvasElement,
  type DividerElement,
  type Foil,
  type ImageElement,
  type QrElement,
  type ShapeElement,
  type TextElement,
} from "./schema";

/** New elements for the Studio, styled after the event's design (its typefaces and colours). */

export type Lang = "en" | "ar";

function fit(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(8, w * k), h: Math.max(8, h * k) };
}

export function assetElement(asset: Asset, at?: Point, max = asset.painted ? 460 : 380): ImageElement {
  const { w, h } = fit(asset.width, asset.height, max);
  return makeElement<ImageElement>({ type: "image", id: newId(), asset: asset.id, ...placeAt(w, h, at), w, h, print: asset.painted });
}

export function photoElement(upload: { key: string; width: number | null; height: number | null }, at?: Point, max = 620): ImageElement {
  const { w, h } = fit(upload.width ?? 1080, upload.height ?? 1350, max);
  return makeElement<ImageElement>({ type: "image", id: newId(), upload: upload.key, ...placeAt(w, h, at), w, h });
}

export const PHOTO_FRAMES = ["rect", "circle", "rounded", "arch", "heart", "star", "diamond"] as const;
export type PhotoFrame = (typeof PHOTO_FRAMES)[number];

/** An empty photo frame (drop or choose a photo to fill it). */
export function photoFrameElement(frame: PhotoFrame, at?: Point): ImageElement {
  const square = frame === "circle" || frame === "heart" || frame === "star" || frame === "diamond";
  const w = square ? 420 : 400;
  const h = square ? 420 : frame === "arch" ? 520 : 500;
  return makeElement<ImageElement>({ type: "image", id: newId(), ...placeAt(w, h, at), w, h, mask: frame === "rect" ? "none" : frame });
}

export type TextPreset = "title" | "heading" | "subheading" | "body" | "label" | "script";

/** Typeface and look of each text preset, from the design's own fonts and colours. */
export function textPreset(preset: TextPreset, design: InvitationDesign, lang: Lang): Partial<TextElement> {
  const p = design.palette;
  const f = design.fonts;
  const nameFont = (lang === "ar" ? (design.names.fontAr ?? f.arabicDisplay) : (design.names.font ?? f.display)) as FontKey;
  const display = (lang === "ar" ? f.arabicDisplay : f.display) as FontKey;
  const body = (lang === "ar" ? f.arabicBody : f.body) as FontKey;
  switch (preset) {
    case "title":
      return { font: nameFont, size: lang === "ar" ? 104 : 112, color: design.names.color ?? p.text, w: 880, leading: 1.15 };
    case "heading":
      return { font: display, size: 64, color: p.text, w: 820, leading: 1.2 };
    case "subheading":
      return { font: display, size: 34, color: p.accent, w: 760, upper: lang === "en", spacing: lang === "en" ? 0.14 : 0, leading: 1.3 };
    case "body":
      return { font: body, size: 30, color: p.text, w: 700, leading: 1.45 };
    case "label":
      return { font: lang === "ar" ? "plex-arabic" : "jost", size: 20, color: p.muted, w: 600, upper: lang === "en", spacing: lang === "en" ? 0.32 : 0, weight: 500 };
    case "script":
      return { font: lang === "ar" ? "aref-ruqaa" : "great-vibes", size: 96, color: p.accent, w: 820, leading: 1.1 };
  }
}

export const PRESET_TEXT: Record<TextPreset, Record<Lang, string>> = {
  title: { en: "Sara & Ahmed", ar: "سارة و أحمد" },
  heading: { en: "Add a heading", ar: "أضف عنوانًا" },
  subheading: { en: "Together with their families", ar: "بحضور عائلتيهما" },
  body: { en: "Request the pleasure of your company to celebrate with them", ar: "يتشرفون بدعوتكم لمشاركتهم فرحتهم" },
  label: { en: "Save the date", ar: "احفظوا التاريخ" },
  script: { en: "with love", ar: "بكل الحب" },
};

export function textElement(opts: { text: string; preset: TextPreset; design: InvitationDesign; lang: Lang; at?: Point }): TextElement {
  const style = textPreset(opts.preset, opts.design, opts.lang);
  const w = style.w ?? 760;
  const h = (style.size ?? 40) * 1.4;
  const pos = placeAt(w, h, opts.at);
  return makeElement<TextElement>({
    type: "text",
    id: newId(),
    text: opts.text,
    font: "cormorant",
    size: 40,
    color: "#2C2520",
    ...style,
    lang: opts.lang,
    ...pos,
    w,
    h,
  });
}

export function shapeElement(shape: ShapeElement["shape"], design: InvitationDesign, at?: Point): ShapeElement {
  const p = design.palette;
  if (shape === "line") {
    const w = 520;
    const h = 24;
    return makeElement<ShapeElement>({ type: "shape", id: newId(), shape, ...placeAt(w, h, at), w, h, fill: p.accent, strokeWidth: 2 });
  }
  const w = shape === "rect" ? 420 : 320;
  const h = shape === "rect" ? 300 : shape === "arch" ? 400 : 320;
  return makeElement<ShapeElement>({ type: "shape", id: newId(), shape, ...placeAt(w, h, at), w, h, fill: p.surface === p.background ? p.accent : p.surface });
}

export type FrameKind = "rect" | "double" | "round" | "arch" | "oval";

/** A frame around the card (an outline, in foil or a colour). */
export function frameElements(kind: FrameKind, look: { foil: Foil | null; color: string }): ShapeElement[] {
  const make = (inset: number, width: number, shape: ShapeElement["shape"], extra: Partial<ShapeElement> = {}) =>
    makeElement<ShapeElement>({
      type: "shape",
      id: newId(),
      shape,
      x: inset,
      y: inset,
      w: CANVAS_W - inset * 2,
      h: CANVAS_H - inset * 2,
      fill: null,
      stroke: look.foil ? null : look.color,
      strokeFoil: look.foil,
      strokeWidth: width,
      ...extra,
    });
  switch (kind) {
    case "rect":
      return [make(44, 2.5, "rect")];
    case "double": {
      const group = newId();
      return [make(38, 3, "rect", { group }), make(54, 1.2, "rect", { group })];
    }
    case "round":
      return [make(46, 2.2, "rect", { radius: 36 })];
    case "arch":
      return [make(64, 2.2, "arch")];
    case "oval":
      return [make(70, 2, "ellipse")];
  }
}

export function dividerElement(style: DividerElement["style"], color: string, at?: Point, width = 320): DividerElement {
  const h = (width * DIVIDER_SIZE.h) / DIVIDER_SIZE.w;
  return makeElement<DividerElement>({ type: "divider", id: newId(), style, color, ...placeAt(width, h, at), w: width, h });
}

/** The guest's QR code (each guest's own when the cards are sent; a sample here). */
export function qrElement(design: InvitationDesign, at?: Point, width = 230): QrElement {
  const p = design.palette;
  return makeElement<QrElement>({
    type: "qr",
    id: newId(),
    ...placeAt(width, width * 1.14, at ?? { x: CANVAS_W / 2, y: CANVAS_H - 220 }),
    w: width,
    h: width * 1.14,
    style: design.card.qr.style,
    logo: design.card.qr.showLogo,
    fg: p.text,
    plate: "#FFFFFF",
    plateBorder: p.accent,
    caption: design.card.qr.caption || "{scan}",
    captionColor: p.muted,
  });
}

/** Elements dragged from a panel travel as JSON without a position; they get one where they're dropped. */
export const DRAG_TYPE = "application/x-invtra-studio";

export function dragPayload(els: CanvasElement[]): string {
  return JSON.stringify(els);
}
