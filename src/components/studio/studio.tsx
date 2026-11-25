"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { SAMPLE_GUEST } from "@/lib/card/sample";
import { photoElement, qrElement, shapeElement, textElement, PRESET_TEXT } from "@/lib/canvas/factory";
import { fitElement } from "@/lib/canvas/ops";
import type { CanvasRenderContext } from "@/lib/canvas/render";
import { CANVAS_H, CANVAS_W, type CanvasDoc, type CanvasElement } from "@/lib/canvas/schema";
import { templateToCanvas } from "@/lib/canvas/templates";
import { getTheme } from "@/lib/themes/registry";
import { Dialog } from "@/components/ui/dialog";
import { useMediaQuery } from "@/components/editor/use-card-props";
import { cn } from "@/lib/utils";
import { clipText, parseClip, useActions } from "./actions";
import { Inspector } from "./inspector";
import { fillFrame, loadTemplate, PANELS, PanelHost } from "./panels";
import { Stage } from "./stage";
import { StudioProvider, useStudio } from "./studio-context";
import { TopBar } from "./topbar";
import type { StudioProps } from "./types";

/**
 * INVTRA Studio: a free-form editor for an invitation card (Admin → Custom events). The card is a
 * document of layers — every painted piece, ornament, photo, text and shape can be picked, moved,
 * resized, turned, restyled or removed — and it prints through the same renderer as INVTRA's
 * designs, with each guest's name and QR code filled in.
 */
export function Studio(props: StudioProps & { customImage?: { key: string; width: number; height: number } | null }) {
  const [doc, setDoc] = useState<CanvasDoc | null>(() => (props.canvas.elements.length ? props.canvas : null));

  useEffect(() => {
    if (doc) return;
    let cancelled = false;
    void startingDoc(props).then((d) => {
      if (!cancelled) setDoc(d);
    });
    return () => {
      cancelled = true;
    };
    // Built once, from the props the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lang = props.event.language === "AR" ? "ar" : "en";
  const fitted = useMemo(() => {
    if (!doc) return null;
    const ctx: CanvasRenderContext = {
      content: props.content,
      guest: lang === "ar" ? SAMPLE_GUEST.ar : SAMPLE_GUEST.en,
      qrPlaceholder: true,
      digits: props.design.digits,
      language: lang,
      editor: true,
    };
    return { ...doc, elements: doc.elements.map((e) => fitElement(e, ctx)) };
  }, [doc, props.content, props.design.digits, lang]);

  if (!fitted) {
    return (
      <div dir="ltr" className="fixed inset-0 z-[90] grid place-items-center bg-ivory">
        <div className="flex items-center gap-3 text-[14px] text-ink-soft">
          <Loader2 className="size-5 animate-spin text-violet-600" /> Opening the design in Studio…
        </div>
      </div>
    );
  }
  return (
    <StudioProvider props={props} initialDoc={fitted}>
      <Shell started={!props.canvas.elements.length} />
    </StudioProvider>
  );
}

/** The document Studio opens with when the event has none yet: its current card, taken apart into layers. */
async function startingDoc(props: StudioProps & { customImage?: { key: string; width: number; height: number } | null }): Promise<CanvasDoc> {
  const p = props.design.palette;
  if (props.customImage) {
    // The uploaded artwork, covering the card, with the QR where it was placed on it.
    const u = { key: props.customImage.key, width: props.customImage.width, height: props.customImage.height };
    const photo = fillFrame({ ...photoElement(u), x: 0, y: 0, w: CANVAS_W, h: CANVAS_H }, { id: "", kind: "CUSTOM_INVITATION", url: null, ...u });
    const els: CanvasElement[] = [{ ...photo, name: "Uploaded artwork" }];
    if (props.event.qrOn) {
      const q = props.design.customQr;
      const w = Math.max(150, q.size * CANVAS_W);
      els.push(qrElement(props.design, { x: q.x * CANVAS_W, y: q.y * CANVAS_H }, w));
    }
    return { enabled: true, source: null, bg: { color: p.background, color2: null, texture: 0, vignette: 0, washes: [], image: null }, elements: els };
  }
  const key = props.event.themeKey;
  const tpl = await loadTemplate(key);
  return templateToCanvas(tpl, { key, theme: getTheme(key), design: props.design, language: props.event.language, content: props.content });
}

function Shell({ started }: { started: boolean }) {
  const s = useStudio();
  const wide = useMediaQuery("(min-width: 1280px)", true);
  const desktop = useMediaQuery("(min-width: 768px)", true);
  useShortcuts();
  useClipboard();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toastRef = useRef(s.toast);
  const welcomed = useRef(false);
  useEffect(() => {
    if (!started || welcomed.current) return;
    welcomed.current = true;
    toastRef.current("Your card is now in layers: click any flower, ornament or line of text to move, change or remove it.", "info");
  }, [started]);

  const showInspector = wide || s.inspectorOpen;
  return (
    <div dir="ltr" lang="en" className="fixed inset-0 z-[90] flex flex-col bg-ivory font-sans text-ink">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        {desktop ? <Rail /> : null}
        {s.panel ? (
          <aside
            className={cn(
              "z-30 flex flex-col border-line bg-white",
              desktop ? "w-[320px] shrink-0 border-e" : "absolute inset-x-0 bottom-0 h-[56vh] rounded-t-2xl border-t shadow-lift",
            )}
          >
            <PanelHost onClose={() => s.setPanel(null)} />
          </aside>
        ) : null}
        <main className="relative min-w-0 flex-1">
          <Stage />
          {!wide && s.selected.length ? (
            <button
              type="button"
              data-ui
              onClick={() => s.setInspectorOpen(!s.inspectorOpen)}
              className="absolute right-3 top-3 z-20 flex h-9 items-center gap-1.5 rounded-full bg-violet-600 px-3.5 text-[12.5px] font-medium text-white shadow-lift"
            >
              {s.inspectorOpen ? <X className="size-4" /> : <SlidersHorizontal className="size-4" />}
              {s.inspectorOpen ? "Close" : "Edit"}
            </button>
          ) : null}
        </main>
        {showInspector ? (
          <aside
            className={cn(
              "z-30 border-line bg-white",
              wide
                ? "w-[300px] shrink-0 border-s"
                : desktop
                  ? "absolute inset-y-0 end-0 w-[300px] border-s shadow-lift"
                  : "absolute inset-x-0 bottom-0 h-[60vh] rounded-t-2xl border-t shadow-lift",
            )}
          >
            <Inspector />
          </aside>
        ) : null}
      </div>
      {!desktop ? <BottomRail /> : null}
      <HelpDialog />
    </div>
  );
}

function Rail() {
  const s = useStudio();
  return (
    <nav aria-label="Studio panels" className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-e border-line bg-[#f7f3ec] py-2">
      {PANELS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => s.setPanel(s.panel === p.key ? null : p.key)}
          aria-pressed={s.panel === p.key}
          className={cn(
            "flex w-[62px] flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-medium transition [&>svg]:size-5",
            s.panel === p.key ? "bg-white text-violet-700 shadow-soft" : "text-ink-soft hover:bg-white/70 hover:text-ink",
          )}
        >
          {p.icon}
          {p.label}
        </button>
      ))}
    </nav>
  );
}

function BottomRail() {
  const s = useStudio();
  return (
    <nav aria-label="Studio panels" className="flex h-14 shrink-0 items-center justify-around border-t border-line bg-white">
      {PANELS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => {
            s.setInspectorOpen(false);
            s.setPanel(s.panel === p.key ? null : p.key);
          }}
          className={cn("flex flex-col items-center gap-0.5 px-1 text-[10px] [&>svg]:size-5", s.panel === p.key ? "text-violet-700" : "text-ink-soft")}
        >
          {p.icon}
          {p.label}
        </button>
      ))}
    </nav>
  );
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

function useShortcuts() {
  const s = useStudio();
  const a = useActions();
  const handler = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    handler.current = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "s") {
        e.preventDefault();
        void s.saveNow();
        return;
      }
      if (typing(e.target)) return;
      if (mod && k === "z") {
        e.preventDefault();
        s.dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        s.dispatch({ type: "redo" });
        return;
      }
      if (mod && k === "d") {
        e.preventDefault();
        a.duplicate();
        return;
      }
      if (mod && k === "a") {
        e.preventDefault();
        a.selectAll();
        return;
      }
      if (mod && k === "g") {
        e.preventDefault();
        if (e.shiftKey) a.ungroup();
        else a.group();
        return;
      }
      if (mod && e.shiftKey && k === "l") {
        e.preventDefault();
        a.toggleLock();
        return;
      }
      if (mod && e.shiftKey && k === "h") {
        e.preventDefault();
        a.toggleHidden();
        return;
      }
      if (mod && (e.code === "BracketRight" || e.code === "BracketLeft")) {
        e.preventDefault();
        const up = e.code === "BracketRight";
        a.arrange(e.altKey ? (up ? "front" : "back") : up ? "forward" : "backward");
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        a.remove();
      } else if (e.key === "Escape") {
        if (s.mode !== "edit") s.setMode("edit");
        else a.deselect();
      } else if (e.key === "Enter") {
        e.preventDefault();
        a.editText();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        a.nudge(e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0);
      } else if (e.key === "?") {
        s.setHelpOpen(true);
      } else if (s.mode === "edit" && !e.shiftKey && (k === "t" || k === "r" || k === "o" || k === "l")) {
        const at = s.visibleCenter();
        const lang = s.event.language === "AR" ? "ar" : "en";
        if (k === "t") s.add([textElement({ text: PRESET_TEXT.heading[lang], preset: "heading", design: s.design, lang, at })]);
        else s.add([shapeElement(k === "r" ? "rect" : k === "o" ? "ellipse" : "line", s.design, at)]);
      }
    };
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => handler.current(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
}

/** ⌘C / ⌘X / ⌘V: Studio layers (also between events), pasted pictures and pasted text. */
function useClipboard() {
  const s = useStudio();
  const a = useActions();
  type Handler = (e: ClipboardEvent) => void;
  const noop: Handler = () => undefined;
  const handlers = useRef<{ copy: Handler; cut: Handler; paste: Handler }>({ copy: noop, cut: noop, paste: noop });
  useEffect(() => {
    handlers.current = {
      copy: (e) => {
        if (typing(e.target) || s.mode !== "edit") return;
        const els = a.copy();
        if (!els.length) return;
        e.clipboardData?.setData("text/plain", clipText(els));
        e.preventDefault();
      },
      cut: (e) => {
        if (typing(e.target) || s.mode !== "edit") return;
        const els = a.cut();
        if (!els.length) return;
        e.clipboardData?.setData("text/plain", clipText(els));
        e.preventDefault();
      },
      paste: (e) => {
        if (typing(e.target) || s.mode !== "edit") return;
        e.preventDefault();
        const data = e.clipboardData;
        const files = data ? [...data.files].filter((f) => f.type.startsWith("image/")) : [];
        if (files.length) {
          void (async () => {
            for (const f of files) {
              const u = await s.upload(f);
              if (u) s.add([photoElement(u, s.visibleCenter())]);
            }
          })();
          return;
        }
        const text = data?.getData("text/plain") ?? "";
        const els = text ? parseClip(text) : null;
        if (els) a.paste(els);
        else if (text.trim()) {
          const lang = /[؀-ۿ]/.test(text) ? "ar" : "en";
          s.add([textElement({ text: text.trim().slice(0, 2000), preset: "body", design: s.design, lang, at: s.visibleCenter() })]);
        } else a.pasteInternal();
      },
    };
  });
  useEffect(() => {
    const copy = (e: ClipboardEvent) => handlers.current.copy(e);
    const cut = (e: ClipboardEvent) => handlers.current.cut(e);
    const paste = (e: ClipboardEvent) => handlers.current.paste(e);
    window.addEventListener("copy", copy);
    window.addEventListener("cut", cut);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", cut);
      window.removeEventListener("paste", paste);
    };
  }, []);
}

const SHORTCUTS: [string, string][] = [
  ["Undo / redo", "⌘Z  /  ⇧⌘Z"],
  ["Copy, cut, paste", "⌘C  ⌘X  ⌘V"],
  ["Duplicate", "⌘D  (or Alt-drag)"],
  ["Delete", "⌫"],
  ["Select all", "⌘A"],
  ["Group / ungroup", "⌘G  /  ⇧⌘G"],
  ["Bring forward / backward", "⌘]  /  ⌘["],
  ["To front / back", "⌥⌘]  /  ⌥⌘["],
  ["Lock / hide", "⇧⌘L  /  ⇧⌘H"],
  ["Nudge", "Arrows (Shift: 10 px)"],
  ["Edit text", "Enter or double-click"],
  ["Finish typing", "Esc or ⌘Enter"],
  ["Add text / rectangle / circle / line", "T  R  O  L"],
  ["Zoom", "⌘+  ⌘−  (or ⌘-scroll, pinch)"],
  ["Fit / zoom to selection", "⇧1  /  ⇧2"],
  ["Move around", "Scroll, or hold Space and drag"],
  ["Save now", "⌘S"],
];

const TIPS: [string, string][] = [
  ["Alt-click", "picks what’s beneath the selected piece"],
  ["⌘-click", "picks one piece inside a group"],
  ["Shift while dragging", "keeps a straight line; on corners, stretches freely"],
  ["⌘ while dragging", "turns off snapping"],
  ["Alt while resizing", "resizes from the centre"],
  ["Side handles on a picture", "crop it"],
];

function HelpDialog() {
  const s = useStudio();
  return (
    <Dialog open={s.helpOpen} onClose={() => s.setHelpOpen(false)} title="Keyboard shortcuts" size="lg">
      <div dir="ltr" className="grid gap-6 sm:grid-cols-2">
        <dl className="space-y-1.5 text-[13px]">
          {SHORTCUTS.map(([what, keys]) => (
            <div key={what} className="flex justify-between gap-4 border-b border-line/60 pb-1.5">
              <dt className="text-ink-soft">{what}</dt>
              <dd className="whitespace-nowrap font-medium text-ink">{keys}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">With the mouse</p>
          <dl className="space-y-1.5 text-[13px]">
            {TIPS.map(([what, does]) => (
              <div key={what} className="border-b border-line/60 pb-1.5">
                <dt className="font-medium text-ink">{what}</dt>
                <dd className="text-ink-soft">{does}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">On a Windows keyboard, use Ctrl for ⌘ and Alt for ⌥.</p>
        </div>
      </div>
    </Dialog>
  );
}
