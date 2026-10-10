"use client";

import { useId, useState } from "react";
import { AlertTriangle, Check, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/provider";
import { fmt } from "@/lib/i18n/config";
import { contrastRatio } from "@/lib/qr";
import { getTheme } from "@/lib/themes/registry";
import { cn } from "@/lib/utils";
import { Disclosure, GroupLabel, Note } from "./controls";
import { useEditor } from "./editor-context";
import { PALETTE_PRESETS, findPreset, samePalette, type Palette } from "./palettes";

const ROLES: (keyof Palette)[] = ["background", "surface", "text", "muted", "accent"];
const HEX = /^#?([0-9a-fA-F]{6})$/;

export function PaletteSwatch({ palette, className }: { palette: Palette; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative block size-11 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-soft", className)}
      style={{ background: palette.background }}
    >
      <span className="absolute inset-y-0 end-0 w-1/2" style={{ background: palette.surface }} />
      <span className="absolute bottom-0 end-0 h-1/2 w-1/2" style={{ background: palette.accent }} />
      <span className="absolute start-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/40 rtl:translate-x-1/2" style={{ background: palette.text }} />
    </span>
  );
}

function ColourRow({ role, value, onChange }: { role: keyof Palette; value: string; onChange: (hex: string) => void }) {
  const { dict } = useI18n();
  const t = dict.editor.colours;
  const id = useId();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // Follow outside changes (presets, reset) without clobbering typing.
  if (value !== shown) {
    setShown(value);
    setText(value);
  }
  const invalid = !HEX.test(text);
  const label = t.roles[role].label;

  const commit = (raw: string) => {
    const m = raw.trim().match(HEX);
    if (m) onChange(`#${m[1].toUpperCase()}`);
  };

  return (
    <div className="flex items-center gap-4 py-3">
      <label
        className="relative size-10 shrink-0 cursor-pointer rounded-full border border-black/10 shadow-soft transition-transform duration-300 ease-luxe hover:scale-105 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze-400 has-[:focus-visible]:ring-offset-2"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={fmt(t.pick, { role: label })}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        <p className="truncate text-[12px] text-ink-faint">{t.roles[role].hint}</p>
      </div>
      <div className="shrink-0">
        <input
          id={id}
          dir="ltr"
          value={text}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-label={`${label} — ${t.hex}`}
          aria-invalid={invalid}
          title={invalid ? t.invalidHex : undefined}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setText(value)}
          className={cn(
            "h-9 w-24 rounded-lg border bg-paper px-2.5 text-center font-mono text-[13px] uppercase text-ink transition-colors",
            "focus:border-bronze-400 focus:outline-none focus:ring-4 focus:ring-bronze-100",
            invalid ? "border-rosewood/60" : "border-line hover:border-line-strong",
          )}
        />
      </div>
    </div>
  );
}

/** Ready-made colours for the names, besides the text colour, the accent and any colour. */
const NAME_SWATCHES = { gold: "#B08D57", rose: "#C27C8E", blue: "#7FA7C9", sage: "#7E9C83", navy: "#2E3A59", burgundy: "#7A2E3A" } as const;

function NamesColour() {
  const { dict } = useI18n();
  const t = dict.editor.colours;
  const { draft, setDesign } = useEditor();
  const palette = draft.design.palette;
  const current = draft.design.names.color;
  const set = (color: string | null) => setDesign({ names: { color } });
  const options: { key: string; label: string; color: string | null; swatch: string }[] = [
    { key: "same", label: t.namesSame, color: null, swatch: palette.text },
    { key: "accent", label: t.swatches.accent, color: palette.accent.toUpperCase(), swatch: palette.accent },
    ...(Object.keys(NAME_SWATCHES) as (keyof typeof NAME_SWATCHES)[]).map((k) => ({ key: k, label: t.swatches[k], color: NAME_SWATCHES[k], swatch: NAME_SWATCHES[k] })),
  ];
  const known = current === null || options.some((o) => o.color === current?.toUpperCase());
  const ratio = current ? contrastRatio(current, palette.background) : null;
  return (
    <div>
      <GroupLabel>{t.names}</GroupLabel>
      <p className="-mt-1 mb-3 text-[12px] text-ink-faint">{t.namesHint}</p>
      <div role="radiogroup" aria-label={t.names} className="flex flex-wrap items-center gap-2.5">
        {options.map((o) => {
          const active = o.color === null ? current === null : current?.toUpperCase() === o.color;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              title={o.label}
              onClick={() => set(o.color)}
              className={cn(
                "relative size-10 rounded-full border border-black/10 shadow-soft transition-transform duration-300 ease-luxe hover:scale-105",
                active && "ring-2 ring-bronze-500 ring-offset-2 ring-offset-paper",
              )}
              style={{ background: o.swatch }}
            >
              {o.key === "same" ? (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold" style={{ color: palette.background }}>
                  Aa
                </span>
              ) : null}
            </button>
          );
        })}
        <label
          title={t.namesAny}
          className={cn(
            "relative flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-paper pe-3.5 ps-1 text-[13px] text-ink-soft transition hover:border-line-strong has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze-400",
            !known && "ring-2 ring-bronze-500 ring-offset-2 ring-offset-paper",
          )}
        >
          <span
            className="size-8 rounded-full border border-black/10"
            style={{ background: !known && current ? current : "conic-gradient(#e57373, #ffd54f, #81c784, #64b5f6, #ba68c8, #e57373)" }}
          />
          {t.namesAny}
          <input
            type="color"
            value={(current ?? palette.text).toLowerCase()}
            onChange={(e) => set(e.target.value.toUpperCase())}
            aria-label={t.namesAny}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      {ratio !== null && ratio < 3 ? (
        <Note tone="warning" icon={<AlertTriangle />} className="mt-3">
          {fmt(t.contrastWarning, { ratio: ratio.toFixed(1) })}
        </Note>
      ) : null}
    </div>
  );
}

export function ColoursPanel() {
  const { dict } = useI18n();
  const t = dict.editor.colours;
  const { draft, setDesign, update } = useEditor();
  const palette = draft.design.palette;
  const presets = PALETTE_PRESETS[draft.themeKey];
  const themePalette = getTheme(draft.themeKey).defaults.palette;
  const matched = findPreset(draft.themeKey, palette);
  const ratio = contrastRatio(palette.text, palette.background);

  const setPalette = (p: Palette) => update((d) => ({ ...d, design: { ...d.design, palette: { ...p } } }));

  return (
    <div className="space-y-7">
      <div>
        <GroupLabel>{t.presets}</GroupLabel>
        <div role="radiogroup" aria-label={t.presets} className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3">
          {presets.map((p) => {
            const active = samePalette(p.palette, palette);
            return (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPalette(p.palette)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-paper p-2.5 pe-3 text-start transition-all duration-300 ease-luxe",
                  active ? "border-bronze-500 bg-bronze-50/50 ring-1 ring-bronze-500" : "border-line hover:border-line-strong hover:bg-ivory/60",
                )}
              >
                <PaletteSwatch palette={p.palette} className="size-9" />
                <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">{dict.editor.palettes[p.name]}</span>
                {active ? <Check className="size-4 shrink-0 text-bronze-600" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <NamesColour />

      <Disclosure label={t.fineTune} defaultOpen={!matched}>
        <div className="divide-y divide-line rounded-2xl border border-line px-4">
          {ROLES.map((role) => (
            <ColourRow key={role} role={role} value={palette[role]} onChange={(hex) => setDesign({ palette: { [role]: hex } })} />
          ))}
        </div>
      </Disclosure>

      {ratio < 4.5 ? (
        <Note tone="warning" icon={<AlertTriangle />}>
          {fmt(t.contrastWarning, { ratio: ratio.toFixed(1) })}
        </Note>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[12px] text-ink-faint">
          <ShieldCheck className="size-3.5 shrink-0 text-sage" />
          {t.qrSafe}
        </p>
        {!samePalette(palette, themePalette) || draft.design.names.color ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="size-3.5" />}
            onClick={() => update((d) => ({ ...d, design: { ...d.design, palette: { ...themePalette }, names: { ...d.design.names, color: null } } }))}
          >
            {t.reset}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
