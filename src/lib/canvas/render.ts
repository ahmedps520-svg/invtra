import type { CardContent, CardImage } from "@/lib/card/build";
import { STUDIO_DIVIDERS } from "@/lib/card/ornaments";
import { escapeXml, isArabic, measure, transformText, wrap, type TextStyle } from "@/lib/card/text";
import { FONTS, nearestWeight } from "@/lib/design/fonts";
import { FONT_METRICS } from "@/lib/fonts/metrics";
import { qrSvgGroup } from "@/lib/qr";
import { getTheme, isThemeKey } from "@/lib/themes/registry";
import { assetSilhouette, assetSrc, assetThumb, isPaintedAsset, PAPER_TEXTURE } from "./asset-urls";
import { fillFields, hasGuestField, type FieldValues } from "./fields";
import {
  CANVAS_H,
  CANVAS_W,
  type CanvasBackground,
  type CanvasDoc,
  type CanvasElement,
  type DividerElement,
  type Foil,
  type ImageElement,
  type QrElement,
  type ShapeElement,
  type TextElement,
} from "./schema";

/**
 * Draws Studio documents as SVG. The same function runs in the editor, in the browser previews and
 * on the server (resvg rasterises the guests' personal cards), so a design prints exactly as it was
 * made: same fonts, same text layout, same effects.
 */

export interface CanvasRenderContext {
  content: CardContent;
  /** The guest the card is for (null: the shared teaser, which leaves guest fields off). */
  guest: { name: string; allowedCount: number } | null;
  /** What the QR encodes; null draws no QR (unless qrPlaceholder). */
  qrText?: string | null;
  /** Draw a sample QR when there's no qrText (the editor and previews). */
  qrPlaceholder?: boolean;
  digits?: "arab" | "latn";
  /** The card's main language (for "{scan}" and other words INVTRA writes). */
  language?: "en" | "ar";
  /** Photos uploaded to the event, by storage key (signed URLs in the browser, data URIs on the server). */
  images?: Record<string, CardImage>;
  /** Draw pieces from their thumbnails (small previews). */
  thumbs?: boolean;
  /** The editor: tag elements with data-id, keep guest-only text and hidden-photo placeholders visible. */
  editor?: boolean;
}

const SAMPLE_QR = "HTTPS://INVTRA.STORE/Q/SAMPLE0000";

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const attr = (v: string) => escapeXml(v);

// ─────────────────────────── colour helpers ───────────────────────────
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function isDark(hex: string): boolean {
  return luminance(hex) < 0.2;
}

const FOIL_STOPS: Record<Foil, string[]> = {
  gold: ["#9E7B41", "#E6CF94", "#C29E5C", "#E9D49C", "#A9874E", "#D9BD7E"],
  silver: ["#8E949C", "#E9ECEF", "#B4BAC2", "#EEF0F2", "#99A0A8", "#D5D9DE"],
  rose: ["#A8735E", "#EBC3AE", "#C8927C", "#F0CDBA", "#AF7B66", "#DDB09B"],
};

/** A foil gradient across a box (diagonal bands, like the printed gold foil). */
function foilGradient(id: string, foil: Foil, x: number, y: number, w: number, h: number): string {
  const stops = FOIL_STOPS[foil];
  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(x)}" y1="${n(y)}" x2="${n(x + w)}" y2="${n(y + h * 0.8)}">` +
    stops.map((c, i) => `<stop offset="${n(i / (stops.length - 1))}" stop-color="${c}"/>`).join("") +
    `</linearGradient>`
  );
}

// ─────────────────────────── text ───────────────────────────
const fontFamily = (key: TextElement["font"]) => FONTS[key].family;

export function hasItalic(family: string, weight: number): boolean {
  return Boolean(FONT_METRICS[`${family}|${nearestWeight(family, weight)}|italic`]);
}

export function textStyleFor(el: Pick<TextElement, "font" | "weight" | "italic" | "size" | "spacing" | "upper" | "lang">): TextStyle {
  const family = fontFamily(el.font);
  const weight = nearestWeight(family, el.weight);
  return {
    family,
    weight,
    italic: el.italic && hasItalic(family, weight),
    size: el.size,
    letterSpacing: el.lang === "ar" ? 0 : el.spacing,
    uppercase: el.upper,
  };
}

export interface TextLayout {
  style: TextStyle;
  lines: string[];
  lineHeight: number;
  ascent: number;
  descent: number;
  /** The text box: the element's width for straight text, the arc's bounds for curved text. */
  width: number;
  height: number;
  rtl: boolean;
  /** Curved text: the baseline arc in box coordinates. */
  arc?: string;
}

/** Ascent and descent of a text style, as the layout uses them (shared with template conversion). */
export function verticalMetrics(style: TextStyle) {
  const nw = nearestWeight(style.family, style.weight);
  const m = FONT_METRICS[`${style.family}|${nw}|${style.italic ? "italic" : "normal"}`] ?? FONT_METRICS[`${style.family}|${nw}|normal`];
  const a = m?.a ?? 0.9;
  const d = m?.d ?? 0.25;
  return { ascent: Math.min(Math.max(a, 0.72), 1.0) * style.size, descent: Math.min(Math.max(d, 0.2), 0.45) * style.size };
}

/** How a text element lays out (after smart fields are filled in). */
export function layoutText(el: TextElement, value: string): TextLayout {
  const style = textStyleFor(el);
  const { ascent, descent } = verticalMetrics(style);
  const rtl = el.lang === "ar" || isArabic(value);
  const lineHeight = el.size * el.leading;
  if (el.curve !== 0) {
    const line = value.replace(/\s*\n\s*/g, " ").trim();
    const length = Math.max(measure(line, style), el.size);
    const phi = (Math.abs(el.curve) / 100) * Math.PI * 1.8;
    const r = length / phi;
    const up = el.curve > 0;
    // Bounds of the band the glyphs occupy, sampled along the arc (angle 0 = top for ∩, bottom for ∪).
    const inner = up ? r - descent : r - ascent;
    const outer = up ? r + ascent : r + descent;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = -phi / 2 + (phi * i) / steps;
      for (const rad of [inner, outer]) {
        const x = rad * Math.sin(t);
        const y = up ? -rad * Math.cos(t) : rad * Math.cos(t);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const sx = -r * Math.sin(phi / 2), sy = (up ? -1 : 1) * r * Math.cos(phi / 2);
    const large = phi > Math.PI ? 1 : 0;
    const arc = `M${n(sx - minX)} ${n(sy - minY)}A${n(r)} ${n(r)} 0 ${large} ${up ? 1 : 0} ${n(-sx - minX)} ${n(sy - minY)}`;
    return { style, lines: [line], lineHeight, ascent, descent, width: maxX - minX, height: maxY - minY, rtl, arc };
  }
  const lines: string[] = [];
  for (const para of value.split("\n")) {
    const p = para.trim();
    if (!p) lines.push("");
    else lines.push(...wrap(p, style, Math.max(el.w, 1)));
  }
  if (!lines.length) lines.push("");
  return { style, lines, lineHeight, ascent, descent, width: el.w, height: ascent + (lines.length - 1) * lineHeight + descent, rtl };
}

export function fieldValues(ctx: CanvasRenderContext): FieldValues {
  return { content: ctx.content, guest: ctx.guest, digits: ctx.digits };
}

/** The text a text element shows for this card (smart fields filled in). */
export function textValue(el: TextElement, ctx: CanvasRenderContext): string {
  return fillFields(el.text, el.lang, fieldValues(ctx));
}

function textEffect(el: TextElement, id: string): { defs: string; attrs: string; under: string } {
  const a = el.effectAmount;
  const s = el.size;
  switch (el.effect) {
    case "shadow":
      return {
        defs: `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="${n(s * 0.05 * a + 1)}" dy="${n(s * 0.06 * a + 1)}" stdDeviation="${n(s * 0.04 * a + 0.5)}" flood-color="${el.effectColor}" flood-opacity="${n(0.25 + 0.45 * a)}"/></filter>`,
        attrs: ` filter="url(#${id})"`,
        under: "",
      };
    case "lift":
      return {
        defs: `<filter id="${id}" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="${n(s * 0.06)}" stdDeviation="${n(s * 0.09)}" flood-color="#000000" flood-opacity="${n(0.12 + 0.3 * a)}"/></filter>`,
        attrs: ` filter="url(#${id})"`,
        under: "",
      };
    case "glow":
      return {
        defs:
          `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">` +
          `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(s * 0.12 * a + 1)}" result="b"/>` +
          `<feFlood flood-color="${el.effectColor}" flood-opacity="${n(0.5 + 0.5 * a)}"/><feComposite in2="b" operator="in" result="g"/>` +
          `<feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
        attrs: ` filter="url(#${id})"`,
        under: "",
      };
    case "outline":
      return { defs: "", attrs: ` stroke="${el.effectColor}" stroke-width="${n(s * 0.07 * a + 0.6)}" stroke-linejoin="round" paint-order="stroke"`, under: "" };
    default:
      return { defs: "", attrs: "", under: "" };
  }
}

function textMarkup(el: TextElement, ctx: CanvasRenderContext): string {
  if (!ctx.editor && !ctx.guest && hasGuestField(el.text)) return "";
  const value = textValue(el, ctx);
  const L = layoutText(el, value);
  const id = `e${el.id}`;
  let defs = "";
  let fill = el.color;
  const curved = Boolean(L.arc);
  const boxW = curved ? L.width : el.w;
  const boxH = L.height;
  // Curved text keeps its centre where the element's box is; straight text hangs from the top.
  const left = curved ? el.x + el.w / 2 - boxW / 2 : el.x;
  const top = curved ? el.y + el.h / 2 - boxH / 2 : el.y;
  const cx = left + boxW / 2;
  const cy = top + boxH / 2;
  if (el.foil) {
    defs += foilGradient(`${id}-f`, el.foil, left, top, boxW, boxH);
    fill = `url(#${id}-f)`;
  }
  const fx = textEffect(el, `${id}-x`);
  defs += fx.defs;
  const s = L.style;
  const ls = !L.rtl && s.letterSpacing ? ` letter-spacing="${n(s.letterSpacing * s.size)}"` : "";
  const font =
    ` font-family="'${attr(s.family)}'" font-size="${n(s.size)}" font-weight="${s.weight}"${s.italic ? ' font-style="italic"' : ""}` +
    ` fill="${fill}"${ls}${L.rtl ? ' direction="rtl" xml:lang="ar"' : ""}${fx.attrs}`;
  let under = "";
  if (el.effect === "highlight") {
    const pad = el.size * 0.32;
    under = `<rect x="${n(left - pad)}" y="${n(top - pad * 0.6)}" width="${n(boxW + pad * 2)}" height="${n(boxH + pad * 1.2)}" rx="${n(pad * 1.6 * el.effectAmount)}" fill="${el.effectColor}"/>`;
  }
  let body = "";
  if (curved) {
    defs += `<path id="${id}-p" d="${L.arc}" transform="translate(${n(left)} ${n(top)})" fill="none"/>`;
    body = `<text${font}><textPath href="#${id}-p" startOffset="50%" text-anchor="middle">${escapeXml(transformText(L.lines[0], s))}</textPath></text>`;
  } else {
    const spans = L.lines
      .map((line, i) => {
        if (!line) return "";
        const t = transformText(line, s);
        const baseline = top + L.ascent + i * L.lineHeight;
        let x: number;
        let anchor: "start" | "middle" | "end";
        if (L.rtl) {
          // Right-to-left text is placed by its measured width (browsers and resvg agree on "middle").
          const w = measure(line, s);
          x = el.align === "left" ? left + w / 2 : el.align === "right" ? left + boxW - w / 2 : cx;
          anchor = "middle";
        } else {
          x = el.align === "left" ? left : el.align === "right" ? left + boxW : cx;
          anchor = el.align === "left" ? "start" : el.align === "right" ? "end" : "middle";
        }
        return `<tspan x="${n(x)}" y="${n(baseline)}" text-anchor="${anchor}">${escapeXml(t)}</tspan>`;
      })
      .join("");
    body = spans ? `<text${font}>${spans}</text>` : "";
  }
  const rot = el.rot ? ` transform="rotate(${n(el.rot)} ${n(cx)} ${n(cy)})"` : "";
  const op = el.opacity < 1 ? ` opacity="${n(el.opacity)}"` : "";
  return `<g${rot}${op}>${defs ? `<defs>${defs}</defs>` : ""}${under}${body}</g>`;
}

// ─────────────────────────── shapes ───────────────────────────
function starPoints(w: number, h: number, points = 5, inner = 0.45): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : inner;
    out.push(`${n(w / 2 + (w / 2) * r * Math.cos(a))},${n(h / 2 + (h / 2) * r * Math.sin(a))}`);
  }
  return out.join(" ");
}

/** A shape's outline in its own box (0…w, 0…h), as SVG markup without paint. */
export function shapeGeometry(shape: ShapeElement["shape"] | "circle" | "rounded", w: number, h: number, radius = 0): string {
  switch (shape) {
    case "rect":
      return `<rect x="0" y="0" width="${n(w)}" height="${n(h)}"${radius ? ` rx="${n(Math.min(radius, w / 2, h / 2))}"` : ""}/>`;
    case "rounded":
      return `<rect x="0" y="0" width="${n(w)}" height="${n(h)}" rx="${n(Math.min(w, h) * 0.12)}"/>`;
    case "ellipse":
    case "circle":
      return `<ellipse cx="${n(w / 2)}" cy="${n(h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"/>`;
    case "line":
      return `<line x1="0" y1="${n(h / 2)}" x2="${n(w)}" y2="${n(h / 2)}"/>`;
    case "triangle":
      return `<polygon points="${n(w / 2)},0 ${n(w)},${n(h)} 0,${n(h)}"/>`;
    case "diamond":
      return `<polygon points="${n(w / 2)},0 ${n(w)},${n(h / 2)} ${n(w / 2)},${n(h)} 0,${n(h / 2)}"/>`;
    case "star":
      return `<polygon points="${starPoints(w, h)}"/>`;
    case "hexagon":
      return `<polygon points="${n(w * 0.25)},0 ${n(w * 0.75)},0 ${n(w)},${n(h / 2)} ${n(w * 0.75)},${n(h)} ${n(w * 0.25)},${n(h)} 0,${n(h / 2)}"/>`;
    case "heart": {
      const p = (x: number, y: number) => `${n((x / 100) * w)} ${n((y / 100) * h)}`;
      return `<path d="M${p(50, 96)}C${p(18, 72)} ${p(0, 52)} ${p(0, 30)}C${p(0, 12)} ${p(14, 0)} ${p(28, 0)}C${p(40, 0)} ${p(47, 8)} ${p(50, 16)}C${p(53, 8)} ${p(60, 0)} ${p(72, 0)}C${p(86, 0)} ${p(100, 12)} ${p(100, 30)}C${p(100, 52)} ${p(82, 72)} ${p(50, 96)}Z"/>`;
    }
    case "arch": {
      const r = Math.min(w / 2, h);
      return `<path d="M0 ${n(h)}V${n(r)}A${n(w / 2)} ${n(r)} 0 0 1 ${n(w)} ${n(r)}V${n(h)}Z"/>`;
    }
  }
}

function shapeMarkup(el: ShapeElement): string {
  const id = `e${el.id}`;
  let defs = "";
  let fill = el.fill ?? "none";
  if (el.foil) {
    defs += foilGradient(`${id}-f`, el.foil, 0, 0, el.w, el.h);
    fill = `url(#${id}-f)`;
  }
  let stroke = el.stroke ?? "none";
  if (el.strokeFoil) {
    defs += foilGradient(`${id}-s`, el.strokeFoil, 0, 0, el.w, el.h);
    stroke = `url(#${id}-s)`;
  }
  const line = el.shape === "line";
  const sw = line ? Math.max(el.strokeWidth, 1) : el.strokeWidth;
  if (line && stroke === "none") stroke = el.foil ? `url(#${id}-f)` : (el.fill ?? "#000000");
  const paint =
    ` fill="${line ? "none" : fill}"` +
    (stroke !== "none" && sw > 0 ? ` stroke="${stroke}" stroke-width="${n(sw)}"${el.dash ? ` stroke-dasharray="${n(sw * 3)} ${n(sw * 2)}"` : ""}${line ? ' stroke-linecap="round"' : ""}` : "");
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const geo = shapeGeometry(el.shape, el.w, el.h, el.radius);
  const t = `${el.rot ? `rotate(${n(el.rot)} ${n(cx)} ${n(cy)}) ` : ""}translate(${n(el.x)} ${n(el.y)})`;
  const op = el.opacity < 1 ? ` opacity="${n(el.opacity)}"` : "";
  return `<g transform="${t}"${op}>${defs ? `<defs>${defs}</defs>` : ""}<g${paint}>${geo}</g></g>`;
}

// ─────────────────────────── dividers ───────────────────────────
/** Natural size of the dividers at scale 1. */
export const DIVIDER_SIZE = { w: 200, h: 30 };

function dividerMarkup(el: DividerElement): string {
  const s = el.w / DIVIDER_SIZE.w;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const body = STUDIO_DIVIDERS[el.style](el.color)(0, 0, s);
  const t = `translate(${n(cx)} ${n(cy)})${el.rot ? ` rotate(${n(el.rot)})` : ""}`;
  const op = el.opacity < 1 ? ` opacity="${n(el.opacity)}"` : "";
  return `<g transform="${t}"${op}>${body}</g>`;
}

// ─────────────────────────── QR ───────────────────────────
export function qrGeometry(el: Pick<QrElement, "w" | "plate" | "caption">) {
  const pad = el.plate ? el.w * 0.06 : 0;
  const q = el.w - pad * 2;
  const capH = el.caption ? el.w * 0.14 : 0;
  return { pad, q, capH, h: el.w + capH };
}

function qrMarkup(el: QrElement, ctx: CanvasRenderContext): string {
  const text = ctx.qrText ?? (ctx.qrPlaceholder ? SAMPLE_QR : null);
  if (!text) return "";
  const g = qrGeometry(el);
  const cx = el.x + el.w / 2;
  const cy = el.y + g.h / 2;
  let body = "";
  if (el.plate) {
    body += `<rect x="0" y="0" width="${n(el.w)}" height="${n(g.h)}" rx="${n(el.w * 0.08)}" fill="${el.plate}"${el.plateBorder ? ` stroke="${el.plateBorder}" stroke-width="${n(Math.max(1.2, el.w * 0.006))}"` : ""}/>`;
  }
  body += qrSvgGroup({ text, size: g.q, style: el.style, fg: el.fg, bg: el.plate ?? "#FFFFFF", logo: el.logo, quietZone: el.plate ? 2 : 3 }, g.pad, g.pad);
  if (el.caption) {
    const lang = /\{scan\}/.test(el.caption) ? (ctx.language ?? "en") : isArabic(el.caption) ? "ar" : "en";
    const caption = fillFields(el.caption, lang, fieldValues(ctx));
    const ar = isArabic(caption);
    const st: TextStyle = ar
      ? { family: FONTS[el.captionFont].family === "Jost" ? "IBM Plex Sans Arabic" : FONTS[el.captionFont].family, weight: 500, size: g.capH * 0.5 }
      : { family: FONTS[el.captionFont].family, weight: 500, size: g.capH * 0.4, uppercase: true, letterSpacing: 0.14 };
    let size = st.size;
    while (size > 4 && measure(caption, { ...st, size }) > g.q) size *= 0.94;
    const fs = { ...st, size };
    const ls = !ar && fs.letterSpacing ? ` letter-spacing="${n(fs.letterSpacing * size)}"` : "";
    body +=
      `<text x="${n(el.w / 2)}" y="${n(g.pad + g.q + g.capH * 0.62)}" font-family="'${attr(fs.family)}'" font-size="${n(size)}" font-weight="${fs.weight}"` +
      ` fill="${el.captionColor}" text-anchor="middle"${ar ? ' direction="rtl" xml:lang="ar"' : ""}${ls}>${escapeXml(transformText(caption, fs))}</text>`;
  }
  const t = `${el.rot ? `rotate(${n(el.rot)} ${n(cx)} ${n(cy)}) ` : ""}translate(${n(el.x)} ${n(el.y)})`;
  const op = el.opacity < 1 ? ` opacity="${n(el.opacity)}"` : "";
  return `<g transform="${t}"${op}>${body}</g>`;
}

// ─────────────────────────── images ───────────────────────────
/** Colour behind printed pieces: the paper's own colour, or white on dark paper and photos. */
export function backingColor(bg: CanvasBackground): string {
  if (bg.image || isDark(bg.color)) return "#FFFFFF";
  return bg.color;
}

function maskShape(el: ImageElement): ShapeElement["shape"] | "circle" | "rounded" | null {
  switch (el.mask) {
    case "circle":
      return "ellipse";
    case "rounded":
      return "rounded";
    case "arch":
    case "heart":
    case "star":
    case "diamond":
      return el.mask;
    default:
      return null;
  }
}

function imageFilter(el: ImageElement, id: string): string {
  const f = el.filters;
  const parts: string[] = [];
  if (f.blur > 0) parts.push(`<feGaussianBlur stdDeviation="${n(f.blur)}"/>`);
  if (f.saturation !== 1) parts.push(`<feColorMatrix type="saturate" values="${n(f.saturation)}"/>`);
  if (f.brightness !== 1 || f.contrast !== 1) {
    const slope = f.brightness * f.contrast;
    const intercept = f.brightness * (0.5 - 0.5 * f.contrast);
    const fn = `type="linear" slope="${n(slope)}" intercept="${n(intercept)}"`;
    parts.push(`<feComponentTransfer><feFuncR ${fn}/><feFuncG ${fn}/><feFuncB ${fn}/></feComponentTransfer>`);
  }
  if (f.tint && f.tintAmount > 0) {
    const a = f.tintAmount;
    const [tr, tg, tb] = rgb(f.tint);
    const row = (t: number, i: number) => [0.299, 0.587, 0.114].map((l, j) => n((i === j ? 1 - a : 0) + a * t * l)).join(" ") + " 0 0";
    parts.push(`<feColorMatrix type="matrix" values="${row(tr, 0)} ${row(tg, 1)} ${row(tb, 2)} 0 0 0 1 0"/>`);
  }
  return parts.length ? `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">${parts.join("")}</filter>` : "";
}

function imageMarkup(el: ImageElement, doc: CanvasDoc, ctx: CanvasRenderContext): string {
  const asset = el.asset ? { id: el.asset, painted: isPaintedAsset(el.asset) } : null;
  const photo = el.upload ? (ctx.images?.[el.upload] ?? null) : null;
  const id = `e${el.id}`;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const t = `translate(${n(cx)} ${n(cy)})${el.rot ? ` rotate(${n(el.rot)})` : ""}`;
  if (!asset && !photo) {
    // A photo frame waiting for its photo (only drawn in the editor).
    if (!ctx.editor) return "";
    const m = maskShape(el) ?? "rect";
    return (
      `<g transform="${t} translate(${n(-el.w / 2)} ${n(-el.h / 2)})"><g fill="#EDE6DA" stroke="#B8A98F" stroke-width="2" stroke-dasharray="10 8">${shapeGeometry(m, el.w, el.h)}</g>` +
      `<path d="M${n(el.w / 2 - 22)} ${n(el.h / 2 + 14)}l14-18 10 12 8-9 12 15z" fill="#B8A98F"/><circle cx="${n(el.w / 2 + 12)}" cy="${n(el.h / 2 - 14)}" r="6" fill="#B8A98F"/></g>`
    );
  }
  const href = asset ? (ctx.thumbs ? assetThumb(asset.id) : assetSrc(asset.id)) : photo!.href;
  const [c0, c1, c2, c3] = el.crop ?? [0, 0, 1, 1];
  const fw = el.w / Math.max(c2 - c0, 0.01);
  const fh = el.h / Math.max(c3 - c1, 0.01);
  const ix = -el.w / 2 - c0 * fw;
  const iy = -el.h / 2 - c1 * fh;
  const box = ` x="${n(ix)}" y="${n(iy)}" width="${n(fw)}" height="${n(fh)}" preserveAspectRatio="none"`;
  let defs = "";
  // Cut to the frame shape, or to the box when part of the picture is shown.
  const shape = maskShape(el) ?? (el.crop ? "rect" : null);
  let clip = "";
  if (shape) {
    // A clip path holds shapes only (no groups), so the shape carries the offset itself.
    const geo = shapeGeometry(shape, el.w, el.h).replace(/^<(\w+)/, `<$1 transform="translate(${n(-el.w / 2)} ${n(-el.h / 2)})"`);
    defs += `<clipPath id="${id}-c">${geo}</clipPath>`;
    clip = ` clip-path="url(#${id}-c)"`;
  }
  const fx = imageFilter(el, `${id}-x`);
  defs += fx;
  let inner = "";
  const printed = el.print && asset?.painted;
  if (printed) {
    const [r, g, b] = rgb(backingColor(doc.bg));
    defs += `<filter id="${id}-b" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${n(r)} 0 0 0 0 ${n(g)} 0 0 0 0 ${n(b)} 0 0 0 1 0"/></filter>`;
    inner += `<image href="${attr(assetSilhouette(asset!.id))}"${box} filter="url(#${id}-b)"/>`;
  }
  inner += `<image href="${attr(href)}"${box}${fx ? ` filter="url(#${id}-x)"` : ""}${printed ? ' style="mix-blend-mode:multiply"' : ""}/>`;
  const flip = el.flipX || el.flipY ? `<g transform="scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})">${inner}</g>` : inner;
  if (el.shadow) {
    const s = el.shadow;
    defs += `<filter id="${id}-s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="${n(s.x)}" dy="${n(s.y)}" stdDeviation="${n(s.blur)}" flood-color="${s.color}" flood-opacity="${n(s.opacity)}"/></filter>`;
  }
  const op = el.opacity < 1 ? ` opacity="${n(el.opacity)}"` : "";
  return (
    `<g transform="${t}"${op}${el.shadow ? ` filter="url(#${id}-s)"` : ""}>${defs ? `<defs>${defs}</defs>` : ""}` +
    `<g${clip}>${flip}</g></g>`
  );
}

// ─────────────────────────── background ───────────────────────────
/** Address of a design's painted artwork, for artwork backgrounds. */
export function artworkSrc(key: string, thumb = false): string | null {
  if (!isThemeKey(key)) return null;
  const art = getTheme(key).card.art;
  return art ? (thumb ? art.thumb : art.src) : null;
}

export function backgroundMarkup(bg: CanvasBackground, ctx: CanvasRenderContext): string {
  let defs = "";
  let out = "";
  if (bg.color2 && bg.color2 !== bg.color) {
    defs += `<linearGradient id="bg-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg.color}"/><stop offset="1" stop-color="${bg.color2}"/></linearGradient>`;
    out += `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg-g)"/>`;
  } else {
    out += `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${bg.color}"/>`;
  }
  bg.washes.forEach((w, i) => {
    defs +=
      `<radialGradient id="bg-w${i}"><stop offset="0" stop-color="${w.c}" stop-opacity="${n(w.o)}"/>` +
      `<stop offset="0.5" stop-color="${w.c}" stop-opacity="${n(w.o * 0.38)}"/><stop offset="1" stop-color="${w.c}" stop-opacity="0"/></radialGradient>`;
    out += `<ellipse cx="${n(w.x)}" cy="${n(w.y)}" rx="${n(w.r * w.sx)}" ry="${n(w.r * w.sy)}" fill="url(#bg-w${i})" style="mix-blend-mode:${w.glow ? "screen" : "multiply"}"/>`;
  });
  let pictured = false;
  if (bg.image) {
    const art = bg.image.art ? artworkSrc(bg.image.art, ctx.thumbs) : null;
    const photo = bg.image.upload ? ctx.images?.[bg.image.upload] : null;
    const href = art ?? photo?.href;
    if (href) {
      pictured = true;
      out += `<image href="${attr(href)}" x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}" preserveAspectRatio="xMidYMid slice"${bg.image.opacity < 1 ? ` opacity="${n(bg.image.opacity)}"` : ""}/>`;
    }
  }
  if (bg.texture > 0 && !pictured) {
    out += `<image href="${attr(PAPER_TEXTURE)}" x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}" preserveAspectRatio="none" opacity="${n(bg.texture)}" style="mix-blend-mode:multiply"/>`;
  }
  if (bg.vignette > 0) {
    const v = bg.vignette;
    defs +=
      `<radialGradient id="bg-v" cx="0.5" cy="0.5" r="0.71"><stop offset="0.39" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="0.71" stop-color="#000" stop-opacity="${n(0.28 * v)}"/><stop offset="1" stop-color="#000" stop-opacity="${n(0.79 * v)}"/></radialGradient>`;
    out += `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg-v)"/>`;
  }
  return (defs ? `<defs>${defs}</defs>` : "") + out;
}

// ─────────────────────────── documents ───────────────────────────
/** One element's markup (with its own defs), or "" when it isn't drawn on this card. */
export function elementMarkup(el: CanvasElement, doc: CanvasDoc, ctx: CanvasRenderContext): string {
  if (el.hidden) return "";
  switch (el.type) {
    case "text":
      return textMarkup(el, ctx);
    case "image":
      return imageMarkup(el, doc, ctx);
    case "shape":
      return shapeMarkup(el);
    case "divider":
      return dividerMarkup(el);
    case "qr":
      return qrMarkup(el, ctx);
  }
}

/** The whole card as an SVG document (1080 × 1350). */
export function buildCanvasSvg(doc: CanvasDoc, ctx: CanvasRenderContext): string {
  let body = backgroundMarkup(doc.bg, ctx);
  for (const el of doc.elements) {
    const m = elementMarkup(el, doc, ctx);
    if (m) body += ctx.editor ? `<g data-id="${el.id}">${m}</g>` : m;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="${CANVAS_W}" height="${CANVAS_H}">${body}</svg>`;
}

/** The box an element actually occupies (text and QR heights follow their content). */
export function elementSize(el: CanvasElement, ctx: CanvasRenderContext): { w: number; h: number } {
  if (el.type === "text") {
    const L = layoutText(el, textValue(el, ctx));
    return { w: L.arc ? L.width : el.w, h: L.height };
  }
  if (el.type === "qr") return { w: el.w, h: qrGeometry(el).h };
  if (el.type === "divider") return { w: el.w, h: (el.w * DIVIDER_SIZE.h) / DIVIDER_SIZE.w };
  return { w: el.w, h: el.h };
}
