"use client";

import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Image as ImageIcon,
  LayoutTemplate,
  Layers,
  Lock,
  LockOpen,
  PaintBucket,
  QrCode,
  Search,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { ASSET_CATEGORIES, assetThumb, getAsset, searchAssets, type Asset, type AssetCategory } from "@/lib/canvas/assets";
import {
  DRAG_TYPE,
  PHOTO_FRAMES,
  PRESET_TEXT,
  assetElement,
  dividerElement,
  dragPayload,
  frameElements,
  photoElement,
  photoFrameElement,
  qrElement,
  shapeElement,
  textElement,
  textPreset,
  type FrameKind,
  type Lang,
  type PhotoFrame,
  type TextPreset,
} from "@/lib/canvas/factory";
import { fieldValue, type FieldKey } from "@/lib/canvas/fields";
import { elementLabel, fitElement, moveToIndex, withPaper } from "@/lib/canvas/ops";
import { shapeGeometry, type CanvasRenderContext } from "@/lib/canvas/render";
import { DIVIDER_STYLES, SHAPES, type CanvasDoc, type CanvasElement, type ImageElement } from "@/lib/canvas/schema";
import { designForTemplate, templateToCanvas, templateUrl, type TemplateJson } from "@/lib/canvas/templates";
import { STUDIO_DIVIDERS } from "@/lib/card/ornaments";
import { FONTS } from "@/lib/design/fonts";
import { getTheme } from "@/lib/themes/registry";
import { CardPreview } from "@/components/invitation/card-preview";
import { cn } from "@/lib/utils";
import { ColorButton, Section, Slider } from "./controls";
import { useStudio } from "./studio-context";
import type { PanelKey, StudioUpload } from "./types";

export const PANELS: { key: PanelKey; label: string; icon: ReactNode }[] = [
  { key: "templates", label: "Designs", icon: <LayoutTemplate /> },
  { key: "elements", label: "Elements", icon: <Shapes /> },
  { key: "text", label: "Text", icon: <Type /> },
  { key: "uploads", label: "Photos", icon: <Upload /> },
  { key: "background", label: "Paper", icon: <PaintBucket /> },
  { key: "layers", label: "Layers", icon: <Layers /> },
];

const CATEGORY_NAMES: Record<AssetCategory, string> = {
  flowers: "Flowers",
  bouquets: "Bouquets & wreaths",
  greenery: "Leaves & greenery",
  fruit: "Fruit",
  birds: "Birds & butterflies",
  animals: "Animals",
  toys: "Toys & nursery",
  objects: "Objects",
  gold: "Gold ornaments",
  celebration: "Celebration",
  ramadan: "Ramadan & Eid",
  sky: "Moon, stars & sky",
};

/** Things dragged from a panel onto the card. */
function draggable(make: () => CanvasElement[]) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, dragPayload(make()));
      e.dataTransfer.effectAllowed = "copy";
    },
  };
}

export function PanelHost({ onClose }: { onClose: () => void }) {
  const { panel } = useStudio();
  const title = PANELS.find((p) => p.key === panel)?.label ?? "";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <h2 className="font-display text-[17px] text-ink">{title}</h2>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full text-ink-faint transition hover:bg-sand hover:text-ink" aria-label="Close panel">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {panel === "templates" ? <TemplatesPanel /> : null}
        {panel === "elements" ? <ElementsPanel /> : null}
        {panel === "text" ? <TextPanel /> : null}
        {panel === "uploads" ? <UploadsPanel /> : null}
        {panel === "background" ? <BackgroundPanel /> : null}
        {panel === "layers" ? <LayersPanel /> : null}
      </div>
    </div>
  );
}

// ─────────────────────────── designs ───────────────────────────

const OCCASIONS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "WEDDING", label: "Wedding" },
  { key: "ENGAGEMENT", label: "Engagement" },
  { key: "BIRTHDAY", label: "Birthday" },
  { key: "BABY_SHOWER", label: "Baby shower" },
  { key: "NEWBORN", label: "Newborn" },
  { key: "AQIQAH", label: "Aqiqah" },
  { key: "GRADUATION", label: "Graduation" },
  { key: "HENNA", label: "Henna" },
  { key: "ANNIVERSARY", label: "Anniversary" },
  { key: "RAMADAN", label: "Ramadan & Eid" },
  { key: "CORPORATE", label: "Corporate" },
  { key: "OTHER", label: "Other" },
];

export async function loadTemplate(key: string): Promise<TemplateJson | null> {
  try {
    const res = await fetch(templateUrl(key));
    return res.ok ? ((await res.json()) as TemplateJson) : null;
  } catch {
    return null;
  }
}

/** Every element fitted to its content (text heights and the like) for the editor. */
export function fitAll(doc: CanvasDoc, ctx: CanvasRenderContext): CanvasDoc {
  return { ...doc, elements: doc.elements.map((e) => fitElement(e, ctx)) };
}

function TemplatesPanel() {
  const s = useStudio();
  const [q, setQ] = useState("");
  const [occasion, setOccasion] = useState<string>(s.themes.some((t) => t.occasions.includes(s.event.type)) ? s.event.type : "ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.themes.filter((t) => (occasion === "ALL" || t.occasions.includes(occasion as never)) && (!needle || t.name.toLowerCase().includes(needle) || t.key.includes(needle)));
  }, [q, occasion, s.themes]);
  const present = OCCASIONS.filter((o) => o.key === "ALL" || s.themes.some((t) => t.occasions.includes(o.key as never)));

  const apply = async (key: string) => {
    if (s.doc.elements.length && !window.confirm("Start over from this design? Your changes can be undone with ⌘Z.")) return;
    setBusy(key);
    const theme = getTheme(key);
    const tpl = await loadTemplate(key);
    const doc = templateToCanvas(tpl, { key, theme, design: designForTemplate(theme, s.design), language: s.event.language, content: s.content });
    s.dispatch({ type: "load", doc: fitAll(doc, s.ctx), history: true });
    setBusy(null);
    s.toast(`Started from “${s.themes.find((t) => t.key === key)?.name ?? key}”. Every piece can be moved, changed or removed.`, "success");
  };

  const blank = () => {
    if (s.doc.elements.length && !window.confirm("Start over with a blank card? Your changes can be undone with ⌘Z.")) return;
    const p = s.design.palette;
    const els: CanvasElement[] = s.event.qrOn ? [qrElement(s.design)] : [];
    s.dispatch({ type: "load", doc: fitAll({ enabled: true, source: null, bg: { color: p.background, color2: null, texture: 0.5, vignette: 0, washes: [], image: null }, elements: els }, s.ctx), history: true });
  };

  return (
    <div>
      <Section>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 focus-within:border-bronze-400">
          <Search className="size-4 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
        <div className="-mx-1 mt-2.5 flex flex-wrap gap-1">
          {present.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setOccasion(o.key)}
              className={cn("rounded-full px-2.5 py-1 text-[12px] transition", occasion === o.key ? "bg-ink text-white" : "bg-sand text-ink-soft hover:text-ink")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={blank}
          className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[12.5px] text-ink-soft transition hover:border-bronze-400 hover:text-ink"
        >
          <Sparkles className="size-4" /> Start from a blank card
        </button>
      </Section>
      <div className="grid grid-cols-2 gap-3 p-4 pt-1">
        {list.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => void apply(t.key)}
            disabled={busy !== null}
            className={cn("group text-start disabled:opacity-60", t.key === s.doc.source && "opacity-100")}
            title={`Start from ${t.name}`}
          >
            <span
              className={cn(
                "block overflow-hidden rounded-md shadow-soft ring-1 ring-black/5 transition group-hover:ring-2 group-hover:ring-violet-400",
                t.key === s.doc.source && "ring-2 ring-violet-600",
                busy === t.key && "animate-pulse",
              )}
            >
              <CardPreview themeKey={t.key} language={s.event.language} content={s.content} lazy thumb qrPlaceholder={s.event.qrOn} title={t.name} />
            </span>
            <span className="mt-1 block truncate text-[11.5px] text-ink-soft">{t.name}</span>
          </button>
        ))}
        {!list.length ? <p className="col-span-2 py-6 text-center text-[12.5px] text-ink-faint">No designs match.</p> : null}
      </div>
    </div>
  );
}

// ─────────────────────────── elements ───────────────────────────

function AssetTile({ asset, onAdd }: { asset: Asset; onAdd: (a: Asset) => void }) {
  return (
    <button
      type="button"
      title={asset.name.en}
      aria-label={`Add ${asset.name.en}`}
      onClick={() => onAdd(asset)}
      {...draggable(() => [assetElement(asset)])}
      className="group relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-[#f6f1e8] p-1.5 ring-1 ring-black/5 transition hover:bg-[#efe7da] hover:ring-violet-300"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small static thumbnails */}
      <img src={assetThumb(asset.id)} alt="" loading="lazy" draggable={false} className="max-h-full max-w-full object-contain transition group-hover:scale-105" />
    </button>
  );
}

function ShapeIcon({ shape }: { shape: string }) {
  const geo = shapeGeometry(shape as never, 36, shape === "line" ? 36 : 36, shape === "rect" ? 0 : 0);
  return (
    <svg viewBox="-2 -2 40 40" className="size-9" aria-hidden>
      <g fill={shape === "line" ? "none" : "#c9b092"} stroke="#84664a" strokeWidth={shape === "line" ? 3 : 1.5} dangerouslySetInnerHTML={{ __html: geo }} />
    </svg>
  );
}

function DividerIcon({ style }: { style: (typeof DIVIDER_STYLES)[number] }) {
  const body = STUDIO_DIVIDERS[style]("#84664a")(100, 15, 0.8);
  return <svg viewBox="0 0 200 30" className="h-6 w-full" aria-hidden dangerouslySetInnerHTML={{ __html: body }} />;
}

const FRAME_KINDS: { kind: FrameKind; label: string }[] = [
  { kind: "rect", label: "Fine line" },
  { kind: "double", label: "Double line" },
  { kind: "round", label: "Rounded" },
  { kind: "arch", label: "Arch" },
  { kind: "oval", label: "Oval" },
];

function FrameIcon({ kind }: { kind: FrameKind }) {
  const W = 40;
  const H = 50;
  const body =
    kind === "rect"
      ? `<rect x="4" y="4" width="32" height="42"/>`
      : kind === "double"
        ? `<rect x="3" y="3" width="34" height="44"/><rect x="6.5" y="6.5" width="27" height="37" stroke-width="0.8"/>`
        : kind === "round"
          ? `<rect x="4" y="4" width="32" height="42" rx="5"/>`
          : kind === "arch"
            ? `<path d="M5 46V20A15 15 0 0 1 35 20V46Z"/>`
            : `<ellipse cx="20" cy="25" rx="15" ry="20"/>`;
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-9" aria-hidden><g fill="#fbf7f0" stroke="#b08d57" strokeWidth="1.5" dangerouslySetInnerHTML={{ __html: body }} /></svg>;
}

const PHOTO_FRAME_NAMES: Record<PhotoFrame, string> = { rect: "Rectangle", circle: "Circle", rounded: "Rounded", arch: "Arch", heart: "Heart", star: "Star", diamond: "Diamond" };

function ElementsPanel() {
  const s = useStudio();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<AssetCategory | null>(null);
  const results = useMemo(() => (q.trim() || cat ? searchAssets(q, cat) : []), [q, cat]);
  const at = () => s.visibleCenter();
  const addAsset = (a: Asset) => s.add([assetElement(a, at())]);
  const hasQr = s.doc.elements.some((e) => e.type === "qr");
  const p = s.design.palette;

  if (q.trim() || cat) {
    return (
      <div>
        <Section>
          <SearchBox q={q} setQ={setQ} />
          <button type="button" onClick={() => (setCat(null), setQ(""))} className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] text-ink-soft hover:text-ink">
            <ArrowLeft className="size-3.5" /> All elements
          </button>
          {cat ? <p className="mt-1 font-display text-[16px] text-ink">{CATEGORY_NAMES[cat]}</p> : null}
        </Section>
        <div className="grid grid-cols-3 gap-2 p-4 pt-1">
          {results.map((a) => (
            <AssetTile key={a.id} asset={a} onAdd={addAsset} />
          ))}
          {!results.length ? <p className="col-span-3 py-6 text-center text-[12.5px] text-ink-faint">Nothing found. Try “rose”, “gold”, “moon” or “وردة”.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Section>
        <SearchBox q={q} setQ={setQ} />
      </Section>
      {!hasQr && s.event.qrOn ? (
        <Section>
          <button
            type="button"
            onClick={() => s.add([qrElement(s.design, at())])}
            className="flex w-full items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-start text-[12.5px] text-violet-900 transition hover:bg-violet-100"
          >
            <QrCode className="size-5 shrink-0" />
            <span>
              <span className="block font-medium">Add the guest’s QR code</span>
              <span className="text-violet-800/80">Each guest’s card prints their own code here.</span>
            </span>
          </button>
        </Section>
      ) : null}
      <Section title="Shapes">
        <div className="grid grid-cols-5 gap-1.5">
          {SHAPES.map((sh) => (
            <button
              key={sh}
              type="button"
              title={sh}
              aria-label={`Add ${sh}`}
              onClick={() => s.add([shapeElement(sh, s.design, at())])}
              {...draggable(() => [shapeElement(sh, s.design)])}
              className="grid aspect-square place-items-center rounded-lg bg-[#f6f1e8] ring-1 ring-black/5 transition hover:ring-violet-300"
            >
              <ShapeIcon shape={sh} />
            </button>
          ))}
        </div>
      </Section>
      <Section title="Frames">
        <div className="grid grid-cols-5 gap-1.5">
          {FRAME_KINDS.map((f) => (
            <button
              key={f.kind}
              type="button"
              title={`${f.label} frame`}
              aria-label={`Add a ${f.label.toLowerCase()} frame`}
              onClick={() => s.add(frameElements(f.kind, { foil: "gold", color: p.accent }))}
              {...draggable(() => frameElements(f.kind, { foil: "gold", color: p.accent }))}
              className="grid aspect-[4/5] place-items-center rounded-lg bg-[#f6f1e8] ring-1 ring-black/5 transition hover:ring-violet-300"
            >
              <FrameIcon kind={f.kind} />
            </button>
          ))}
        </div>
      </Section>
      <Section title="Dividers">
        <div className="grid grid-cols-2 gap-1.5">
          {DIVIDER_STYLES.map((d) => (
            <button
              key={d}
              type="button"
              title={`${d} divider`}
              aria-label={`Add a ${d} divider`}
              onClick={() => s.add([dividerElement(d, p.accent, at())])}
              {...draggable(() => [dividerElement(d, p.accent)])}
              className="rounded-lg bg-[#f6f1e8] px-3 py-2 ring-1 ring-black/5 transition hover:ring-violet-300"
            >
              <DividerIcon style={d} />
            </button>
          ))}
        </div>
      </Section>
      <Section title="Photo frames">
        <div className="grid grid-cols-4 gap-1.5">
          {PHOTO_FRAMES.map((f) => (
            <button
              key={f}
              type="button"
              title={`${PHOTO_FRAME_NAMES[f]} photo frame`}
              aria-label={`Add a ${PHOTO_FRAME_NAMES[f].toLowerCase()} photo frame`}
              onClick={() => s.add([photoFrameElement(f, at())])}
              {...draggable(() => [photoFrameElement(f)])}
              className="grid aspect-square place-items-center rounded-lg bg-[#f6f1e8] ring-1 ring-black/5 transition hover:ring-violet-300"
            >
              <svg viewBox="-2 -2 40 40" className="size-8" aria-hidden>
                <g fill="#e6dccb" stroke="#b8a98f" strokeWidth="1.5" strokeDasharray="3 2" dangerouslySetInnerHTML={{ __html: shapeGeometry(f === "circle" ? "ellipse" : f === "rect" ? "rect" : f, 36, 36) }} />
              </svg>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">Add a frame, then choose a photo in Photos (or drop one on it).</p>
      </Section>
      {ASSET_CATEGORIES.map((c) => {
        const items = searchAssets("", c);
        if (!items.length) return null;
        return (
          <Section
            key={c}
            title={CATEGORY_NAMES[c]}
            action={
              <button type="button" onClick={() => setCat(c)} className="text-[12px] font-medium text-violet-700 hover:underline">
                See all {items.length}
              </button>
            }
          >
            <div className="grid grid-cols-3 gap-2">
              {items.slice(0, 6).map((a) => (
                <AssetTile key={a.id} asset={a} onAdd={addAsset} />
              ))}
            </div>
          </Section>
        );
      })}
    </div>
  );
}

function SearchBox({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 focus-within:border-bronze-400">
      <Search className="size-4 text-ink-faint" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flowers, gold, moons…" className="w-full bg-transparent text-[13px] outline-none" />
      {q ? (
        <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="text-ink-faint hover:text-ink">
          <X className="size-3.5" />
        </button>
      ) : null}
    </label>
  );
}

// ─────────────────────────── text ───────────────────────────

const PRESETS: { key: TextPreset; label: string }[] = [
  { key: "title", label: "Names" },
  { key: "heading", label: "Heading" },
  { key: "subheading", label: "Subheading" },
  { key: "body", label: "Body text" },
  { key: "label", label: "Small label" },
  { key: "script", label: "Script accent" },
];

const SMART: { key: FieldKey; label: string; ar: string }[] = [
  { key: "guest", label: "Guest’s name", ar: "اسم الضيف" },
  { key: "admits", label: "Number of guests", ar: "عدد الضيوف" },
  { key: "hosts", label: "Hosts’ names", ar: "أسماء المضيفين" },
  { key: "title", label: "Event title", ar: "عنوان المناسبة" },
  { key: "date", label: "Date", ar: "التاريخ" },
  { key: "time", label: "Time", ar: "الوقت" },
  { key: "venue", label: "Venue", ar: "المكان" },
  { key: "address", label: "Address", ar: "العنوان" },
];

const COMBOS: { label: string; text: Record<Lang, string>; preset: TextPreset }[] = [
  { label: "Dear guest", text: { en: "Dear {guest}", ar: "حضرة {guest}" }, preset: "body" },
  { label: "Date & time", text: { en: "{date}\n{time}", ar: "{date}\n{time}" }, preset: "body" },
  { label: "Venue & address", text: { en: "{venue}\n{address}", ar: "{venue}\n{address}" }, preset: "body" },
  { label: "Admits", text: { en: "{admits}", ar: "{admits}" }, preset: "label" },
];

function TextPanel() {
  const s = useStudio();
  const bilingual = s.event.language === "BILINGUAL";
  const [lang, setLang] = useState<Lang>(s.event.language === "AR" ? "ar" : "en");
  const at = () => s.visibleCenter();
  const addText = (text: string, preset: TextPreset) => {
    s.add([textElement({ text, preset, design: s.design, lang, at: at() })]);
  };
  const values = { content: s.content, guest: s.ctx.guest, digits: s.design.digits };
  return (
    <div>
      <Section>
        <button
          type="button"
          onClick={() => addText(PRESET_TEXT.heading[lang], "heading")}
          {...draggable(() => [textElement({ text: PRESET_TEXT.heading[lang], preset: "heading", design: s.design, lang })])}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-[13px] font-medium text-white shadow-soft transition hover:bg-violet-700"
        >
          <Type className="size-4" /> Add a text box
        </button>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[12px] text-ink-faint">Language of new text</span>
          <div className="inline-flex rounded-lg border border-line bg-sand/60 p-0.5">
            {(["en", "ar"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn("h-7 rounded-md px-2.5 text-[12px] transition", lang === l ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink")}
              >
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>
        {!bilingual && lang !== (s.event.language === "AR" ? "ar" : "en") ? (
          <p className="mt-2 text-[11.5px] text-ochre">This event’s card is {s.event.language === "AR" ? "Arabic" : "English"}; smart fields fill in from its details in either language.</p>
        ) : null}
      </Section>
      <Section title="Text styles">
        <div className="space-y-1.5">
          {PRESETS.map((p) => {
            const st = textPreset(p.key, s.design, lang);
            const family = st.font ? FONTS[st.font].family : "Jost";
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => addText(PRESET_TEXT[p.key][lang], p.key)}
                {...draggable(() => [textElement({ text: PRESET_TEXT[p.key][lang], preset: p.key, design: s.design, lang })])}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-start transition hover:border-violet-300"
                dir={lang === "ar" ? "rtl" : "ltr"}
              >
                <span
                  className="truncate text-ink"
                  style={{
                    fontFamily: `'${family}'`,
                    fontSize: Math.min(28, Math.max(13, (st.size ?? 30) * 0.34)),
                    textTransform: st.upper ? "uppercase" : undefined,
                    letterSpacing: st.spacing ? `${st.spacing}em` : undefined,
                    color: st.color,
                  }}
                >
                  {PRESET_TEXT[p.key][lang]}
                </span>
                <span className="shrink-0 text-[11px] text-ink-faint">{p.label}</span>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Smart text">
        <p className="mb-2.5 text-[11.5px] leading-relaxed text-ink-faint">
          Fills in by itself: each guest’s card gets their own name, and the date, time and place follow the event’s details.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {SMART.map((f) => {
            const sample = fieldValue(f.key, lang, values) || "—";
            const preset: TextPreset = f.key === "guest" || f.key === "hosts" ? "heading" : f.key === "admits" ? "label" : "body";
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => addText(`{${f.key}}`, preset)}
                {...draggable(() => [textElement({ text: `{${f.key}}`, preset, design: s.design, lang })])}
                className="rounded-lg border border-line bg-white px-2.5 py-2 text-start transition hover:border-violet-300"
                title={sample}
              >
                <span className="block text-[12px] font-medium text-ink">{lang === "ar" ? f.ar : f.label}</span>
                <span className="block truncate text-[11px] text-ink-faint" dir="auto">
                  {sample}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COMBOS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => addText(c.text[lang], c.preset)}
              className="rounded-full bg-sand px-2.5 py-1 text-[11.5px] text-ink-soft transition hover:bg-mist hover:text-ink"
            >
              + {c.label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────── photos ───────────────────────────

const KIND_NAMES: Record<string, string> = { STUDIO: "", COVER: "Cover", LOGO: "Logo", BACKGROUND: "Background", CUSTOM_INVITATION: "Artwork" };

/** Fill an image frame with a photo, cropped to cover it without stretching. */
export function fillFrame(el: ImageElement, u: StudioUpload): ImageElement {
  const W = u.width ?? 1080;
  const H = u.height ?? 1350;
  const k = Math.max(el.w / W, el.h / H);
  const fw = Math.min(1, el.w / (W * k));
  const fh = Math.min(1, el.h / (H * k));
  const crop: [number, number, number, number] = [(1 - fw) / 2, (1 - fh) / 2, (1 + fw) / 2, (1 + fh) / 2];
  const full = fw > 0.999 && fh > 0.999;
  return { ...el, asset: null, upload: u.key, crop: full ? null : crop, print: false };
}

function UploadsPanel() {
  const s = useStudio();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const target = s.selected.length === 1 && s.selected[0].type === "image" && !s.selected[0].asset ? (s.selected[0] as ImageElement) : null;
  const files = async (list: FileList | File[]) => {
    const arr = [...list].filter((f) => f.type.startsWith("image/"));
    setBusy((b) => b + arr.length);
    for (const f of arr) {
      const u = await s.upload(f);
      setBusy((b) => b - 1);
      if (u && arr.length === 1) place(u);
    }
  };
  const place = (u: StudioUpload) => {
    if (target) s.update([target.id], (el) => (el.type === "image" ? fillFrame(el, u) : el));
    else s.add([photoElement(u, s.visibleCenter())]);
  };
  const studio = s.uploads.filter((u) => u.kind === "STUDIO");
  const others = s.uploads.filter((u) => u.kind !== "STUDIO");
  return (
    <div>
      <Section>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && void files(e.target.files)} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void files(e.dataTransfer.files);
          }}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-white px-3 py-5 text-center transition hover:border-violet-400"
        >
          <ImagePlus className="size-6 text-violet-600" />
          <span className="text-[13px] font-medium text-ink">{busy ? `Uploading ${busy}…` : "Upload photos"}</span>
          <span className="text-[11.5px] text-ink-faint">JPEG, PNG or WebP up to 15 MB. Transparent PNGs keep their transparency.</span>
        </button>
        {target ? (
          <p className="mt-2.5 rounded-lg bg-violet-50 px-3 py-2 text-[12px] text-violet-900">Choose a photo for the selected {target.upload ? "photo" : "frame"}.</p>
        ) : (
          <p className="mt-2.5 text-[11.5px] text-ink-faint">Tip: drop pictures straight on the card, or paste one with ⌘V.</p>
        )}
      </Section>
      {studio.length ? (
        <Section title="Uploaded in Studio">
          <UploadGrid items={studio} onPick={place} deletable />
        </Section>
      ) : null}
      {others.length ? (
        <Section title="This event’s pictures">
          <UploadGrid items={others} onPick={place} />
        </Section>
      ) : null}
    </div>
  );
}

function UploadGrid({ items, onPick, deletable }: { items: StudioUpload[]; onPick: (u: StudioUpload) => void; deletable?: boolean }) {
  const s = useStudio();
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((u) => (
        <div key={u.id} className="group relative">
          <button
            type="button"
            onClick={() => onPick(u)}
            {...draggable(() => [photoElement(u)])}
            className="block aspect-square w-full overflow-hidden rounded-lg bg-[repeating-conic-gradient(#f1ece3_0_25%,#fff_0_50%)] bg-[length:16px_16px] ring-1 ring-black/5 transition hover:ring-violet-400"
            title="Add to the card"
          >
            {u.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- the event's own uploads (signed URLs)
              <img src={u.url} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="m-auto size-6 text-ink-faint" />
            )}
          </button>
          {KIND_NAMES[u.kind] ? <span className="absolute start-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{KIND_NAMES[u.kind]}</span> : null}
          <div className="absolute end-1.5 top-1.5 hidden gap-1 group-hover:flex">
            <button
              type="button"
              title="Use as the background"
              aria-label="Use as the background"
              onClick={() => s.apply((doc) => ({ ...doc, bg: { ...doc.bg, image: { art: null, upload: u.key, opacity: 1 } } }))}
              className="grid size-7 place-items-center rounded-md bg-white/95 text-ink shadow"
            >
              <PaintBucket className="size-3.5" />
            </button>
            {deletable ? (
              <button
                type="button"
                title="Delete"
                aria-label="Delete this picture"
                onClick={() => {
                  if (window.confirm("Delete this picture? It's also removed from the design.")) void s.deleteUpload(u);
                }}
                className="grid size-7 place-items-center rounded-md bg-white/95 text-rosewood shadow"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────── paper ───────────────────────────

const PAPERS: { name: string; color: string; color2?: string }[] = [
  { name: "Ivory", color: "#FBF7F0" },
  { name: "Cream", color: "#F6EFE3" },
  { name: "Linen", color: "#EFE6D2" },
  { name: "White", color: "#FFFFFF" },
  { name: "Blush", color: "#F4E4E1" },
  { name: "Sage", color: "#E3E9DF" },
  { name: "Mist blue", color: "#DCE6EE" },
  { name: "Lilac", color: "#E8E2EF" },
  { name: "Sand", color: "#E9DCC4", color2: "#E2D2B5" },
  { name: "Champagne", color: "#F3E6CC", color2: "#E8D5AF" },
  { name: "Navy", color: "#1B2A41", color2: "#13202F" },
  { name: "Emerald", color: "#1F3B30", color2: "#152A22" },
  { name: "Burgundy", color: "#5E1F2B", color2: "#43141D" },
  { name: "Midnight", color: "#141B2D", color2: "#0B1020" },
  { name: "Charcoal", color: "#2B2724", color2: "#1C1917" },
  { name: "Black", color: "#121110" },
];

function BackgroundPanel() {
  const s = useStudio();
  const bg = s.doc.bg;
  const setBg = (patch: Partial<typeof bg>, key?: string) => s.apply((doc) => ({ ...doc, bg: { ...doc.bg, ...patch } }), key);
  // Changing the paper keeps the text readable (dark text turns light on dark paper, and back).
  const setPaper = (color: string, color2: string | null, key?: string) => {
    const n = withPaper(s.doc, color, color2).recolored;
    s.apply((doc) => withPaper(doc, color, color2).doc, key);
    if (n && !key) s.toast(`${n} lines of text changed colour to stay readable on this paper (⌘Z to undo).`, "info");
  };
  const artThemes = useMemo(() => {
    const own = s.themes.filter((t) => t.occasions.includes(s.event.type));
    const rest = s.themes.filter((t) => !t.occasions.includes(s.event.type));
    return [...own, ...rest].filter((t) => getTheme(t.key).card.art).slice(0, 120);
  }, [s.themes, s.event.type]);
  return (
    <div>
      <Section title="Paper">
        <div className="grid grid-cols-4 gap-2">
          {PAPERS.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.name}
              aria-label={`${p.name} paper`}
              onClick={() => setPaper(p.color, p.color2 ?? null)}
              className={cn("aspect-[4/5] rounded-md ring-1 ring-black/10 transition hover:scale-105", bg.color.toLowerCase() === p.color.toLowerCase() && "ring-2 ring-violet-600")}
              style={{ background: p.color2 ? `linear-gradient(${p.color}, ${p.color2})` : p.color }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-ink-soft">Colour</span>
          <div className="flex items-center gap-1.5">
            <ColorButton label="Paper colour" value={bg.color} onChange={(c) => c && setPaper(c, bg.color2, "bg-color")} />
            <span className="text-[11px] text-ink-faint">to</span>
            <ColorButton label="Gradient colour" value={bg.color2} allowNone onChange={(c) => setBg({ color2: c }, "bg-color2")} />
          </div>
        </div>
        <Slider label="Paper texture" value={bg.texture} onChange={(v) => setBg({ texture: v }, "bg-texture")} />
        <Slider label="Darker edges" value={bg.vignette} onChange={(v) => setBg({ vignette: v }, "bg-vignette")} />
      </Section>
      <Section
        title="Soft colour washes"
        action={
          bg.washes.length < 8 ? (
            <button
              type="button"
              className="text-[12px] font-medium text-violet-700 hover:underline"
              onClick={() =>
                setBg({ washes: [...bg.washes, { c: s.design.palette.accent, x: 540, y: 300 + bg.washes.length * 180, r: 420, sx: 1.3, sy: 1, o: 0.28, glow: false }] })
              }
            >
              + Add
            </button>
          ) : null
        }
      >
        {bg.washes.length ? (
          <ul className="space-y-2">
            {bg.washes.map((w, i) => (
              <li key={i} className="flex items-center gap-2">
                <ColorButton
                  label="Wash colour"
                  value={w.c}
                  onChange={(c) => c && setBg({ washes: bg.washes.map((x, j) => (j === i ? { ...x, c } : x)) }, `wash-c-${i}`)}
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={w.o}
                  aria-label="Strength"
                  className="flex-1 accent-violet-600"
                  onChange={(e) => setBg({ washes: bg.washes.map((x, j) => (j === i ? { ...x, o: Number(e.target.value) } : x)) }, `wash-o-${i}`)}
                />
                <input
                  type="range"
                  min={60}
                  max={1300}
                  step={10}
                  value={w.y}
                  aria-label="Height on the card"
                  title="Height on the card"
                  className="w-16 accent-violet-600"
                  onChange={(e) => setBg({ washes: bg.washes.map((x, j) => (j === i ? { ...x, y: Number(e.target.value) } : x)) }, `wash-y-${i}`)}
                />
                <button type="button" aria-label="Remove wash" onClick={() => setBg({ washes: bg.washes.filter((_, j) => j !== i) })} className="text-ink-faint hover:text-rosewood">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11.5px] text-ink-faint">Watercolour-like tints on the paper, as INVTRA’s designs have.</p>
        )}
      </Section>
      <Section title="Picture background">
        {bg.image ? (
          <div className="mb-3 space-y-2">
            <Slider label="Picture strength" value={bg.image.opacity} onChange={(v) => setBg({ image: { ...bg.image!, opacity: v } }, "bg-image-o")} />
            <button type="button" onClick={() => setBg({ image: null })} className="w-full rounded-lg border border-line py-1.5 text-[12px] text-ink-soft transition hover:bg-sand">
              Remove the picture
            </button>
          </div>
        ) : (
          <p className="mb-2.5 text-[11.5px] text-ink-faint">A design’s painting behind everything, or a photo (Photos → paint bucket).</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {artThemes.map((t) => {
            const art = getTheme(t.key).card.art!;
            return (
              <button
                key={t.key}
                type="button"
                title={t.name}
                onClick={() => setBg({ image: { art: t.key, upload: null, opacity: 1 } })}
                className={cn("aspect-[4/5] overflow-hidden rounded-md ring-1 ring-black/10 transition hover:ring-violet-400", bg.image?.art === t.key && "ring-2 ring-violet-600")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static design thumbnails */}
                <img src={art.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────── layers ───────────────────────────

const LAYER_TYPE = "application/x-invtra-layer";

function LayerIcon({ el }: { el: CanvasElement }) {
  if (el.type === "image" && el.asset && getAsset(el.asset)) {
    // eslint-disable-next-line @next/next/no-img-element -- small static thumbnails
    return <img src={assetThumb(el.asset)} alt="" className="size-8 object-contain" draggable={false} />;
  }
  const cls = "size-4 text-ink-faint";
  switch (el.type) {
    case "text":
      return <Type className={cls} />;
    case "image":
      return <ImageIcon className={cls} />;
    case "qr":
      return <QrCode className={cls} />;
    case "divider":
      return <Sparkles className={cls} />;
    default:
      return <Shapes className={cls} />;
  }
}

function LayersPanel() {
  const s = useStudio();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const top = [...s.doc.elements].reverse();
  const anchor = useRef<string | null>(null);
  const onRow = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey && anchor.current) {
      const ids = top.map((x) => x.id);
      const a = ids.indexOf(anchor.current);
      const b = ids.indexOf(id);
      s.select(ids.slice(Math.min(a, b), Math.max(a, b) + 1));
    } else if (e.metaKey || e.ctrlKey) {
      s.select(s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id]);
      anchor.current = id;
    } else {
      s.select([id]);
      anchor.current = id;
    }
  };
  const drop = (e: React.DragEvent, row: number) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData(LAYER_TYPE);
    if (!id) return;
    const ids = s.selection.includes(id) ? s.selection : [id];
    // Rows run top to bottom; the stack runs bottom to top. Dropping on a row puts the layers just above it.
    const below = top.slice(row + 1).filter((x) => !ids.includes(x.id)).length;
    s.apply((doc) => moveToIndex(doc, ids, below));
  };
  if (!top.length) return <p className="p-6 text-center text-[12.5px] text-ink-faint">Nothing on the card yet.</p>;
  return (
    <div className="p-2">
      <ul>
        {top.map((el, row) => {
          const selected = s.selection.includes(el.id);
          return (
            <li
              key={el.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(LAYER_TYPE, el.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(LAYER_TYPE)) return;
                e.preventDefault();
                setOver(row);
              }}
              onDragLeave={() => setOver((o) => (o === row ? null : o))}
              onDrop={(e) => drop(e, row)}
              onClick={(e) => onRow(e, el.id)}
              className={cn(
                "group flex h-11 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-[12.5px] transition",
                selected ? "bg-violet-50 text-violet-950" : "hover:bg-sand",
                over === row && "shadow-[inset_0_2px_0_#7c3aed]",
                el.hidden && "opacity-55",
              )}
            >
              <GripVertical className="size-3.5 shrink-0 cursor-grab text-ink-faint/60" />
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#f6f1e8]">
                <LayerIcon el={el} />
              </span>
              {renaming === el.id ? (
                <input
                  autoFocus
                  defaultValue={el.name || elementLabel(el, s.ctx)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    s.patch([el.id], { name: e.target.value.trim().slice(0, 60) });
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="h-7 min-w-0 flex-1 rounded border border-violet-300 px-1.5 outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate" dir="auto" onDoubleClick={() => setRenaming(el.id)} title="Double-click to rename">
                  {elementLabel(el, s.ctx)}
                </span>
              )}
              {el.group ? <span className="rounded bg-sand px-1 text-[10px] text-ink-faint">group</span> : null}
              <button
                type="button"
                aria-label={el.locked ? "Unlock" : "Lock"}
                title={el.locked ? "Unlock" : "Lock"}
                onClick={(e) => {
                  e.stopPropagation();
                  s.patch([el.id], { locked: !el.locked });
                }}
                className={cn("grid size-7 place-items-center rounded-md text-ink-faint hover:bg-white hover:text-ink", !el.locked && "opacity-0 group-hover:opacity-100")}
              >
                {el.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
              </button>
              <button
                type="button"
                aria-label={el.hidden ? "Show" : "Hide"}
                title={el.hidden ? "Show" : "Hide"}
                onClick={(e) => {
                  e.stopPropagation();
                  s.patch([el.id], { hidden: !el.hidden });
                }}
                className={cn("grid size-7 place-items-center rounded-md text-ink-faint hover:bg-white hover:text-ink", !el.hidden && "opacity-0 group-hover:opacity-100")}
              >
                {el.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-2 pb-2 pt-3 text-[11px] text-ink-faint">
        {top.length} layers · drag to reorder · double-click a name to rename
      </p>
    </div>
  );
}
