"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Lock,
  LockOpen,
  Scissors,
  Trash2,
  Ungroup,
} from "lucide-react";
import type { Point } from "@/lib/canvas/geometry";
import { cn } from "@/lib/utils";
import { clipboardElements, clipText, useActions } from "./actions";
import { useStudio } from "./studio-context";

export interface MenuState {
  x: number;
  y: number;
  /** Where on the card it was opened (paste goes there). */
  at: Point | null;
}

type Item = { label: string; icon: ReactNode; keys?: string; onSelect: () => void; danger?: boolean; hidden?: boolean } | "divider";

export function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const s = useStudio();
  const a = useActions();
  const ref = useRef<HTMLDivElement>(null);

  // Keep the menu on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(state.x, window.innerWidth - r.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(state.y, window.innerHeight - r.height - 8))}px`;
  }, [state.x, state.y]);

  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof PointerEvent && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const sel = s.selected;
  const has = sel.length > 0;
  const locked = has && sel.every((e) => e.locked);
  const hidden = has && sel.every((e) => e.hidden);
  const grouped = sel.some((e) => e.group);
  const images = sel.some((e) => e.type === "image");
  const copyToSystem = (els: unknown[]) => {
    if (els.length) void navigator.clipboard?.writeText(clipText(els as never)).catch(() => undefined);
  };

  const items: Item[] = has
    ? [
        { label: "Copy", icon: <Copy />, keys: "⌘C", onSelect: () => copyToSystem(a.copy()) },
        { label: "Cut", icon: <Scissors />, keys: "⌘X", onSelect: () => copyToSystem(a.cut()), hidden: locked },
        { label: "Paste", icon: <ClipboardPaste />, keys: "⌘V", onSelect: () => a.pasteInternal(state.at ?? undefined), hidden: !clipboardElements().length },
        { label: "Duplicate", icon: <CopyPlus />, keys: "⌘D", onSelect: a.duplicate, hidden: locked },
        { label: "Delete", icon: <Trash2 />, keys: "⌫", onSelect: a.remove, danger: true, hidden: locked },
        "divider",
        { label: "Bring forward", icon: <ChevronUp />, keys: "⌘]", onSelect: () => a.arrange("forward") },
        { label: "Bring to front", icon: <ArrowUpToLine />, keys: "⌥⌘]", onSelect: () => a.arrange("front") },
        { label: "Send backward", icon: <ChevronDown />, keys: "⌘[", onSelect: () => a.arrange("backward") },
        { label: "Send to back", icon: <ArrowDownToLine />, keys: "⌥⌘[", onSelect: () => a.arrange("back") },
        "divider",
        { label: "Centre on the card", icon: <AlignCenterVertical />, onSelect: () => a.alignToPage("hcenter"), hidden: locked },
        { label: "Middle of the card", icon: <AlignCenterHorizontal />, onSelect: () => a.alignToPage("vcenter"), hidden: locked },
        { label: "Flip horizontally", icon: <FlipHorizontal2 />, onSelect: () => a.flip("x"), hidden: !images || locked },
        { label: "Flip vertically", icon: <FlipVertical2 />, onSelect: () => a.flip("y"), hidden: !images || locked },
        "divider",
        { label: "Group", icon: <Group />, keys: "⌘G", onSelect: a.group, hidden: sel.length < 2 },
        { label: "Ungroup", icon: <Ungroup />, keys: "⇧⌘G", onSelect: a.ungroup, hidden: !grouped },
        { label: locked ? "Unlock" : "Lock", icon: locked ? <LockOpen /> : <Lock />, keys: "⇧⌘L", onSelect: a.toggleLock },
        { label: hidden ? "Show" : "Hide", icon: hidden ? <Eye /> : <EyeOff />, keys: "⇧⌘H", onSelect: a.toggleHidden },
      ]
    : [
        { label: "Paste", icon: <ClipboardPaste />, keys: "⌘V", onSelect: () => a.pasteInternal(state.at ?? undefined), hidden: !clipboardElements().length },
        { label: "Select all", icon: <Copy />, keys: "⌘A", onSelect: a.selectAll },
      ];

  const visible = items.filter((i) => i === "divider" || !i.hidden);
  // No leading, trailing or doubled dividers.
  const clean = visible.filter((i, n) => i !== "divider" || (n > 0 && n < visible.length - 1 && visible[n - 1] !== "divider"));

  return (
    <div
      ref={ref}
      role="menu"
      data-ui
      className="fixed z-[95] min-w-56 select-none rounded-xl border border-line bg-white py-1.5 shadow-lift"
      style={{ left: state.x, top: state.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {clean.length === 0 ? <p className="px-3 py-2 text-[12px] text-ink-faint">Nothing to do here</p> : null}
      {clean.map((item, i) =>
        item === "divider" ? (
          <div key={`d${i}`} className="my-1 h-px bg-line" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-[13px] text-ink transition hover:bg-sand [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-faint",
              item.danger && "text-rosewood [&>svg]:text-rosewood",
            )}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.keys ? <span className="text-[11px] text-ink-faint">{item.keys}</span> : null}
          </button>
        ),
      )}
    </div>
  );
}
