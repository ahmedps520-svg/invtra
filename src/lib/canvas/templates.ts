import { buildCardSvg, type CardContent, type CardLanguage } from "@/lib/card/build";
import { SAMPLE_GUEST } from "@/lib/card/sample";
import { measure, type TextStyle } from "@/lib/card/text";
import { FONTS, type FontKey } from "@/lib/design/fonts";
import type { InvitationDesign } from "@/lib/design/schema";
import { CARD_PHRASES } from "@/lib/invitation-copy";
import { fmt } from "@/lib/i18n/config";
import type { ThemeDefinition } from "@/lib/themes/types";
import { getAsset } from "./assets";
import { newId } from "./ids";
import { DIVIDER_SIZE, verticalMetrics } from "./render";
import {
  CANVAS_H,
  CANVAS_W,
  DIVIDER_STYLES,
  makeElement,
  type CanvasDoc,
  type CanvasElement,
  type DividerElement,
  type ImageElement,
  type QrElement,
  type ShapeElement,
  type TextElement,
} from "./schema";

/**
 * Turning an INVTRA design into a Studio document: its paper, washes and frames, every painted piece
 * and ornament as its own layer (public/studio/templates/<key>.json, from scripts/stationery/studio.py),
 * and the card's text as separate text layers laid out exactly where the design puts them, with the
 * date, time, place and guest kept as smart fields.
 */

export interface TemplateJson {
  v: 1;
  paper: { c: string; c2: string; m: number; g: number; vig: number };
  washes: { c: string; x: number; y: number; r: number; sx: number; sy: number; o: number; glow: 0 | 1 }[];
  frames: { type: "rect" | "round" | "arch" | "oval"; inset: number; width?: number; foil?: string; color?: string; opacity?: number; radius?: number; top?: number }[];
  layers: { a: string; x: number; y: number; w: number; h: number; r: number; fx?: 1; fy?: 1; c?: [number, number, number, number]; o?: number; b: "m" | "l" | "n" }[];
  box: [number, number, number, number];
}

export function templateUrl(key: string): string {
  return `/studio/templates/${key}.json?v=1`;
}

const FAMILY_TO_KEY = new Map<string, FontKey>(Object.entries(FONTS).map(([k, f]) => [f.family, k as FontKey]));

function decode(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

interface Line {
  role: string;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  family: string;
  size: number;
  weight: number;
  italic: boolean;
  fill: string;
  opacity: number;
  spacing: number;
  rtl: boolean;
}

function parseLines(svg: string): Line[] {
  const out: Line[] = [];
  for (const m of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const a = attrs(m[1]);
    if (!a["data-role"]) continue;
    const size = Number(a["font-size"]);
    out.push({
      role: a["data-role"],
      text: decode(m[2]),
      x: Number(a.x),
      y: Number(a.y),
      anchor: (a["text-anchor"] as Line["anchor"]) ?? "middle",
      family: (a["font-family"] ?? "Jost").replace(/^'|'$/g, ""),
      size,
      weight: Number(a["font-weight"] ?? 400),
      italic: a["font-style"] === "italic",
      fill: a.fill ?? "#000000",
      opacity: a["fill-opacity"] ? Number(a["fill-opacity"]) : 1,
      spacing: a["letter-spacing"] ? Number(a["letter-spacing"]) / size : 0,
      rtl: a.direction === "rtl",
    });
  }
  return out;
}

const upperOf = (s: string) => s.toUpperCase();

/** Put smart fields back where the card shows the event's details. */
function withFields(role: string, text: string, content: CardContent, sampleGuest: string): { text: string; upper: boolean } {
  let t = text;
  let upper = false;
  const swap = (value: string | null | undefined, token: string) => {
    const v = (value ?? "").trim();
    if (!v) return;
    if (t.includes(v)) t = t.split(v).join(token);
    else if (t.includes(upperOf(v)) && upperOf(v) !== v) {
      t = t.split(upperOf(v)).join(token);
      upper = true;
    }
  };
  switch (role) {
    case "date":
      swap(content.date.en, "{date.en}");
      swap(content.date.ar, "{date.ar}");
      break;
    case "time":
      swap(content.time.en, "{time.en}");
      swap(content.time.ar, "{time.ar}");
      break;
    case "venue":
      swap(content.venueName, "{venue.en}");
      swap(content.venueNameAr, "{venue.ar}");
      break;
    case "address":
      swap(content.address, "{address.en}");
      swap(content.addressAr, "{address.ar}");
      break;
    case "guest":
    case "admits":
      swap(sampleGuest, "{guest}");
      for (const lang of ["en", "ar"] as const) {
        const ph = CARD_PHRASES[lang];
        for (const n of ["2", "٢"]) swap(fmt(ph.admits, { n }), "{admits}");
        swap(ph.admitsOne, "{admits}");
      }
      break;
  }
  return { text: t, upper };
}

function textElement(lines: Line[], opts: { centerWidth: number; content: CardContent; sampleGuest: string }): TextElement {
  const first = lines[0];
  const font = FAMILY_TO_KEY.get(first.family) ?? "jost";
  const style: TextStyle = { family: first.family, weight: first.weight, italic: first.italic, size: first.size, letterSpacing: first.spacing };
  const lang = first.rtl ? "ar" : "en";
  const joined = lines.map((l) => l.text).join("\n");
  const fields = withFields(first.role, joined, opts.content, opts.sampleGuest);
  // Fields in the line's own language are written plainly ({date}, not {date.en}).
  const text = fields.text.replace(new RegExp(`\\{(date|time|venue|address)\\.${lang}\\}`, "g"), "{$1}");
  const widest = Math.max(...lines.map((l) => measure(l.text, style)), first.size);
  const leading = lines.length > 1 ? (lines[1].y - lines[0].y) / first.size : 1.25;
  const { ascent } = verticalMetrics(style);
  let w: number;
  let x: number;
  let align: TextElement["align"] = "center";
  if (first.anchor === "middle" || first.rtl) {
    w = Math.max(opts.centerWidth, widest * 1.04);
    x = first.x - w / 2;
  } else {
    w = Math.max(widest * 1.12, 160);
    align = first.anchor === "start" ? "left" : "right";
    x = first.anchor === "start" ? first.x : first.x - w;
  }
  return makeElement<TextElement>({
    type: "text",
    id: newId(),
    x,
    y: first.y - ascent,
    w,
    h: ascent + (lines.length - 1) * leading * first.size + first.size * 0.3,
    text,
    font,
    size: Math.round(first.size * 10) / 10,
    weight: first.weight,
    italic: first.italic,
    color: /^#[0-9a-fA-F]{6}$/.test(first.fill) ? first.fill : "#2C2520",
    align,
    leading: Math.round(leading * 100) / 100,
    spacing: Math.round(first.spacing * 1000) / 1000,
    upper: fields.upper,
    lang,
    opacity: first.opacity,
  });
}

/** The card's text, divider, monogram and QR as Studio layers, laid out as the design draws them. */
export function layoutLayers(opts: {
  theme: ThemeDefinition;
  design: InvitationDesign;
  language: CardLanguage;
  content: CardContent;
}): CanvasElement[] {
  const { theme, design, language, content } = opts;
  const guest = language === "AR" ? SAMPLE_GUEST.ar : SAMPLE_GUEST.en;
  const svg = buildCardSvg({ theme, design, language, content, guest, qrText: null, qrPlaceholder: true, annotate: true });
  const centerWidth = theme.card.art?.content.w ?? 740;
  const lines = parseLines(svg);
  const els: CanvasElement[] = [];
  const p = design.palette;

  // Monogram rings.
  const mono = /<g data-role="monogram">((?:<circle [^>]*\/>)+)/.exec(svg);
  if (mono) {
    for (const c of mono[1].matchAll(/<circle ([^>]*)\/>/g)) {
      const a = attrs(c[1]);
      const r = Number(a.r);
      els.push(
        makeElement<ShapeElement>({
          type: "shape",
          id: newId(),
          shape: "ellipse",
          x: Number(a.cx) - r,
          y: Number(a.cy) - r,
          w: r * 2,
          h: r * 2,
          fill: null,
          stroke: a.stroke ?? p.accent,
          strokeWidth: Number(a["stroke-width"] ?? 1.5),
          opacity: a.opacity ? Number(a.opacity) : 1,
        }),
      );
    }
  }

  // Text: lines of the same block become one layer; the "&" / "و" between names and the couple's
  // names stand alone. The QR's caption joins the QR.
  let captionLine: Line | null = null;
  let group: Line[] = [];
  const flush = () => {
    if (group.length) els.push(textElement(group, { centerWidth, content, sampleGuest: guest.name }));
    group = [];
  };
  for (const line of lines) {
    if (line.role === "caption") {
      captionLine = line;
      continue;
    }
    const alone = line.role === "couple" || line.role === "monogram" || line.text === "&" || line.text === "و";
    const prev = group[group.length - 1];
    const continues = prev && !alone && prev.role === line.role && prev.family === line.family && Math.abs(prev.size - line.size) < 0.01 && prev.anchor === line.anchor;
    if (!continues) flush();
    group.push(line);
    if (alone) flush();
  }
  flush();

  // Divider.
  const div = /<g data-role="divider"><g transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/.exec(svg);
  if (div) {
    const [cx, cy, s] = [Number(div[1]), Number(div[2]), Number(div[3])];
    const style = theme.card.art?.divider && (DIVIDER_STYLES as readonly string[]).includes(theme.card.art.divider) ? theme.card.art.divider : "floral";
    const w = DIVIDER_SIZE.w * s;
    const h = DIVIDER_SIZE.h * s;
    els.push(makeElement<DividerElement>({ type: "divider", id: newId(), style: style as DividerElement["style"], color: p.accent, x: cx - w / 2, y: cy - h / 2, w, h }));
  }

  // QR, with its caption when it sits right under the code.
  const plate = /<g data-role="qr"><rect ([^>]*)\/>/.exec(svg);
  if (plate) {
    const a = attrs(plate[1]);
    const x = Number(a.x);
    const y = Number(a.y);
    const w = Number(a.width);
    const under = captionLine && Math.abs(captionLine.x - (x + w / 2)) < 30;
    els.push(
      makeElement<QrElement>({
        type: "qr",
        id: newId(),
        x,
        y,
        w,
        h: w * (under ? 1.14 : 1),
        style: design.card.qr.style,
        logo: design.card.qr.showLogo,
        fg: p.text,
        plate: p.surface,
        plateBorder: p.accent,
        caption: under ? (design.card.qr.caption || "{scan}") : "",
        captionColor: under && captionLine ? captionLine.fill : p.muted,
        captionFont: under && captionLine && !captionLine.rtl ? (FAMILY_TO_KEY.get(captionLine.family) ?? "jost") : "jost",
      }),
    );
    if (captionLine && !under) {
      const el = textElement([captionLine], { centerWidth, content, sampleGuest: guest.name });
      els.push({ ...el, text: el.text === CARD_PHRASES.en.scan || el.text === CARD_PHRASES.ar.scan ? "{scan}" : el.text });
    }
  }
  return els;
}

/** A design as a Studio document. */
export function templateToCanvas(
  tpl: TemplateJson | null,
  opts: { key: string; theme: ThemeDefinition; design: InvitationDesign; language: CardLanguage; content: CardContent },
): CanvasDoc {
  const p = opts.design.palette;
  const elements: CanvasElement[] = [];
  if (tpl) {
    for (const f of tpl.frames) {
      const inset = f.inset ?? 40;
      const foil = f.foil === "gold" || f.foil === "silver" || f.foil === "rose" ? f.foil : null;
      elements.push(
        makeElement<ShapeElement>({
          type: "shape",
          id: newId(),
          shape: f.type === "arch" ? "arch" : f.type === "oval" ? "ellipse" : "rect",
          x: inset,
          y: f.type === "arch" ? (f.top ?? 60) : inset,
          w: CANVAS_W - inset * 2,
          h: CANVAS_H - inset * 2 - (f.type === "arch" ? (f.top ?? 60) - inset : 0),
          radius: f.type === "round" ? (f.radius ?? 30) : 0,
          fill: null,
          stroke: foil ? null : (f.color ?? "#B08D57"),
          strokeFoil: foil,
          strokeWidth: f.width ?? 1.5,
          opacity: f.opacity ?? 0.9,
          locked: true,
        }),
      );
    }
    for (const L of tpl.layers) {
      const asset = getAsset(L.a);
      if (!asset) continue;
      elements.push(
        makeElement<ImageElement>({
          type: "image",
          id: newId(),
          asset: L.a,
          x: L.x,
          y: L.y,
          w: L.w,
          h: L.h,
          rot: L.r,
          flipX: L.fx === 1,
          flipY: L.fy === 1,
          crop: L.c ?? null,
          opacity: L.o ?? 1,
          print: asset.painted && L.b !== "n",
        }),
      );
    }
  }
  elements.push(...layoutLayers(opts));
  const paper = tpl?.paper;
  return {
    enabled: true,
    source: opts.key,
    bg: {
      color: paper?.c ?? p.background,
      color2: paper && paper.c2 !== paper.c ? paper.c2 : null,
      texture: paper ? Math.min(1, Math.max(0.3, paper.m / 0.02)) : 0.5,
      vignette: paper ? Math.min(1, paper.vig) : 0,
      washes: (tpl?.washes ?? []).map((w) => ({ c: w.c, x: w.x, y: w.y, r: w.r, sx: w.sx, sy: w.sy, o: w.o, glow: w.glow === 1 })),
      image: null,
    },
    elements,
  };
}

/**
 * The event's design with another INVTRA design's look (its palette and typefaces), keeping the
 * event's own wording — what applying a design in the editor does.
 */
export function designForTemplate(theme: ThemeDefinition, design: InvitationDesign): InvitationDesign {
  const t = theme.defaults;
  return {
    ...design,
    palette: t.palette,
    fonts: t.fonts,
    names: { ...t.names, size: design.names.size },
    animation: t.animation,
    card: { ...design.card, qr: { ...design.card.qr, style: t.card.qr.style } },
  };
}
