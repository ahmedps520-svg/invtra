"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Copy, Lock, LockOpen, MoreHorizontal, PencilLine, RotateCw, Trash2 } from "lucide-react";
import { DRAG_TYPE, photoElement } from "@/lib/canvas/factory";
import {
  angleTo,
  center,
  contains,
  corners,
  handleSign,
  intersects,
  isCorner,
  placeResized,
  rectFrom,
  resizeBox,
  snapAngle,
  snapRect,
  snapTargets,
  snapValue,
  type Box,
  type Guides,
  type Handle,
  type Point,
  type Rect,
  type SnapTargets,
} from "@/lib/canvas/geometry";
import {
  PAGE,
  boxOf,
  duplicateElements,
  elementBounds,
  fitElement,
  rotateElements,
  scaleElements,
  selectionBounds,
  translateElements,
  updateElements,
  withGroups,
} from "@/lib/canvas/ops";
import { CANVAS_H, CANVAS_W, type CanvasDoc, type CanvasElement, type TextElement } from "@/lib/canvas/schema";
import { layoutText, textStyleFor, textValue, verticalMetrics } from "@/lib/canvas/render";
import { cn } from "@/lib/utils";
import { EditCard, PreviewCard } from "./card-layer";
import { elementsAt, preloadMasks } from "./hit";
import { useStudio } from "./studio-context";
import { ContextMenu, type MenuState } from "./context-menu";
import type { View } from "./types";

const MIN_Z = 0.08;
const MAX_Z = 6;

type Gesture =
  | { kind: "move"; id: number; start: Point; base: CanvasDoc; ids: string[]; movable: string[]; moved: boolean; click: string | null; rect0: Rect | null; targets: SnapTargets | null }
  | { kind: "resize"; id: number; handle: Handle; base: CanvasDoc; ids: string[]; box0: Box; el0: CanvasElement | null; moved: boolean; targets: SnapTargets }
  | { kind: "rotate"; id: number; base: CanvasDoc; ids: string[]; c: Point; a0: number; rot0: number; moved: boolean }
  | { kind: "marquee"; id: number; start: Point; base: string[]; additive: boolean }
  | { kind: "pan"; id: number; sx: number; sy: number; view0: View }
  | { kind: "pinch"; d0: number; m0: { x: number; y: number }; view0: View };

const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));

/** Which handles an element gets. */
function handlesFor(el: CanvasElement | null): Handle[] {
  if (!el) return ["nw", "ne", "se", "sw"];
  switch (el.type) {
    case "text":
      return el.curve ? ["nw", "ne", "se", "sw"] : ["nw", "ne", "se", "sw", "e", "w"];
    case "image":
      return ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    case "shape":
      return el.shape === "line" ? ["e", "w"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    case "divider":
      return ["nw", "ne", "se", "sw", "e", "w"];
    case "qr":
      return ["nw", "ne", "se", "sw"];
  }
}

const CURSORS = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
const HANDLE_DIR: Record<Handle, number> = { n: 0, ne: 1, e: 2, se: 3, s: 0, sw: 1, w: 2, nw: 3 };
function cursorFor(h: Handle, rot: number): string {
  const i = (((HANDLE_DIR[h] + Math.round(rot / 45)) % 4) + 4) % 4;
  return CURSORS[i];
}

/** Resize one element by a handle (images crop with the side handles; text reflows or scales). */
function resizeOne(el0: CanvasElement, box0: Box, h: Handle, p: Point, mods: { shift: boolean; alt: boolean }): CanvasElement {
  const corner = isCorner(h);
  switch (el0.type) {
    case "text": {
      if (corner) {
        const nb = resizeBox(box0, h, p, { keepRatio: true, fromCenter: mods.alt, minW: 20, minH: 8 });
        const k = nb.w / box0.w;
        return { ...el0, x: nb.x, y: nb.y, w: nb.w, size: Math.min(600, Math.max(6, Math.round(el0.size * k * 10) / 10)) };
      }
      const nb = resizeBox(box0, h, p, { fromCenter: mods.alt, minW: Math.max(24, el0.size * 0.8) });
      return { ...el0, x: nb.x, y: nb.y, w: nb.w };
    }
    case "image": {
      if (corner) {
        const nb = resizeBox(box0, h, p, { keepRatio: !mods.shift, fromCenter: mods.alt, minW: 12, minH: 12 });
        return { ...el0, x: nb.x, y: nb.y, w: nb.w, h: nb.h };
      }
      // Side handles crop: the picture stays the same size and less (or more) of it shows.
      const [c0, c1, c2, c3] = el0.crop ?? [0, 0, 1, 1];
      const fw = el0.w / Math.max(0.01, c2 - c0);
      const fh = el0.h / Math.max(0.01, c3 - c1);
      const { sx, sy } = handleSign(h);
      const raw = resizeBox(box0, h, p, { minW: 16, minH: 16 });
      const crop: [number, number, number, number] = [c0, c1, c2, c3];
      let w = box0.w;
      let hh = box0.h;
      if (sx) {
        const far = sx > 0 !== el0.flipX;
        if (far) {
          crop[2] = Math.min(1, c0 + raw.w / fw);
          w = (crop[2] - c0) * fw;
        } else {
          crop[0] = Math.max(0, c2 - raw.w / fw);
          w = (c2 - crop[0]) * fw;
        }
      }
      if (sy) {
        const far = sy > 0 !== el0.flipY;
        if (far) {
          crop[3] = Math.min(1, c1 + raw.h / fh);
          hh = (crop[3] - c1) * fh;
        } else {
          crop[1] = Math.max(0, c3 - raw.h / fh);
          hh = (c3 - crop[1]) * fh;
        }
      }
      const nb = placeResized(box0, h, w, hh);
      const full = crop[0] < 0.001 && crop[1] < 0.001 && crop[2] > 0.999 && crop[3] > 0.999;
      return { ...el0, x: nb.x, y: nb.y, w: nb.w, h: nb.h, crop: full ? null : crop };
    }
    case "shape": {
      const keep = corner && (el0.shape === "line" ? false : !mods.shift);
      const nb = resizeBox(box0, h, p, { keepRatio: keep, fromCenter: mods.alt, minW: 6, minH: el0.shape === "line" ? box0.h : 6 });
      return { ...el0, x: nb.x, y: nb.y, w: nb.w, h: nb.h };
    }
    case "divider":
    case "qr": {
      const nb = resizeBox(box0, h, p, { keepRatio: true, fromCenter: mods.alt, minW: el0.type === "qr" ? 90 : 40, minH: 6 });
      return { ...el0, x: nb.x, y: nb.y, w: nb.w, h: nb.h };
    }
  }
}

export function Stage() {
  const s = useStudio();
  const { doc, selection, view, setView, ctx, latestRef, dispatch, mode, stageRef } = s;
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [panning, setPanning] = useState(false);
  const [dropping, setDropping] = useState(false);
  /** What the pointer is doing right now (for drawing; the gesture itself lives in a ref). */
  const [busy, setBusy] = useState<Gesture["kind"] | null>(null);
  const spaceDown = useRef(false);
  const autoFit = useRef(true);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Paint masks for picking pieces by their paint.
  useEffect(() => preloadMasks(doc), [doc]);

  // ─────────────── view: fit, zoom, pan ───────────────
  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = r.width < 640 ? 20 : 56;
    const z = clampZ(Math.min((r.width - pad * 2) / CANVAS_W, (r.height - pad * 2) / CANVAS_H));
    setView({ z, tx: (r.width - CANVAS_W * z) / 2, ty: (r.height - CANVAS_H * z) / 2 });
    autoFit.current = true;
  }, [setView, stageRef]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      if (autoFit.current) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, stageRef]);

  const zoomAt = useCallback(
    (z: number, at?: { x: number; y: number }) => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const m = at ?? { x: r.width / 2, y: r.height / 2 };
      autoFit.current = false;
      setView((v) => {
        const nz = clampZ(z);
        return { z: nz, tx: m.x - ((m.x - v.tx) * nz) / v.z, ty: m.y - ((m.y - v.ty) * nz) / v.z };
      });
    },
    [setView, stageRef],
  );

  // Zoom with ctrl/⌘ + wheel (and trackpad pinch), pan with the wheel.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      autoFit.current = false;
      if (e.ctrlKey || e.metaKey) {
        const v = latestRef.current.view;
        zoomAt(v.z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022)), { x: e.clientX - r.left, y: e.clientY - r.top });
      } else {
        const k = e.deltaMode === 1 ? 16 : 1;
        setView((v) => ({ ...v, tx: v.tx - e.deltaX * k, ty: v.ty - e.deltaY * k }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [latestRef, setView, stageRef, zoomAt]);

  const zoomToSelection = useCallback(() => {
    const el = stageRef.current;
    const st = latestRef.current.state;
    const r = selectionBounds(st.doc, st.selection);
    if (!el || !r) return;
    const b = el.getBoundingClientRect();
    const z = clampZ(Math.min((b.width * 0.6) / Math.max(r.w, 40), (b.height * 0.6) / Math.max(r.h, 40)));
    autoFit.current = false;
    setView({ z, tx: b.width / 2 - (r.x + r.w / 2) * z, ty: b.height / 2 - (r.y + r.h / 2) * z });
  }, [latestRef, setView, stageRef]);

  // Zoom shortcuts and space-to-pan.
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.code === "Space" && !e.repeat) {
        spaceDown.current = true;
        setPanning(true);
        e.preventDefault();
      }
      const mod = e.metaKey || e.ctrlKey;
      const v = latestRef.current.view;
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomAt(v.z * 1.25);
      } else if (mod && e.key === "-") {
        e.preventDefault();
        zoomAt(v.z / 1.25);
      } else if (mod && e.key === "0") {
        e.preventDefault();
        fit();
      } else if (!mod && e.shiftKey && (e.key === "!" || e.code === "Digit1")) {
        fit();
      } else if (!mod && e.shiftKey && (e.key === "@" || e.code === "Digit2")) {
        zoomToSelection();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
        setPanning(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [fit, latestRef, zoomAt, zoomToSelection]);

  // ─────────────── pointer → card ───────────────
  const toCard = (clientX: number, clientY: number): Point => {
    const el = stageRef.current!;
    const r = el.getBoundingClientRect();
    const v = latestRef.current.view;
    return { x: (clientX - r.left - v.tx) / v.z, y: (clientY - r.top - v.ty) / v.z };
  };
  const toScreen = (p: Point) => ({ x: p.x * view.z + view.tx, y: p.y * view.z + view.ty });

  const endGesture = useCallback(() => {
    gesture.current = null;
    setBusy(null);
    setGuides({ x: [], y: [] });
    setMarquee(null);
    setTip(null);
  }, []);

  // ─────────────── pointer down ───────────────
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (s.editingText && !(e.target as Element).closest("[data-text-editor]")) s.setEditingText(null);
    if ((e.target as Element).closest("[data-ui]")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const stage = stageRef.current!;
    const rect = stage.getBoundingClientRect();

    // Two fingers: pinch to zoom and pan (the first finger's gesture is undone).
    if (pointers.current.size === 2) {
      const g = gesture.current;
      if (g && (g.kind === "move" || g.kind === "resize" || g.kind === "rotate") && g.moved) dispatch({ type: "undo" });
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }, view0: latestRef.current.view };
      setMarquee(null);
      setBusy("pinch");
      return;
    }
    if (mode !== "edit" || e.button === 1 || spaceDown.current) {
      if (e.button === 2) return;
      stage.setPointerCapture(e.pointerId);
      gesture.current = { kind: "pan", id: e.pointerId, sx: e.clientX, sy: e.clientY, view0: latestRef.current.view };
      setPanning(true);
      setBusy("pan");
      return;
    }
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    const st = latestRef.current.state;
    const z = latestRef.current.view.z;
    const p = toCard(e.clientX, e.clientY);

    const handle = (e.target as Element).closest("[data-handle]")?.getAttribute("data-handle");
    if (handle) {
      const ids = st.selection.filter((id) => !st.doc.elements.find((x) => x.id === id)?.locked);
      if (!ids.length) return;
      const els = st.doc.elements.filter((x) => ids.includes(x.id));
      const single = els.length === 1 ? els[0] : null;
      if (handle === "rotate") {
        const c = single ? center(single) : center(selectionBounds(st.doc, ids)!);
        gesture.current = { kind: "rotate", id: e.pointerId, base: st.doc, ids, c, a0: angleTo(c, p), rot0: single?.rot ?? 0, moved: false };
      } else {
        const box0: Box = single ? boxOf(single) : { ...selectionBounds(st.doc, ids)!, rot: 0 };
        const others = st.doc.elements.filter((x) => !ids.includes(x.id) && !x.hidden).map(elementBounds);
        gesture.current = { kind: "resize", id: e.pointerId, handle: handle as Handle, base: st.doc, ids, box0, el0: single, moved: false, targets: snapTargets(PAGE, others) };
      }
      return;
    }

    const pad = 5 / z;
    const hits = elementsAt(st.doc, p, pad);
    const sel = new Set(st.selection);
    const top = hits[0] ?? null;
    let ids: string[];
    let click: string | null = null;
    if (e.shiftKey) {
      if (!top) {
        gesture.current = { kind: "marquee", id: e.pointerId, start: p, base: st.selection, additive: true };
        return;
      }
      const group = withGroups(st.doc, [top.id]);
      ids = sel.has(top.id) ? st.selection.filter((id) => !group.includes(id)) : [...st.selection, ...group.filter((id) => !sel.has(id))];
      dispatch({ type: "select", ids });
      if (sel.has(top.id)) {
        endGesture();
        return;
      }
    } else if (e.altKey && hits.length > 1 && sel.size === 1 && hits.some((h) => sel.has(h.id))) {
      // Alt-click: pick what's beneath the selected element.
      const i = hits.findIndex((h) => sel.has(h.id));
      ids = [hits[(i + 1) % hits.length].id];
      dispatch({ type: "select", ids });
    } else {
      const inside = st.doc.elements.some((x) => sel.has(x.id) && !x.hidden && contains(boxOf(x), p, pad));
      if (inside) {
        // Dragging inside the selection moves it (even what's beneath other things); a plain click picks the top.
        ids = st.selection;
        click = top?.id ?? null;
      } else if (top) {
        ids = e.metaKey || e.ctrlKey ? [top.id] : withGroups(st.doc, [top.id]);
        dispatch({ type: "select", ids });
      } else {
        dispatch({ type: "select", ids: [] });
        gesture.current = { kind: "marquee", id: e.pointerId, start: p, base: [], additive: false };
        return;
      }
    }
    const movable = ids.filter((id) => !st.doc.elements.find((x) => x.id === id)?.locked);
    gesture.current = { kind: "move", id: e.pointerId, start: p, base: st.doc, ids, movable, moved: false, click, rect0: null, targets: null };
  };

  // ─────────────── pointer move ───────────────
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const z = latestRef.current.view.z;
    if (!g) {
      if (e.pointerType === "mouse" && mode === "edit" && !spaceDown.current) {
        const st = latestRef.current.state;
        const top = elementsAt(st.doc, toCard(e.clientX, e.clientY), 4 / z)[0];
        const id = top?.id ?? null;
        if (id !== hover) setHover(id);
      }
      return;
    }
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const rect = stageRef.current!.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      const v0 = g.view0;
      const nz = clampZ((v0.z * d) / Math.max(g.d0, 1));
      autoFit.current = false;
      setView({ z: nz, tx: m.x - ((g.m0.x - v0.tx) * nz) / v0.z, ty: m.y - ((g.m0.y - v0.ty) * nz) / v0.z });
      return;
    }
    if (g.kind === "pan") {
      autoFit.current = false;
      setView({ ...g.view0, tx: g.view0.tx + e.clientX - g.sx, ty: g.view0.ty + e.clientY - g.sy });
      return;
    }
    const p = toCard(e.clientX, e.clientY);
    const rect = stageRef.current!.getBoundingClientRect();
    const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const snapOn = !(e.ctrlKey || e.metaKey);
    const threshold = 6 / z;

    if (g.kind === "marquee") {
      const r = rectFrom(g.start, p);
      if (busy !== "marquee") setBusy("marquee");
      setMarquee(r);
      const st = latestRef.current.state;
      const hit = st.doc.elements.filter((x) => !x.locked && !x.hidden && intersects(elementBounds(x), r)).map((x) => x.id);
      const ids = withGroups(st.doc, hit);
      dispatch({ type: "select", ids: g.additive ? [...new Set([...g.base, ...ids])] : ids });
      return;
    }

    if (g.kind === "move") {
      let dx = p.x - g.start.x;
      let dy = p.y - g.start.y;
      if (!g.moved) {
        if (Math.hypot(dx, dy) * z < 3 || !g.movable.length) return;
        g.moved = true;
        setBusy("move");
        dispatch({ type: "checkpoint", doc: g.base });
        if (e.altKey) {
          // Alt-drag leaves a copy behind.
          const dup = duplicateElements(g.base, g.movable, 0);
          g.base = dup.doc;
          g.ids = dup.ids;
          g.movable = dup.ids;
        }
        g.rect0 = selectionBounds(g.base, g.movable);
        const moving = new Set(g.movable);
        g.targets = snapTargets(PAGE, g.base.elements.filter((x) => !moving.has(x.id) && !x.hidden).map(elementBounds));
        setHover(null);
      }
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      let gd: Guides = { x: [], y: [] };
      if (snapOn && g.rect0 && g.targets) {
        const sn = snapRect({ ...g.rect0, x: g.rect0.x + dx, y: g.rect0.y + dy }, g.targets, threshold);
        dx += sn.dx;
        dy += sn.dy;
        gd = sn.guides;
      }
      dispatch({ type: "live", doc: translateElements(g.base, g.movable, dx, dy), selection: g.ids });
      setGuides(gd);
      return;
    }

    if (g.kind === "rotate") {
      if (!g.moved) {
        g.moved = true;
        setBusy("rotate");
        dispatch({ type: "checkpoint", doc: g.base });
      }
      const delta = angleTo(g.c, p) - g.a0;
      let doc2: CanvasDoc;
      let shown: number;
      if (g.ids.length === 1) {
        const rot = snapAngle(g.rot0 + delta, e.shiftKey);
        doc2 = updateElements(g.base, g.ids, (x) => ({ ...x, rot }));
        shown = rot;
      } else {
        const d = e.shiftKey ? Math.round(delta / 15) * 15 : delta;
        doc2 = rotateElements(g.base, g.ids, g.c, d);
        shown = d;
      }
      dispatch({ type: "live", doc: doc2 });
      setTip({ x: local.x + 18, y: local.y + 18, text: `${Math.round(shown)}°` });
      return;
    }

    if (g.kind === "resize") {
      if (!g.moved) {
        g.moved = true;
        setBusy("resize");
        dispatch({ type: "checkpoint", doc: g.base });
      }
      const { sx, sy } = handleSign(g.handle);
      let q = p;
      const gd: Guides = { x: [], y: [] };
      if (snapOn && !g.box0.rot) {
        if (sx) {
          const sv = snapValue(p.x, g.targets.x, threshold);
          if (sv.line !== null) gd.x.push(sv.line);
          q = { ...q, x: sv.value };
        }
        if (sy) {
          const sv = snapValue(p.y, g.targets.y, threshold);
          if (sv.line !== null) gd.y.push(sv.line);
          q = { ...q, y: sv.value };
        }
      }
      const c = latestRef.current.ctx;
      let doc2: CanvasDoc;
      let label = "";
      if (g.el0) {
        const next = fitElement(resizeOne(g.el0, g.box0, g.handle, q, { shift: e.shiftKey, alt: e.altKey }), c);
        doc2 = updateElements(g.base, [g.el0.id], () => next);
        label = next.type === "text" && isCorner(g.handle) ? `${Math.round(next.size)} px text` : `${Math.round(next.w)} × ${Math.round(next.h)}`;
      } else {
        const nb = resizeBox(g.box0, g.handle, q, { keepRatio: true, fromCenter: e.altKey, minW: 20, minH: 20 });
        const k = nb.w / g.box0.w;
        const anchor = e.altKey
          ? center(g.box0)
          : { x: sx > 0 ? g.box0.x : g.box0.x + g.box0.w, y: sy > 0 ? g.box0.y : g.box0.y + g.box0.h };
        doc2 = scaleElements(g.base, g.ids, anchor, k, c);
        label = `${Math.round(k * 100)}%`;
      }
      dispatch({ type: "live", doc: doc2 });
      setGuides(gd);
      setTip({ x: local.x + 18, y: local.y + 18, text: label });
    }
  };

  // ─────────────── pointer up ───────────────
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (stageRef.current?.hasPointerCapture(e.pointerId)) stageRef.current.releasePointerCapture(e.pointerId);
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) endGesture();
      return;
    }
    if (g.kind === "pan") setPanning(spaceDown.current);
    if (g.kind === "move" && !g.moved && g.click) {
      const st = latestRef.current.state;
      const ids = e.metaKey || e.ctrlKey ? [g.click] : withGroups(st.doc, [g.click]);
      dispatch({ type: "select", ids });
    }
    endGesture();
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "edit" || (e.target as Element).closest("[data-ui]")) return;
    const st = latestRef.current.state;
    const p = toCard(e.clientX, e.clientY);
    const top = elementsAt(st.doc, p, 5 / latestRef.current.view.z)[0];
    if (!top) return;
    dispatch({ type: "select", ids: [top.id] });
    if (top.type === "text" && !top.locked) s.setEditingText(top.id);
    else if (top.type === "image" && !top.asset && !top.upload) s.setPanel("uploads");
  };

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (mode !== "edit") return;
    const st = latestRef.current.state;
    const p = toCard(e.clientX, e.clientY);
    const top = elementsAt(st.doc, p, 5 / latestRef.current.view.z)[0];
    if (top && !st.selection.includes(top.id)) dispatch({ type: "select", ids: withGroups(st.doc, [top.id]) });
    if (!top && st.selection.length) dispatch({ type: "select", ids: [] });
    setMenu({ x: e.clientX, y: e.clientY, at: p });
  };

  // ─────────────── drop: from the panels, or picture files ───────────────
  const onDragOver = (e: React.DragEvent) => {
    if (mode !== "edit") return;
    if (e.dataTransfer.types.includes(DRAG_TYPE) || e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!dropping) setDropping(true);
    }
  };
  const onDrop = async (e: React.DragEvent) => {
    setDropping(false);
    if (mode !== "edit") return;
    const p = toCard(e.clientX, e.clientY);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (raw) {
      e.preventDefault();
      try {
        const els = JSON.parse(raw) as CanvasElement[];
        const r = selectionBounds({ ...doc, elements: els }, els.map((x) => x.id));
        if (!r) return;
        const dx = p.x - (r.x + r.w / 2);
        const dy = p.y - (r.y + r.h / 2);
        // Frames around the card stay where they belong.
        const fixed = els.every((x) => x.type === "shape" && !x.fill && x.w > CANVAS_W * 0.7);
        s.add(fixed ? els : els.map((x) => ({ ...x, x: x.x + dx, y: x.y + dy })));
      } catch {
        /* not ours */
      }
      return;
    }
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    for (const [i, f] of files.entries()) {
      const u = await s.upload(f);
      if (u) s.add([photoElement(u, { x: p.x + i * 30, y: p.y + i * 30 })]);
    }
  };

  // ─────────────── drawing ───────────────
  const selected = s.selected;
  const single = selected.length === 1 ? selected[0] : null;
  const selRect = useMemo(() => selectionBounds(doc, selection), [doc, selection]);
  const editing = s.editingText ? (doc.elements.find((x) => x.id === s.editingText) as TextElement | undefined) : undefined;
  const hoverEl = hover && !selection.includes(hover) ? doc.elements.find((x) => x.id === hover) : null;
  const locked = selected.length > 0 && selected.every((x) => x.locked);
  const previewCtx = useMemo(() => (mode === "edit" ? null : s.previewCtx(mode)), [mode, s]);

  const poly = (el: CanvasElement) =>
    corners(boxOf(el))
      .map(toScreen)
      .map((q) => `${q.x},${q.y}`)
      .join(" ");

  let handles: { h: Handle; x: number; y: number }[] = [];
  let rotateAt: Point | null = null;
  let frame: Point[] | null = null;
  let frameRot = 0;
  if (mode === "edit" && selected.length && !locked && !editing && busy !== "move") {
    const box: Box = single ? boxOf(single) : selRect ? { ...selRect, rot: 0 } : { x: 0, y: 0, w: 0, h: 0, rot: 0 };
    frameRot = box.rot;
    const cs = corners(box).map(toScreen);
    frame = cs;
    const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const at: Record<Handle, Point> = { nw: cs[0], ne: cs[1], se: cs[2], sw: cs[3], n: mid(cs[0], cs[1]), e: mid(cs[1], cs[2]), s: mid(cs[2], cs[3]), w: mid(cs[3], cs[0]) };
    const small = Math.hypot(cs[1].x - cs[0].x, cs[1].y - cs[0].y) < 36 || Math.hypot(cs[3].x - cs[0].x, cs[3].y - cs[0].y) < 36;
    handles = handlesFor(single)
      .filter((h) => !small || isCorner(h) || (single?.type === "shape" && single.shape === "line"))
      .map((h) => ({ h, ...at[h] }));
    const bottom = at.s;
    const a = ((box.rot + 90) * Math.PI) / 180;
    rotateAt = { x: bottom.x + Math.cos(a) * 30, y: bottom.y + Math.sin(a) * 30 };
  }

  // Floating actions above the selection.
  let bar: { x: number; y: number } | null = null;
  if (mode === "edit" && selRect && !editing && !busy) {
    const tl = toScreen({ x: selRect.x, y: selRect.y });
    const br = toScreen({ x: selRect.x + selRect.w, y: selRect.y + selRect.h });
    const above = tl.y - 52;
    bar = { x: Math.min(Math.max((tl.x + br.x) / 2, 120), Math.max(120, size.w - 120)), y: above > 8 ? above : Math.min(br.y + 44, size.h - 48) };
  }

  const cursor = panning ? (busy === "pan" ? "grabbing" : "grab") : hover ? "move" : "default";

  return (
    <div
      ref={(el) => {
        stageRef.current = el;
      }}
      className={cn("relative h-full w-full touch-none select-none overflow-hidden bg-[#e8e3da] [background-image:radial-gradient(#d9d2c6_1px,transparent_1px)] [background-size:22px_22px]", dropping && "outline-2 -outline-offset-8 outline-dashed outline-bronze-500")}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => void onDrop(e)}
    >
      <div
        className="absolute shadow-[0_18px_50px_-12px_rgba(40,30,20,0.35),0_2px_6px_rgba(40,30,20,0.12)]"
        style={{ left: view.tx, top: view.ty, width: CANVAS_W * view.z, height: CANVAS_H * view.z, background: doc.bg.color }}
      >
        {previewCtx ? <PreviewCard doc={doc} ctx={previewCtx} /> : <EditCard doc={doc} ctx={ctx} ghostId={editing?.id ?? null} />}
      </div>

      {/* Selection, handles, guides */}
      {mode === "edit" ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {hoverEl && !busy ? <polygon points={poly(hoverEl)} fill="none" stroke="#8b5cf6" strokeWidth={1.25} strokeOpacity={0.8} /> : null}
          {selected.length > 1 || (single && single.group)
            ? selected.map((x) => <polygon key={x.id} points={poly(x)} fill="none" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 3" />)
            : null}
          {frame ? <polygon points={frame.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke="#7c3aed" strokeWidth={1.6} /> : null}
          {locked && selected.length ? selected.map((x) => <polygon key={x.id} points={poly(x)} fill="none" stroke="#a78bfa" strokeWidth={1.4} strokeDasharray="6 4" />) : null}
          {guides.x.map((x) => {
            const sx = x * view.z + view.tx;
            return <line key={`gx${x}`} x1={sx} x2={sx} y1={view.ty - 30} y2={view.ty + CANVAS_H * view.z + 30} stroke="#e11d74" strokeWidth={1} />;
          })}
          {guides.y.map((y) => {
            const sy = y * view.z + view.ty;
            return <line key={`gy${y}`} y1={sy} y2={sy} x1={view.tx - 30} x2={view.tx + CANVAS_W * view.z + 30} stroke="#e11d74" strokeWidth={1} />;
          })}
          {marquee ? (
            <rect
              x={marquee.x * view.z + view.tx}
              y={marquee.y * view.z + view.ty}
              width={marquee.w * view.z}
              height={marquee.h * view.z}
              fill="#8b5cf6"
              fillOpacity={0.08}
              stroke="#7c3aed"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}
          {rotateAt && frame ? (
            <g data-handle="rotate" className="pointer-events-auto" style={{ cursor: "grab" }} transform={`translate(${rotateAt.x} ${rotateAt.y})`}>
              <circle r={12} fill="#fff" stroke="#7c3aed" strokeWidth={1.5} />
              <circle r={22} fill="transparent" />
              <g transform="translate(-6 -6) scale(0.5)" stroke="#5b21b6" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </g>
            </g>
          ) : null}
          {handles.map(({ h, x, y }) => {
            const side = !isCorner(h);
            const horizontal = h === "n" || h === "s";
            return (
              <g key={h} data-handle={h} className="pointer-events-auto" style={{ cursor: cursorFor(h, frameRot) }} transform={`translate(${x} ${y}) rotate(${frameRot})`}>
                <rect x={-14} y={-14} width={28} height={28} fill="transparent" />
                {side ? (
                  <rect x={horizontal ? -9 : -3.5} y={horizontal ? -3.5 : -9} width={horizontal ? 18 : 7} height={horizontal ? 7 : 18} rx={3.5} fill="#fff" stroke="#7c3aed" strokeWidth={1.4} />
                ) : (
                  <circle r={6} fill="#fff" stroke="#7c3aed" strokeWidth={1.5} />
                )}
              </g>
            );
          })}
        </svg>
      ) : null}

      {tip ? (
        <div className="pointer-events-none absolute z-10 rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-white tabular-nums shadow" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      ) : null}

      {editing ? <TextEditor el={editing} view={view} /> : null}

      {bar && selected.length ? <SelectionBar x={bar.x} y={bar.y} onMore={(x, y) => setMenu({ x, y, at: null })} /> : null}

      {menu ? <ContextMenu state={menu} onClose={() => setMenu(null)} /> : null}

      <ZoomControls z={view.z} onZoom={(z) => zoomAt(z)} onFit={fit} />
      {mode !== "edit" ? (
        <div data-ui className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-ink/85 px-4 py-1.5 text-[12px] font-medium text-white shadow-lift">
          {mode === "guest" ? "Preview: a guest's card (sample guest and QR)" : "Preview: the shared image (no guest name or QR)"}
          <button type="button" className="ms-3 underline underline-offset-2" onClick={() => s.setMode("edit")}>
            Back to editing
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SelectionBar({ x, y, onMore }: { x: number; y: number; onMore: (x: number, y: number) => void }) {
  const s = useStudio();
  const { selected, selection } = s;
  const locked = selected.every((el) => el.locked);
  const text = selected.length === 1 && selected[0].type === "text" ? selected[0] : null;
  const btn = "grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink";
  return (
    <div
      data-ui
      className="absolute z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-line bg-white/95 px-1 py-1 shadow-lift backdrop-blur"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {text && !locked ? (
        <button type="button" className={btn} title="Edit text (Enter)" aria-label="Edit text" onClick={() => s.setEditingText(text.id)}>
          <PencilLine className="size-4" />
        </button>
      ) : null}
      {!locked ? (
        <button
          type="button"
          className={btn}
          title="Duplicate (⌘D)"
          aria-label="Duplicate"
          onClick={() => s.apply((doc) => duplicateElements(doc, selection))}
        >
          <Copy className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        className={btn}
        title={locked ? "Unlock (⇧⌘L)" : "Lock (⇧⌘L)"}
        aria-label={locked ? "Unlock" : "Lock"}
        onClick={() => s.patch(selection, { locked: !locked })}
      >
        {locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
      </button>
      {!locked ? (
        <button type="button" className={btn} title="Rotate 90°" aria-label="Rotate 90 degrees" onClick={() => s.update(selection, (el) => ({ ...el, rot: ((el.rot + 90 + 180) % 360) - 180 }))}>
          <RotateCw className="size-4" />
        </button>
      ) : null}
      {!locked ? (
        <button type="button" className={cn(btn, "hover:text-rosewood")} title="Delete (⌫)" aria-label="Delete" onClick={() => s.remove(selection)}>
          <Trash2 className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        className={btn}
        title="More"
        aria-label="More actions"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onMore(r.left, r.bottom + 6);
        }}
      >
        <MoreHorizontal className="size-4" />
      </button>
    </div>
  );
}

function ZoomControls({ z, onZoom, onFit }: { z: number; onZoom: (z: number) => void; onFit: () => void }) {
  const btn = "grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink";
  return (
    <div data-ui className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-full border border-line bg-white/95 px-1.5 py-1 shadow-soft">
      <button type="button" className={btn} aria-label="Zoom out" title="Zoom out (⌘−)" onClick={() => onZoom(z / 1.25)}>
        <span className="text-lg leading-none">−</span>
      </button>
      <input
        type="range"
        min={Math.log(MIN_Z)}
        max={Math.log(MAX_Z)}
        step={0.01}
        value={Math.log(z)}
        onChange={(e) => onZoom(Math.exp(Number(e.target.value)))}
        className="hidden w-24 accent-bronze-600 sm:block"
        aria-label="Zoom"
      />
      <button type="button" className={btn} aria-label="Zoom in" title="Zoom in (⌘+)" onClick={() => onZoom(z * 1.25)}>
        <span className="text-lg leading-none">+</span>
      </button>
      <button type="button" className="h-8 min-w-14 rounded-full px-2 text-[12px] font-medium tabular-nums text-ink-soft transition hover:bg-sand" title="Fit to screen (⇧1)" onClick={onFit}>
        {Math.round(z * 100)}%
      </button>
    </div>
  );
}

/** Typing straight on the card: a text box laid over the text being edited. */
function TextEditor({ el, view }: { el: TextElement; view: View }) {
  const s = useStudio();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.select();
  }, [el.id]);
  const style = textStyleFor(el);
  const { ascent, descent } = verticalMetrics(style);
  const L = layoutText(el, textValue(el, s.ctx));
  const lineH = el.size * el.leading;
  const z = view.z;
  const curved = Boolean(L.arc);
  const w = curved ? Math.max(L.width, 200) : el.w;
  const lines = Math.max(1, el.text.split("\n").length, L.lines.length);
  const h = Math.max(L.height, ascent + descent + (lines - 1) * lineH);
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const left = curved ? cx - w / 2 : el.x;
  const top = curved ? cy - h / 2 : el.y - (lineH - (ascent + descent)) / 2;
  const fill = el.foil === "silver" ? "#9aa1a9" : el.foil === "rose" ? "#b9806b" : el.foil ? "#b08d57" : el.color;
  return (
    <textarea
      ref={ref}
      data-text-editor
      data-ui
      value={el.text}
      spellCheck={false}
      dir={el.lang === "ar" ? "rtl" : "auto"}
      aria-label="Text"
      onChange={(e) => s.patch([el.id], { text: e.target.value }, `text:${el.id}`)}
      onBlur={() => s.setEditingText(null)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          s.setEditingText(null);
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 select-text resize-none overflow-hidden border-0 bg-white/10 p-0 outline-2 outline-offset-4 outline-violet-500 [field-sizing:content]"
      style={{
        left: view.tx + left * z,
        top: view.ty + top * z,
        width: w * z,
        minHeight: (h + lineH - (ascent + descent)) * z,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
        transformOrigin: "center",
        fontFamily: `'${style.family}'`,
        fontWeight: style.weight,
        fontStyle: style.italic ? "italic" : "normal",
        fontSize: el.size * z,
        lineHeight: `${lineH * z}px`,
        letterSpacing: style.letterSpacing ? `${style.letterSpacing * el.size * z}px` : undefined,
        textTransform: el.upper ? "uppercase" : undefined,
        textAlign: el.align,
        color: fill,
        caretColor: "#7c3aed",
      }}
    />
  );
}
