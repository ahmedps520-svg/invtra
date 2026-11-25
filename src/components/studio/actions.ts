"use client";

import { useMemo } from "react";
import type { Point } from "@/lib/canvas/geometry";
import {
  PAGE,
  alignElements,
  cloneElements,
  distributeElements,
  duplicateElements,
  findElements,
  groupElements,
  reorder,
  selectionBounds,
  translateElements,
  ungroupElements,
  type AlignEdge,
  type ReorderMode,
} from "@/lib/canvas/ops";
import type { CanvasElement } from "@/lib/canvas/schema";
import { useStudio } from "./studio-context";

/** What was last copied in the Studio (also put on the system clipboard as JSON, to paste into another event). */
let clipboard: CanvasElement[] = [];
export const CLIP_MARK = "invtra-studio";

export function setClipboard(els: CanvasElement[]) {
  clipboard = els;
}
export function clipboardElements(): CanvasElement[] {
  return clipboard;
}

/** Parse elements copied from the Studio (this tab or another). */
export function parseClip(text: string): CanvasElement[] | null {
  try {
    const v = JSON.parse(text) as { [CLIP_MARK]?: number; elements?: CanvasElement[] };
    return v && v[CLIP_MARK] === 1 && Array.isArray(v.elements) ? v.elements : null;
  } catch {
    return null;
  }
}

export function clipText(els: CanvasElement[]): string {
  return JSON.stringify({ [CLIP_MARK]: 1, elements: els });
}

/** The Studio's commands, shared by the keyboard, the context menu and the toolbars. */
export function useActions() {
  const s = useStudio();
  const { apply, patch, update, remove, select, latestRef, setEditingText } = s;
  return useMemo(() => {
    const sel = () => latestRef.current.state.selection;
    const unlocked = () => {
      const st = latestRef.current.state;
      return findElements(st.doc, st.selection)
        .filter((e) => !e.locked)
        .map((e) => e.id);
    };
    const paste = (els: CanvasElement[], at?: Point) => {
      if (!els.length) return;
      apply((doc) => {
        let copies = cloneElements(els);
        const r = selectionBounds({ ...doc, elements: copies }, copies.map((e) => e.id))!;
        // Into the middle of the view (or a step down-right when pasting over the original).
        const dx = at ? at.x - (r.x + r.w / 2) : doc.elements.some((e) => els.some((c) => c.x === e.x && c.y === e.y)) ? 24 : 0;
        const dy = at ? at.y - (r.y + r.h / 2) : dx;
        copies = copies.map((e) => ({ ...e, x: e.x + dx, y: e.y + dy }));
        const elements = [...doc.elements, ...copies];
        return { doc: { ...doc, elements }, selection: copies.map((c) => c.id) };
      });
    };
    return {
      copy() {
        const st = latestRef.current.state;
        const els = findElements(st.doc, st.selection);
        if (els.length) setClipboard(els);
        return els;
      },
      cut() {
        const st = latestRef.current.state;
        const els = findElements(st.doc, st.selection);
        if (!els.length) return els;
        setClipboard(els);
        remove(unlocked());
        return els;
      },
      paste,
      pasteInternal(at?: Point) {
        paste(clipboard, at);
      },
      duplicate() {
        apply((doc, selection) => duplicateElements(doc, selection));
      },
      remove() {
        remove(unlocked());
      },
      selectAll() {
        const st = latestRef.current.state;
        select(st.doc.elements.filter((e) => !e.locked && !e.hidden).map((e) => e.id));
      },
      deselect() {
        select([]);
        setEditingText(null);
      },
      arrange(mode: ReorderMode) {
        apply((doc, selection) => reorder(doc, selection, mode));
      },
      toggleLock() {
        const st = latestRef.current.state;
        const els = findElements(st.doc, st.selection);
        if (!els.length) return;
        patch(st.selection, { locked: !els.every((e) => e.locked) });
      },
      toggleHidden() {
        const st = latestRef.current.state;
        const els = findElements(st.doc, st.selection);
        if (!els.length) return;
        patch(st.selection, { hidden: !els.every((e) => e.hidden) });
      },
      group() {
        apply((doc, selection) => groupElements(doc, selection));
      },
      ungroup() {
        apply((doc, selection) => ungroupElements(doc, selection));
      },
      flip(axis: "x" | "y") {
        update(unlocked(), (el) => (el.type === "image" ? { ...el, [axis === "x" ? "flipX" : "flipY"]: !el[axis === "x" ? "flipX" : "flipY"] } : el));
      },
      align(edge: AlignEdge) {
        const ids = unlocked();
        apply((doc) => alignElements(doc, ids, edge, ids.length === 1 || sel().length === 1 ? { x: 0, y: 0, w: PAGE.w, h: PAGE.h } : undefined));
      },
      alignToPage(edge: AlignEdge) {
        const ids = unlocked();
        const st = latestRef.current.state;
        const r = selectionBounds(st.doc, ids);
        if (!r) return;
        // The selection moves as one block.
        const page = { x: 0, y: 0, w: PAGE.w, h: PAGE.h };
        let dx = 0;
        let dy = 0;
        if (edge === "left") dx = -r.x;
        if (edge === "hcenter") dx = page.w / 2 - (r.x + r.w / 2);
        if (edge === "right") dx = page.w - (r.x + r.w);
        if (edge === "top") dy = -r.y;
        if (edge === "vcenter") dy = page.h / 2 - (r.y + r.h / 2);
        if (edge === "bottom") dy = page.h - (r.y + r.h);
        apply((doc) => translateElements(doc, ids, dx, dy));
      },
      distribute(axis: "h" | "v") {
        const ids = unlocked();
        apply((doc) => distributeElements(doc, ids, axis));
      },
      nudge(dx: number, dy: number) {
        const ids = unlocked();
        if (ids.length) apply((doc) => translateElements(doc, ids, dx, dy), "nudge");
      },
      editText() {
        const st = latestRef.current.state;
        const els = findElements(st.doc, st.selection);
        if (els.length === 1 && els[0].type === "text" && !els[0].locked) setEditingText(els[0].id);
      },
    };
  }, [apply, patch, update, remove, select, latestRef, setEditingText]);
}

export type StudioActions = ReturnType<typeof useActions>;
