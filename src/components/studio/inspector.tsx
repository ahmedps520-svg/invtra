"use client";

import { useMemo, useRef, type ReactNode } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Italic,
  Lock,
  LockOpen,
  Trash2,
  Ungroup,
  CaseUpper,
  TriangleAlert,
} from "lucide-react";
import { getAsset } from "@/lib/canvas/assets";
import { FIELDS } from "@/lib/canvas/fields";
import { elementLabel } from "@/lib/canvas/ops";
import { hasItalic, layoutText, textValue } from "@/lib/canvas/render";
import { DIVIDER_STYLES, MASKS, QR_ELEMENT_STYLES, SHAPES, TEXT_EFFECTS, type CanvasElement, type DividerElement, type ImageElement, type QrElement, type ShapeElement, type TextElement } from "@/lib/canvas/schema";
import { FONT_WEIGHTS, FONTS } from "@/lib/design/fonts";
import { measure } from "@/lib/card/text";
import { cn } from "@/lib/utils";
import { useActions } from "./actions";
import { ColorButton, FontPicker, IconToggle, NumberField, Row, Section, Seg, Slider } from "./controls";
import { useStudio } from "./studio-context";

const TYPE_NAMES: Record<CanvasElement["type"], string> = { text: "Text", image: "Picture", shape: "Shape", divider: "Divider", qr: "QR code" };

/** Colours used in the design (offered first in colour pickers). */
function useDocColors(): string[] {
  const { doc, design } = useStudio();
  return useMemo(() => {
    const set = new Set<string>();
    const add = (c: string | null | undefined) => c && set.add(c.toUpperCase());
    const p = design.palette;
    [p.text, p.accent, p.muted, p.surface, p.background].forEach(add);
    add(doc.bg.color);
    for (const e of doc.elements) {
      if (e.type === "text") add(e.color);
      if (e.type === "shape") {
        add(e.fill);
        add(e.stroke);
      }
      if (e.type === "divider") add(e.color);
    }
    return [...set].slice(0, 16);
  }, [doc, design]);
}

export function Inspector() {
  const s = useStudio();
  const sel = s.selected;
  if (!sel.length) return <CardInspector />;
  return sel.length === 1 ? <SingleInspector el={sel[0]} /> : <MultiInspector />;
}

function Header({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
      <h2 className="min-w-0 truncate font-display text-[17px] text-ink">{title}</h2>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}

function CommonActions() {
  const s = useStudio();
  const a = useActions();
  const locked = s.selected.every((e) => e.locked);
  const hidden = s.selected.every((e) => e.hidden);
  return (
    <>
      <IconToggle title={locked ? "Unlock" : "Lock"} active={locked} onClick={a.toggleLock}>
        {locked ? <Lock /> : <LockOpen />}
      </IconToggle>
      <IconToggle title={hidden ? "Show" : "Hide"} active={hidden} onClick={a.toggleHidden}>
        {hidden ? <EyeOff /> : <Eye />}
      </IconToggle>
      <IconToggle title="Duplicate" onClick={a.duplicate} disabled={locked}>
        <Copy />
      </IconToggle>
      <IconToggle title="Delete" onClick={a.remove} disabled={locked}>
        <Trash2 />
      </IconToggle>
    </>
  );
}

function SingleInspector({ el }: { el: CanvasElement }) {
  const s = useStudio();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header title={TYPE_NAMES[el.type]}>
        <CommonActions />
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {el.locked ? (
          <div className="m-4 flex items-start gap-2 rounded-lg bg-sand px-3 py-2.5 text-[12px] text-ink-soft">
            <Lock className="mt-0.5 size-3.5 shrink-0" /> Locked, so it can’t be moved or changed by accident. Unlock it to edit.
          </div>
        ) : null}
        <fieldset disabled={el.locked} className="min-w-0 disabled:opacity-60">
          <Section title="Name">
            <input
              key={el.id}
              defaultValue={el.name}
              placeholder={elementLabel({ ...el, name: "" }, s.ctx)}
              onBlur={(e) => e.target.value !== el.name && s.patch([el.id], { name: e.target.value.trim().slice(0, 60) })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="h-8 w-full rounded-lg border border-line px-2.5 text-[12.5px] outline-none focus:border-bronze-400"
              aria-label="Layer name"
            />
          </Section>
          {el.type === "text" ? <TextControls els={[el]} /> : null}
          {el.type === "image" ? <ImageControls el={el} /> : null}
          {el.type === "shape" ? <ShapeControls el={el} /> : null}
          {el.type === "divider" ? <DividerControls el={el} /> : null}
          {el.type === "qr" ? <QrControls el={el} /> : null}
          <Arrange el={el} />
        </fieldset>
      </div>
    </div>
  );
}

function MultiInspector() {
  const s = useStudio();
  const a = useActions();
  const sel = s.selected;
  const texts = sel.filter((e): e is TextElement => e.type === "text");
  const grouped = sel.some((e) => e.group);
  const opacity = sel[0].opacity;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header title={`${sel.length} selected`}>
        <CommonActions />
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Section title="Group">
          <div className="flex gap-2">
            <button type="button" onClick={a.group} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-[12.5px] transition hover:border-violet-300">
              <Group className="size-3.5" /> Group
            </button>
            {grouped ? (
              <button type="button" onClick={a.ungroup} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-[12.5px] transition hover:border-violet-300">
                <Ungroup className="size-3.5" /> Ungroup
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-faint">Grouped things are picked and moved together. ⌘-click picks one inside a group.</p>
        </Section>
        <Section title="Line up">
          <AlignButtons onAlign={a.align} />
          <div className="mt-2 flex gap-1.5">
            <IconToggle title="Space evenly across" onClick={() => a.distribute("h")} disabled={sel.length < 3}>
              <AlignHorizontalSpaceAround />
            </IconToggle>
            <IconToggle title="Space evenly down" onClick={() => a.distribute("v")} disabled={sel.length < 3}>
              <AlignVerticalSpaceAround />
            </IconToggle>
            <span className="ms-1 self-center text-[11.5px] text-ink-faint">to each other</span>
          </div>
          <p className="mb-1.5 mt-3 text-[11.5px] text-ink-faint">On the card, together</p>
          <AlignButtons onAlign={a.alignToPage} />
        </Section>
        {texts.length === sel.length ? <TextControls els={texts} /> : null}
        <Section title="Layer">
          <ArrangeButtons />
          <Slider label="Transparency" value={opacity} onChange={(v) => s.patch(s.selection, { opacity: v }, "opacity")} format={(v) => `${Math.round((1 - v) * 100)}%`} />
        </Section>
      </div>
    </div>
  );
}

function AlignButtons({ onAlign }: { onAlign: (edge: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void }) {
  return (
    <div className="flex gap-1.5">
      <IconToggle title="Align left" onClick={() => onAlign("left")}>
        <AlignStartVertical />
      </IconToggle>
      <IconToggle title="Centre" onClick={() => onAlign("hcenter")}>
        <AlignCenterVertical />
      </IconToggle>
      <IconToggle title="Align right" onClick={() => onAlign("right")}>
        <AlignEndVertical />
      </IconToggle>
      <IconToggle title="Align top" onClick={() => onAlign("top")}>
        <AlignStartHorizontal />
      </IconToggle>
      <IconToggle title="Middle" onClick={() => onAlign("vcenter")}>
        <AlignCenterHorizontal />
      </IconToggle>
      <IconToggle title="Align bottom" onClick={() => onAlign("bottom")}>
        <AlignEndHorizontal />
      </IconToggle>
    </div>
  );
}

function ArrangeButtons() {
  const a = useActions();
  return (
    <div className="mb-2 flex gap-1.5">
      <IconToggle title="Bring to front" onClick={() => a.arrange("front")}>
        <ArrowUpToLine />
      </IconToggle>
      <IconToggle title="Bring forward" onClick={() => a.arrange("forward")}>
        <ChevronUp />
      </IconToggle>
      <IconToggle title="Send backward" onClick={() => a.arrange("backward")}>
        <ChevronDown />
      </IconToggle>
      <IconToggle title="Send to back" onClick={() => a.arrange("back")}>
        <ArrowDownToLine />
      </IconToggle>
    </div>
  );
}

function Arrange({ el }: { el: CanvasElement }) {
  const s = useStudio();
  const a = useActions();
  const set = (p: Record<string, number>, key: string) => s.patch([el.id], p, key);
  const ratio = el.w / el.h;
  const autoH = el.type === "text" || el.type === "qr" || el.type === "divider";
  const keep = el.type === "image" || el.type === "qr" || el.type === "divider";
  return (
    <>
      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="X" value={el.x} onChange={(v) => set({ x: v }, "x")} />
          <NumberField label="Y" value={el.y} onChange={(v) => set({ y: v }, "y")} />
          <NumberField
            label="W"
            value={el.w}
            min={1}
            max={8000}
            onChange={(v) => {
              const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
              const h = keep ? v / ratio : el.h;
              s.patch([el.id], { w: v, h, x: c.x - v / 2, y: autoH ? el.y : c.y - h / 2 }, "w");
            }}
          />
          <NumberField
            label="H"
            value={el.h}
            min={1}
            max={8000}
            onChange={(v) => {
              if (autoH) return;
              const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
              const w = keep ? v * ratio : el.w;
              s.patch([el.id], { h: v, w, x: c.x - w / 2, y: c.y - v / 2 }, "h");
            }}
            className={autoH ? "opacity-60" : undefined}
          />
          <NumberField label="↻" value={el.rot} min={-180} max={180} suffix="°" onChange={(v) => set({ rot: v }, "rot")} />
          <button
            type="button"
            onClick={() => set({ rot: 0 }, "rot0")}
            disabled={!el.rot}
            className="h-8 rounded-lg border border-line bg-white text-[12px] text-ink-soft transition hover:border-violet-300 disabled:opacity-40"
          >
            Straighten
          </button>
        </div>
        <p className="mb-1.5 mt-3 text-[11.5px] text-ink-faint">On the card</p>
        <AlignButtons onAlign={a.alignToPage} />
      </Section>
      <Section title="Layer">
        <ArrangeButtons />
        <Slider label="Transparency" value={el.opacity} onChange={(v) => set({ opacity: v }, "opacity")} format={(v) => `${Math.round((1 - v) * 100)}%`} />
      </Section>
    </>
  );
}

// ─────────────────────────── text ───────────────────────────

const FIELD_LABELS: Record<string, string> = { guest: "Guest", admits: "Admits", hosts: "Hosts", title: "Title", date: "Date", time: "Time", venue: "Venue", address: "Address" };

function TextControls({ els }: { els: TextElement[] }) {
  const s = useStudio();
  const colors = useDocColors();
  const el = els[0];
  const ids = els.map((e) => e.id);
  const set = (p: Partial<TextElement>, key?: string) => s.patch(ids, p, key);
  const area = useRef<HTMLTextAreaElement>(null);
  const family = FONTS[el.font].family;
  const weights = FONT_WEIGHTS[family] ?? [400];
  const italicOk = hasItalic(family, el.weight);
  const single = els.length === 1;
  const insert = (token: string) => {
    const t = area.current;
    const text = el.text;
    const start = t?.selectionStart ?? text.length;
    const end = t?.selectionEnd ?? text.length;
    set({ text: text.slice(0, start) + token + text.slice(end) });
    requestAnimationFrame(() => {
      t?.focus();
      t?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const setCurve = (curve: number) => {
    if (curve === 0 && el.curve !== 0) {
      // Back to a straight line: wide enough for the words on one line.
      const value = textValue({ ...el, curve: 0 }, s.ctx);
      const L = layoutText({ ...el, curve: 0, w: 4000 }, value);
      const w = Math.min(1040, Math.max(...L.lines.map((l) => measure(l, L.style)), el.size) * 1.08);
      const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
      set({ curve, w, x: c.x - w / 2 }, "curve");
    } else set({ curve }, "curve");
  };
  return (
    <>
      {single ? (
        <Section title="Text">
          <textarea
            ref={area}
            value={el.text}
            onChange={(e) => set({ text: e.target.value }, `text:${el.id}`)}
            dir={el.lang === "ar" ? "rtl" : "auto"}
            rows={Math.min(6, Math.max(2, el.text.split("\n").length + 1))}
            className="w-full resize-y rounded-lg border border-line px-2.5 py-2 text-[13px] leading-relaxed outline-none focus:border-bronze-400"
            aria-label="Text"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => insert(`{${f}}`)}
                title={`Insert the ${FIELD_LABELS[f].toLowerCase()} (fills in by itself)`}
                className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-800 transition hover:bg-violet-100"
              >
                {`{${FIELD_LABELS[f]}}`}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            Smart text in braces fills in for every guest. Add <code>.ar</code> or <code>.en</code> for the other language, e.g. <code>{"{date.ar}"}</code>.
          </p>
        </Section>
      ) : null}
      <Section title="Typeface">
        <FontPicker value={el.font} lang={el.lang} onChange={(font) => set({ font })} />
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
          <NumberField label="Size" value={el.size} min={6} max={600} precision={1} onChange={(size) => set({ size }, "size")} />
          <select
            value={el.weight}
            onChange={(e) => set({ weight: Number(e.target.value) })}
            className="h-8 rounded-lg border border-line bg-white px-2 text-[12.5px] outline-none"
            aria-label="Weight"
            disabled={weights.length < 2}
          >
            {weights.map((w) => (
              <option key={w} value={w}>
                {w === 300 ? "Light" : w === 400 ? "Regular" : w === 500 ? "Medium" : w === 600 ? "Semibold" : w === 700 ? "Bold" : w}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <ColorButton label="Text colour" value={el.color} foil={el.foil} docColors={colors} onChange={(c) => c && set({ color: c, foil: null }, "color")} onFoil={(foil) => set({ foil })} />
          <Seg
            value={el.align}
            onChange={(align) => set({ align })}
            options={[
              { value: "left", icon: <AlignLeft />, title: "Align left" },
              { value: "center", icon: <AlignCenter />, title: "Centre" },
              { value: "right", icon: <AlignRight />, title: "Align right" },
            ]}
          />
          <IconToggle title="Capitals" active={el.upper} onClick={() => set({ upper: !el.upper })}>
            <CaseUpper />
          </IconToggle>
          <IconToggle title={italicOk || el.italic ? "Italic" : "No italic in this typeface"} active={el.italic} disabled={!italicOk && !el.italic} onClick={() => set({ italic: !el.italic })}>
            <Italic />
          </IconToggle>
        </div>
        <Row label="Language" className="mt-1">
          <Seg
            value={el.lang}
            onChange={(lang) => set({ lang })}
            options={[
              { value: "en", label: "English", title: "English (left to right)" },
              { value: "ar", label: "العربية", title: "Arabic (right to left)" },
            ]}
          />
        </Row>
        <Slider label="Line spacing" value={el.leading} min={0.6} max={3} step={0.05} format={(v) => v.toFixed(2)} onChange={(leading) => set({ leading }, "leading")} />
        {el.lang === "en" ? (
          <Slider label="Letter spacing" value={el.spacing} min={-0.1} max={1.5} step={0.01} format={(v) => v.toFixed(2)} onChange={(spacing) => set({ spacing }, "spacing")} />
        ) : null}
        {single ? <Slider label="Curve" value={el.curve} min={-100} max={100} step={1} format={(v) => (v === 0 ? "Straight" : `${v > 0 ? "∩" : "∪"} ${Math.abs(v)}`)} onChange={setCurve} /> : null}
      </Section>
      <Section title="Effect">
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_EFFECTS.map((fx) => (
            <button
              key={fx}
              type="button"
              onClick={() => set({ effect: fx, effectColor: fx === "glow" ? "#FFF4D6" : fx === "highlight" ? "#F3E7DA" : fx === "outline" ? "#FFFFFF" : el.effectColor })}
              className={cn("h-8 rounded-lg border text-[12px] capitalize transition", el.effect === fx ? "border-violet-400 bg-violet-50 text-violet-900" : "border-line bg-white text-ink-soft hover:border-line-strong")}
            >
              {fx === "none" ? "None" : fx}
            </button>
          ))}
        </div>
        {el.effect !== "none" ? (
          <div className="mt-2 space-y-1">
            {el.effect !== "lift" ? (
              <Row label="Colour">
                <ColorButton label="Effect colour" value={el.effectColor} docColors={colors} onChange={(c) => c && set({ effectColor: c }, "fx-color")} />
              </Row>
            ) : null}
            <Slider label={el.effect === "highlight" ? "Roundness" : "Strength"} value={el.effectAmount} onChange={(effectAmount) => set({ effectAmount }, "fx-amount")} />
          </div>
        ) : null}
      </Section>
    </>
  );
}

// ─────────────────────────── pictures ───────────────────────────

const MASK_NAMES: Record<(typeof MASKS)[number], string> = { none: "None", circle: "Circle", rounded: "Rounded", arch: "Arch", heart: "Heart", star: "Star", diamond: "Diamond" };

function ImageControls({ el }: { el: ImageElement }) {
  const s = useStudio();
  const colors = useDocColors();
  const asset = getAsset(el.asset);
  const set = (p: Partial<ImageElement>, key?: string) => s.patch([el.id], p, key);
  const f = el.filters;
  const setF = (p: Partial<ImageElement["filters"]>, key: string) => set({ filters: { ...f, ...p } }, key);
  return (
    <>
      <Section title={asset ? asset.name.en : el.upload ? "Photo" : "Photo frame"}>
        {!asset && !el.upload ? (
          <button type="button" onClick={() => s.setPanel("uploads")} className="mb-2 w-full rounded-lg bg-violet-600 py-2 text-[12.5px] font-medium text-white transition hover:bg-violet-700">
            Choose a photo for this frame
          </button>
        ) : null}
        {el.upload ? (
          <button type="button" onClick={() => s.setPanel("uploads")} className="mb-2 w-full rounded-lg border border-line bg-white py-1.5 text-[12.5px] text-ink-soft transition hover:border-violet-300">
            Replace the photo
          </button>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <IconToggle title="Flip horizontally" active={el.flipX} onClick={() => set({ flipX: !el.flipX })}>
            <FlipHorizontal2 />
          </IconToggle>
          <IconToggle title="Flip vertically" active={el.flipY} onClick={() => set({ flipY: !el.flipY })}>
            <FlipVertical2 />
          </IconToggle>
          {el.crop ? (
            <button
              type="button"
              onClick={() => {
                const [c0, c1, c2, c3] = el.crop!;
                const w = el.w / (c2 - c0);
                const h = el.h / (c3 - c1);
                const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
                set({ crop: null, w, h, x: c.x - w / 2, y: c.y - h / 2 });
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[12px] text-ink-soft transition hover:border-violet-300"
            >
              <Crop className="size-3.5" /> Show all of it
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">Drag the side handles to crop; the corners resize.</p>
        {asset?.painted ? (
          <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
            <input type="checkbox" checked={el.print} onChange={(e) => set({ print: e.target.checked })} className="mt-0.5 accent-violet-600" />
            <span>
              <span className="block text-[12.5px] font-medium text-ink">Printed on the paper</span>
              <span className="block text-[11.5px] leading-relaxed text-ink-faint">Hides what’s beneath and keeps the watercolour true, on light and dark paper alike.</span>
            </span>
          </label>
        ) : null}
      </Section>
      <Section title="Shape">
        <div className="grid grid-cols-4 gap-1.5">
          {MASKS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ mask: m })}
              className={cn("h-8 rounded-lg border text-[11.5px] transition", el.mask === m ? "border-violet-400 bg-violet-50 text-violet-900" : "border-line bg-white text-ink-soft hover:border-line-strong")}
            >
              {MASK_NAMES[m]}
            </button>
          ))}
        </div>
      </Section>
      <Section
        title="Adjust"
        action={
          f.brightness !== 1 || f.contrast !== 1 || f.saturation !== 1 || f.blur || f.tintAmount ? (
            <button type="button" className="text-[12px] text-violet-700 hover:underline" onClick={() => set({ filters: { brightness: 1, contrast: 1, saturation: 1, tint: null, tintAmount: 0, blur: 0 } })}>
              Reset
            </button>
          ) : null
        }
      >
        <Slider label="Brightness" value={f.brightness} min={0.2} max={2} onChange={(v) => setF({ brightness: v }, "brightness")} format={(v) => `${Math.round((v - 1) * 100)}`} />
        <Slider label="Contrast" value={f.contrast} min={0.2} max={2} onChange={(v) => setF({ contrast: v }, "contrast")} format={(v) => `${Math.round((v - 1) * 100)}`} />
        <Slider label="Colour" value={f.saturation} min={0} max={2} onChange={(v) => setF({ saturation: v }, "saturation")} format={(v) => (v === 0 ? "Black & white" : `${Math.round((v - 1) * 100)}`)} />
        <Slider label="Soften" value={f.blur} min={0} max={20} step={0.5} onChange={(v) => setF({ blur: v }, "blur")} format={(v) => v.toFixed(1)} />
        <Row label="Tint">
          <ColorButton label="Tint colour" value={f.tint} allowNone docColors={colors} onChange={(c) => setF({ tint: c, tintAmount: c ? Math.max(f.tintAmount, 0.5) : 0 }, "tint")} />
        </Row>
        {f.tint ? <Slider label="Tint strength" value={f.tintAmount} onChange={(v) => setF({ tintAmount: v }, "tint-amount")} /> : null}
      </Section>
      <Section
        title="Shadow"
        action={
          <input
            type="checkbox"
            aria-label="Shadow"
            checked={Boolean(el.shadow)}
            onChange={(e) => set({ shadow: e.target.checked ? { color: "#3A2E22", blur: 14, x: 0, y: 10, opacity: 0.3 } : null })}
            className="accent-violet-600"
          />
        }
      >
        {el.shadow ? (
          <>
            <Row label="Colour">
              <ColorButton label="Shadow colour" value={el.shadow.color} onChange={(c) => c && set({ shadow: { ...el.shadow!, color: c } }, "sh-c")} />
            </Row>
            <Slider label="Softness" value={el.shadow.blur} min={0} max={60} step={1} format={(v) => `${v}`} onChange={(v) => set({ shadow: { ...el.shadow!, blur: v } }, "sh-b")} />
            <Slider label="Distance" value={el.shadow.y} min={-80} max={80} step={1} format={(v) => `${v}`} onChange={(v) => set({ shadow: { ...el.shadow!, y: v } }, "sh-y")} />
            <Slider label="Sideways" value={el.shadow.x} min={-80} max={80} step={1} format={(v) => `${v}`} onChange={(v) => set({ shadow: { ...el.shadow!, x: v } }, "sh-x")} />
            <Slider label="Strength" value={el.shadow.opacity} onChange={(v) => set({ shadow: { ...el.shadow!, opacity: v } }, "sh-o")} />
          </>
        ) : (
          <p className="text-[11.5px] text-ink-faint">A soft shadow, as if the piece sat on the paper.</p>
        )}
      </Section>
    </>
  );
}

// ─────────────────────────── shapes ───────────────────────────

function ShapeControls({ el }: { el: ShapeElement }) {
  const s = useStudio();
  const colors = useDocColors();
  const set = (p: Partial<ShapeElement>, key?: string) => s.patch([el.id], p, key);
  const line = el.shape === "line";
  return (
    <Section title="Shape">
      <select value={el.shape} onChange={(e) => set({ shape: e.target.value as ShapeElement["shape"] })} className="mb-2 h-8 w-full rounded-lg border border-line bg-white px-2 text-[12.5px] capitalize outline-none" aria-label="Shape">
        {SHAPES.map((sh) => (
          <option key={sh} value={sh}>
            {sh === "ellipse" ? "circle / oval" : sh}
          </option>
        ))}
      </select>
      <Row label={line ? "Colour" : "Fill"}>
        <ColorButton label="Fill" value={el.fill} foil={el.foil} allowNone={!line} docColors={colors} onChange={(c) => set({ fill: c, foil: c ? null : el.foil }, "fill")} onFoil={(foil) => set({ foil })} />
      </Row>
      {!line ? (
        <Row label="Outline">
          <ColorButton
            label="Outline"
            value={el.stroke}
            foil={el.strokeFoil}
            allowNone
            docColors={colors}
            onChange={(c) => set({ stroke: c, strokeFoil: null, strokeWidth: c && !el.strokeWidth ? 2 : el.strokeWidth }, "stroke")}
            onFoil={(strokeFoil) => set({ strokeFoil, strokeWidth: strokeFoil && !el.strokeWidth ? 2 : el.strokeWidth })}
          />
        </Row>
      ) : null}
      <Slider label={line ? "Thickness" : "Outline width"} value={el.strokeWidth} min={0} max={30} step={0.5} format={(v) => `${v}`} onChange={(v) => set({ strokeWidth: v }, "sw")} />
      <label className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-soft">
        <input type="checkbox" checked={el.dash} onChange={(e) => set({ dash: e.target.checked })} className="accent-violet-600" /> Dashed
      </label>
      {el.shape === "rect" ? <Slider label="Rounded corners" value={el.radius} min={0} max={Math.min(el.w, el.h) / 2} step={1} format={(v) => `${Math.round(v)}`} onChange={(v) => set({ radius: v }, "radius")} /> : null}
    </Section>
  );
}

// ─────────────────────────── dividers & QR ───────────────────────────

function DividerControls({ el }: { el: DividerElement }) {
  const s = useStudio();
  const colors = useDocColors();
  const set = (p: Partial<DividerElement>, key?: string) => s.patch([el.id], p, key);
  return (
    <Section title="Divider">
      <div className="grid grid-cols-4 gap-1.5">
        {DIVIDER_STYLES.map((d) => (
          <button key={d} type="button" onClick={() => set({ style: d })} className={cn("h-8 rounded-lg border text-[11.5px] capitalize transition", el.style === d ? "border-violet-400 bg-violet-50" : "border-line bg-white text-ink-soft hover:border-line-strong")}>
            {d}
          </button>
        ))}
      </div>
      <Row label="Colour" className="mt-1">
        <ColorButton label="Divider colour" value={el.color} docColors={colors} onChange={(c) => c && set({ color: c }, "color")} />
      </Row>
    </Section>
  );
}

function QrControls({ el }: { el: QrElement }) {
  const s = useStudio();
  const colors = useDocColors();
  const set = (p: Partial<QrElement>, key?: string) => s.patch([el.id], p, key);
  return (
    <Section title="QR code">
      {!s.event.qrOn ? (
        <div className="mb-2.5 flex gap-2 rounded-lg bg-ochre-soft px-3 py-2 text-[12px] text-ink">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-ochre" /> The QR code is turned off for this event (Design → QR code), so it isn’t printed.
        </div>
      ) : (
        <p className="mb-2.5 text-[11.5px] leading-relaxed text-ink-faint">Each guest’s card prints their own code here (a sample shows while you design).</p>
      )}
      <Row label="Style">
        <Seg value={el.style} onChange={(style) => set({ style })} options={QR_ELEMENT_STYLES.map((q) => ({ value: q, label: q === "rounded" ? "Soft" : q === "dots" ? "Dots" : "Classic", title: q }))} />
      </Row>
      <label className="flex min-h-9 items-center justify-between text-[12.5px] text-ink-soft">
        INVTRA mark in the middle
        <input type="checkbox" checked={el.logo} onChange={(e) => set({ logo: e.target.checked })} className="accent-violet-600" />
      </label>
      <Row label="Code">
        <ColorButton label="Code colour" value={el.fg} docColors={colors} onChange={(c) => c && set({ fg: c }, "fg")} />
      </Row>
      <Row label="Card behind">
        <ColorButton label="Card behind the code" value={el.plate} allowNone docColors={colors} onChange={(c) => set({ plate: c }, "plate")} />
      </Row>
      {el.plate ? (
        <Row label="Its border">
          <ColorButton label="Border" value={el.plateBorder} allowNone docColors={colors} onChange={(c) => set({ plateBorder: c }, "plate-border")} />
        </Row>
      ) : null}
      <p className="mb-1 mt-2 text-[12.5px] text-ink-soft">Line under the code</p>
      <input
        value={el.caption}
        onChange={(e) => set({ caption: e.target.value.slice(0, 60) }, "caption")}
        placeholder="(none)"
        className="h-8 w-full rounded-lg border border-line px-2.5 text-[12.5px] outline-none focus:border-bronze-400"
        dir="auto"
        aria-label="Line under the code"
      />
      <p className="mt-1 text-[11px] text-ink-faint">
        <code>{"{scan}"}</code> writes “Scan for your invitation” in the card’s language.
      </p>
      {el.caption ? (
        <Row label="Its colour" className="mt-1">
          <ColorButton label="Caption colour" value={el.captionColor} docColors={colors} onChange={(c) => c && set({ captionColor: c }, "cap-c")} />
        </Row>
      ) : null}
      {el.w < 150 ? <p className="mt-2 text-[11.5px] text-rosewood">Make it at least 150 px wide so every phone can scan it.</p> : null}
    </Section>
  );
}

// ─────────────────────────── nothing selected ───────────────────────────

function CardInspector() {
  const s = useStudio();
  const count = s.doc.elements.length;
  const smart = s.doc.elements.filter((e) => e.type === "text" && /\{(guest|admits)/.test(e.text)).length;
  const qr = s.doc.elements.some((e) => e.type === "qr" && !e.hidden);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header title="The card" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Check before sending">
          <ul className="space-y-2 text-[12.5px]">
            <li className="flex items-start gap-2">
              <span className={cn("mt-1 size-2 shrink-0 rounded-full", qr || !s.event.qrOn ? "bg-sage" : "bg-rosewood")} />
              <span className="text-ink-soft">{!s.event.qrOn ? "QR code: off for this event" : qr ? "The guest’s QR code is on the card" : "Add the guest’s QR code (Elements) — guests need it at the door"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={cn("mt-1 size-2 shrink-0 rounded-full", smart ? "bg-sage" : "bg-ochre")} />
              <span className="text-ink-soft">{smart ? "Each card names its guest" : "No guest’s name on the card yet (Text → Smart text)"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-sage" />
              <span className="text-ink-soft">{count} layers · 1080 × 1350 (prints at 2160 × 2700)</span>
            </li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => s.setMode("guest")} className="h-8 flex-1 rounded-lg border border-line bg-white text-[12px] text-ink-soft transition hover:border-violet-300">
              Preview a guest’s card
            </button>
            <button type="button" onClick={() => s.setMode("teaser")} className="h-8 flex-1 rounded-lg border border-line bg-white text-[12px] text-ink-soft transition hover:border-violet-300">
              Shared image
            </button>
          </div>
        </Section>
        <Section title="Good to know">
          <ul className="list-disc space-y-1.5 ps-4 text-[12px] leading-relaxed text-ink-soft">
            <li>Click a flower to pick it — pieces are picked by their paint, so you can reach what’s behind.</li>
            <li>Alt-click picks what’s beneath the selected piece; Alt-drag leaves a copy.</li>
            <li>Double-click text to type on the card.</li>
            <li>Hold ⌘ (Ctrl) while dragging to turn off snapping; Shift keeps a straight line.</li>
            <li>
              Press <kbd className="rounded border border-line bg-white px-1">?</kbd> for every shortcut.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
