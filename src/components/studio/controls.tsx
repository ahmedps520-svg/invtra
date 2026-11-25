"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { FONTS, type FontKey } from "@/lib/design/fonts";
import { FOILS, type Foil } from "@/lib/canvas/schema";
import { cn } from "@/lib/utils";

/** Small form controls for the Studio's panels. */

export function Section({ title, children, action, className }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-line/70 px-4 py-3.5 last:border-b-0", className)}>
      {title || action ? (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          {title ? <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{title}</h3> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-3", className)}>
      <span className="shrink-0 text-[12.5px] text-ink-soft">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">{children}</div>
    </div>
  );
}

const round = (v: number, p: number) => Math.round(v * 10 ** p) / 10 ** p;

/** A number box; drag its label sideways to scrub, arrow keys step (Shift: ×10). */
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  suffix,
  className,
}: {
  label?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = (text: string) => {
    const v = Number(text.replace(/[^\d.\-]/g, ""));
    if (Number.isFinite(v)) onChange(clamp(round(v, precision)));
    setDraft(null);
  };
  const scrub = useRef<{ x: number; v: number } | null>(null);
  return (
    <label className={cn("flex h-8 items-center gap-1 rounded-lg border border-line bg-white ps-2 pe-1.5 focus-within:border-bronze-400", className)}>
      {label ? (
        <span
          className="cursor-ew-resize select-none text-[11px] font-medium text-ink-faint"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            scrub.current = { x: e.clientX, v: value };
          }}
          onPointerMove={(e) => {
            if (!scrub.current) return;
            const d = (e.clientX - scrub.current.x) * step * (e.shiftKey ? 10 : 1);
            onChange(clamp(round(scrub.current.v + d, precision)));
          }}
          onPointerUp={() => (scrub.current = null)}
        >
          {label}
        </span>
      ) : null}
      <input
        inputMode="decimal"
        className="w-full min-w-0 bg-transparent text-end text-[12.5px] tabular-nums text-ink outline-none"
        value={draft ?? String(round(value, precision))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(clamp(round(value + d, precision)));
            setDraft(null);
          }
          if (e.key === "Escape") setDraft(null);
        }}
      />
      {suffix ? <span className="text-[11px] text-ink-faint">{suffix}</span> : null}
    </label>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v) => `${Math.round(v * 100)}%`,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="py-1">
      <div className="mb-1 flex items-center justify-between text-[12.5px]">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular-nums text-ink-faint">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-600"
        aria-label={typeof label === "string" ? label : undefined}
      />
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label?: ReactNode; icon?: ReactNode; title: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-lg border border-line bg-sand/60 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          aria-label={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-[12px] text-ink-soft transition [&>svg]:size-3.5",
            value === o.value ? "bg-white text-ink shadow-sm" : "hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconToggle({ active, onClick, title, children, disabled }: { active?: boolean; onClick: () => void; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg border text-ink-soft transition disabled:opacity-40 [&>svg]:size-4",
        active ? "border-violet-300 bg-violet-50 text-violet-700" : "border-line bg-white hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** A popover opened from a trigger button, positioned next to it on screen. */
export function Popover({
  trigger,
  children,
  width = 280,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  width?: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const a = anchor.current?.getBoundingClientRect();
    const p = panel.current;
    if (!a || !p) return;
    const h = p.getBoundingClientRect().height;
    const left = Math.max(8, Math.min(a.right - width, window.innerWidth - width - 8));
    const below = a.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, a.top - h - 6) : below;
    p.style.left = `${left}px`;
    p.style.top = `${top}px`;
  }, [open, width]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (panel.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <>
      <span ref={anchor} className="inline-flex">
        {trigger({ open, toggle: () => setOpen((o) => !o) })}
      </span>
      {open ? (
        <div
          ref={panel}
          role="dialog"
          aria-label={label}
          data-ui
          className="fixed z-[96] max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-white p-3 shadow-lift"
          style={{ width, left: -9999, top: -9999 }}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </>
  );
}

export const FOIL_CSS: Record<Foil, string> = {
  gold: "linear-gradient(135deg,#9E7B41,#E6CF94 35%,#C29E5C 55%,#E9D49C 75%,#A9874E)",
  silver: "linear-gradient(135deg,#8E949C,#E9ECEF 35%,#B4BAC2 55%,#EEF0F2 75%,#99A0A8)",
  rose: "linear-gradient(135deg,#A8735E,#EBC3AE 35%,#C8927C 55%,#F0CDBA 75%,#AF7B66)",
};
export const FOIL_NAMES: Record<Foil, string> = { gold: "Gold foil", silver: "Silver foil", rose: "Rose-gold foil" };

/** Paper and ink colours that suit invitations. */
export const PRESET_COLORS = [
  "#FFFFFF", "#FBF7F0", "#F6EFE3", "#F3E7DA", "#EFE6D2", "#E9DCC4", "#F4E1E1", "#EBD3D6",
  "#E3E9DF", "#D5E0D3", "#DCE6EE", "#E4E0EE", "#C9B092", "#B08D57", "#977757", "#84664A",
  "#8C5B5B", "#7A2E3A", "#5E1F2B", "#56724F", "#2F4A3A", "#1F3B57", "#1B2A41", "#3B2C20",
  "#2C2520", "#141210", "#4B4B4B", "#9AA1A9", "#D4AF37", "#E8C4A0", "#F2C6B6", "#A7C4D4",
];

const swatchStyle = (c: string) => ({ background: c });

export function ColorButton({
  value,
  foil,
  onChange,
  onFoil,
  allowNone,
  label,
  docColors = [],
}: {
  value: string | null;
  foil?: Foil | null;
  onChange: (hex: string | null) => void;
  /** Offer foils (the colour is kept for when the foil is turned off). */
  onFoil?: (f: Foil | null) => void;
  allowNone?: boolean;
  label: string;
  /** Colours already used in the design (shown first). */
  docColors?: string[];
}) {
  const [hex, setHex] = useState<string | null>(null);
  const current = foil ? null : value;
  return (
    <Popover
      label={label}
      width={268}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          title={label}
          aria-label={label}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-1.5 transition hover:border-line-strong"
        >
          <span
            className={cn("size-5 rounded-md ring-1 ring-black/10", !foil && !value && "bg-[linear-gradient(45deg,transparent_45%,#e11d48_45%,#e11d48_55%,transparent_55%)] bg-white")}
            style={foil ? { background: FOIL_CSS[foil] } : value ? swatchStyle(value) : undefined}
          />
          <ChevronDown className="size-3 text-ink-faint" />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-3">
          {onFoil ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Foil</p>
              <div className="flex gap-1.5">
                {FOILS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    title={FOIL_NAMES[f]}
                    aria-label={FOIL_NAMES[f]}
                    onClick={() => onFoil(f)}
                    className={cn("h-7 flex-1 rounded-md ring-1 ring-black/10", foil === f && "ring-2 ring-violet-600")}
                    style={{ background: FOIL_CSS[f] }}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {docColors.length ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">In this design</p>
              <Swatches colors={docColors} current={current} onPick={(c) => (onFoil && foil ? (onFoil(null), onChange(c)) : onChange(c))} />
            </div>
          ) : null}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Colours</p>
            <Swatches colors={PRESET_COLORS} current={current} onPick={(c) => (onFoil && foil ? (onFoil(null), onChange(c)) : onChange(c))} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value ?? "#ffffff"}
              onChange={(e) => {
                if (onFoil && foil) onFoil(null);
                onChange(e.target.value.toUpperCase());
              }}
              className="h-8 w-10 cursor-pointer rounded-md border border-line bg-white p-0.5"
              aria-label="Pick any colour"
            />
            <input
              value={hex ?? value ?? ""}
              placeholder="#RRGGBB"
              onChange={(e) => setHex(e.target.value)}
              onBlur={() => {
                if (hex && /^#?[0-9a-fA-F]{6}$/.test(hex.trim())) {
                  if (onFoil && foil) onFoil(null);
                  onChange(`#${hex.trim().replace("#", "").toUpperCase()}`);
                }
                setHex(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="h-8 w-full rounded-md border border-line px-2 text-[12.5px] uppercase tabular-nums outline-none focus:border-bronze-400"
              aria-label="Colour code"
            />
          </div>
          {allowNone ? (
            <button
              type="button"
              onClick={() => {
                if (onFoil) onFoil(null);
                onChange(null);
                close();
              }}
              className="w-full rounded-md border border-line py-1.5 text-[12px] text-ink-soft transition hover:bg-sand"
            >
              No colour
            </button>
          ) : null}
        </div>
      )}
    </Popover>
  );
}

function Swatches({ colors, current, onPick }: { colors: string[]; current: string | null; onPick: (c: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          onClick={() => onPick(c)}
          className={cn("relative aspect-square rounded-md ring-1 ring-black/10 transition hover:scale-110", current?.toLowerCase() === c.toLowerCase() && "ring-2 ring-violet-600")}
          style={swatchStyle(c)}
        >
          {current?.toLowerCase() === c.toLowerCase() ? <Check className="absolute inset-0 m-auto size-3 text-white mix-blend-difference" /> : null}
        </button>
      ))}
    </div>
  );
}

const FONT_SAMPLE = { latin: "Sara & Ahmed", arabic: "سارة و أحمد" };
type FontFilter = "all" | "latin" | "arabic" | "script" | "serif" | "sans";

export function FontPicker({ value, onChange, lang }: { value: FontKey; onChange: (f: FontKey) => void; lang: "en" | "ar" }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FontFilter>(lang === "ar" ? "arabic" : "all");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (Object.entries(FONTS) as [FontKey, (typeof FONTS)[FontKey]][]).filter(([k, f]) => {
      if (needle && !f.family.toLowerCase().includes(needle) && !k.includes(needle)) return false;
      if (filter === "latin" || filter === "arabic") return f.script === filter;
      if (filter === "script" || filter === "serif" || filter === "sans") return f.kind === filter;
      return true;
    });
  }, [q, filter]);
  const family = FONTS[value]?.family ?? value;
  return (
    <Popover
      label="Typeface"
      width={300}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-2.5 text-start transition hover:border-line-strong"
        >
          <span className="truncate text-[15px] text-ink" style={{ fontFamily: `'${family}'` }}>
            {family}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-faint" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <label className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-line px-2 focus-within:border-bronze-400">
            <Search className="size-3.5 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search typefaces" className="w-full bg-transparent text-[12.5px] outline-none" autoFocus />
          </label>
          <div className="mb-2 flex flex-wrap gap-1">
            {(["all", "latin", "arabic", "script", "serif", "sans"] as FontFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn("rounded-full px-2 py-0.5 text-[11.5px] capitalize transition", filter === f ? "bg-ink text-white" : "bg-sand text-ink-soft hover:text-ink")}
              >
                {f === "all" ? "All" : f === "latin" ? "English" : f === "arabic" ? "Arabic" : f}
              </button>
            ))}
          </div>
          <ul className="-mx-1 max-h-80 overflow-y-auto">
            {list.map(([k, f]) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(k);
                    close();
                  }}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start transition hover:bg-sand", k === value && "bg-violet-50")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[19px] leading-tight text-ink" style={{ fontFamily: `'${f.family}'` }}>
                      {f.script === "arabic" ? FONT_SAMPLE.arabic : FONT_SAMPLE.latin}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {f.family} · {f.script === "arabic" ? "Arabic" : "English"} {f.kind}
                    </span>
                  </span>
                  {k === value ? <Check className="size-4 shrink-0 text-violet-600" /> : null}
                </button>
              </li>
            ))}
            {!list.length ? <li className="px-2 py-3 text-[12.5px] text-ink-faint">No typeface matches.</li> : null}
          </ul>
        </div>
      )}
    </Popover>
  );
}
