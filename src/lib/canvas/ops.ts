import { getAsset } from "./assets";
import { FIELDS } from "./fields";
import { bounds, center, rotatePoint, union, type Box, type Point, type Rect } from "./geometry";
import { newId } from "./ids";
import { DIVIDER_SIZE, isDark, layoutText, luminance, qrGeometry, textValue, type CanvasRenderContext } from "./render";
import { CANVAS_H, CANVAS_W, MAX_ELEMENTS, type CanvasDoc, type CanvasElement } from "./schema";

/**
 * Operations on Studio documents (pure: each returns a new document). The editor's undo history
 * keeps the documents themselves, so unchanged elements are shared between versions.
 */

export const PAGE = { w: CANVAS_W, h: CANVAS_H };

const close = (a: number, b: number) => Math.abs(a - b) < 0.05;
const clampLen = (v: number) => Math.min(8000, Math.max(1, v));

export function boxOf(el: Pick<CanvasElement, "x" | "y" | "w" | "h" | "rot">): Box {
  return { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot };
}

export function elementBounds(el: CanvasElement): Rect {
  return bounds(boxOf(el));
}

export function findElements(doc: CanvasDoc, ids: readonly string[]): CanvasElement[] {
  const set = new Set(ids);
  return doc.elements.filter((e) => set.has(e.id));
}

/** Bounds of the selected elements (null when nothing is selected). */
export function selectionBounds(doc: CanvasDoc, ids: readonly string[]): Rect | null {
  return union(findElements(doc, ids).map(elementBounds));
}

/** The selection grown to whole groups (clicking one piece of a group selects the group). */
export function withGroups(doc: CanvasDoc, ids: readonly string[]): string[] {
  const groups = new Set(findElements(doc, ids).map((e) => e.group).filter(Boolean));
  if (!groups.size) return [...ids];
  const set = new Set(ids);
  for (const e of doc.elements) if (e.group && groups.has(e.group)) set.add(e.id);
  return doc.elements.filter((e) => set.has(e.id)).map((e) => e.id);
}

/** Auto-sized boxes follow their content: text height its lines, curved text its arc, the QR its caption. */
export function fitElement<T extends CanvasElement>(el: T, ctx: CanvasRenderContext): T {
  switch (el.type) {
    case "text": {
      const L = layoutText(el, textValue(el, ctx));
      if (L.arc) {
        const w = clampLen(L.width);
        const h = clampLen(L.height);
        if (close(w, el.w) && close(h, el.h)) return el;
        const c = center(el);
        return { ...el, x: c.x - w / 2, y: c.y - h / 2, w, h };
      }
      const h = clampLen(L.height);
      return close(h, el.h) ? el : { ...el, h };
    }
    case "qr": {
      const h = clampLen(qrGeometry(el).h);
      return close(h, el.h) ? el : { ...el, h };
    }
    case "divider": {
      const h = clampLen((el.w * DIVIDER_SIZE.h) / DIVIDER_SIZE.w);
      return close(h, el.h) ? el : { ...el, h };
    }
    default:
      return el;
  }
}

/** Apply `fn` to the given elements (fitting auto-sized ones afterwards when a context is given). */
export function updateElements(
  doc: CanvasDoc,
  ids: readonly string[],
  fn: (el: CanvasElement) => CanvasElement,
  ctx?: CanvasRenderContext,
): CanvasDoc {
  const set = new Set(ids);
  let changed = false;
  const elements = doc.elements.map((el) => {
    if (!set.has(el.id)) return el;
    let next = fn(el);
    if (ctx) next = fitElement(next, ctx);
    if (next !== el) changed = true;
    return next;
  });
  return changed ? { ...doc, elements } : doc;
}

/** Merge the same property values into each element (only the ones that type has). */
export function patchElements(doc: CanvasDoc, ids: readonly string[], patch: Record<string, unknown>, ctx?: CanvasRenderContext): CanvasDoc {
  return updateElements(
    doc,
    ids,
    (el) => {
      const own = Object.fromEntries(Object.entries(patch).filter(([k]) => k in el));
      return Object.keys(own).length ? ({ ...el, ...own } as CanvasElement) : el;
    },
    ctx,
  );
}

/** Add elements on top (or at an index). Ids already in the document get fresh ones. */
export function addElements(doc: CanvasDoc, els: CanvasElement[], index?: number): CanvasDoc {
  const room = Math.max(0, MAX_ELEMENTS - doc.elements.length);
  const taken = new Set(doc.elements.map((e) => e.id));
  const add = els.slice(0, room).map((e) => (taken.has(e.id) ? { ...e, id: newId() } : e));
  const elements = [...doc.elements];
  elements.splice(index ?? elements.length, 0, ...add);
  return { ...doc, elements };
}

export function removeElements(doc: CanvasDoc, ids: readonly string[]): CanvasDoc {
  const set = new Set(ids);
  return { ...doc, elements: doc.elements.filter((e) => !set.has(e.id)) };
}

/** Copies with new ids (groups copied stay grouped together, as a new group). */
export function cloneElements(els: CanvasElement[], offset: Point = { x: 0, y: 0 }): CanvasElement[] {
  const groups = new Map<string, string>();
  return els.map((e) => {
    let group = e.group;
    if (group) {
      if (!groups.has(group)) groups.set(group, newId());
      group = groups.get(group)!;
    }
    return { ...e, id: newId(), group, x: e.x + offset.x, y: e.y + offset.y, locked: false };
  });
}

/** Duplicate the elements just above the topmost of them. */
export function duplicateElements(doc: CanvasDoc, ids: readonly string[], offset = 24): { doc: CanvasDoc; ids: string[] } {
  const els = findElements(doc, ids);
  if (!els.length) return { doc, ids: [] };
  const copies = cloneElements(els, { x: offset, y: offset });
  const top = Math.max(...els.map((e) => doc.elements.indexOf(e)));
  const next = addElements(doc, copies, top + 1);
  return { doc: next, ids: copies.map((c) => c.id).filter((id) => next.elements.some((e) => e.id === id)) };
}

export type ReorderMode = "forward" | "backward" | "front" | "back";

/** Bring forward / send backward one step (past the next element that overlaps), or all the way. */
export function reorder(doc: CanvasDoc, ids: readonly string[], mode: ReorderMode): CanvasDoc {
  const set = new Set(ids);
  const moving = doc.elements.filter((e) => set.has(e.id));
  if (!moving.length) return doc;
  const rest = doc.elements.filter((e) => !set.has(e.id));
  if (mode === "front") return { ...doc, elements: [...rest, ...moving] };
  if (mode === "back") return { ...doc, elements: [...moving, ...rest] };
  const area = union(moving.map(elementBounds))!;
  const overlaps = (e: CanvasElement) => {
    const r = elementBounds(e);
    return r.x < area.x + area.w && area.x < r.x + r.w && r.y < area.y + area.h && area.y < r.y + r.h;
  };
  const indexes = moving.map((e) => doc.elements.indexOf(e));
  if (mode === "forward") {
    const top = Math.max(...indexes);
    // The next element above that overlaps (or simply the next one up).
    let target = -1;
    for (let i = top + 1; i < doc.elements.length; i++) {
      if (!set.has(doc.elements[i].id) && overlaps(doc.elements[i])) {
        target = i;
        break;
      }
    }
    if (target < 0) target = Math.min(doc.elements.length - 1, top + 1);
    if (target <= top) return doc;
    const after = doc.elements[target];
    const out = rest.slice();
    out.splice(out.indexOf(after) + 1, 0, ...moving);
    return { ...doc, elements: out };
  }
  const bottom = Math.min(...indexes);
  let target = -1;
  for (let i = bottom - 1; i >= 0; i--) {
    if (!set.has(doc.elements[i].id) && overlaps(doc.elements[i])) {
      target = i;
      break;
    }
  }
  if (target < 0) target = Math.max(0, bottom - 1);
  if (target >= bottom) return doc;
  const before = doc.elements[target];
  const out = rest.slice();
  out.splice(out.indexOf(before), 0, ...moving);
  return { ...doc, elements: out };
}

/** Put elements at a position in the stack (the Layers panel): `index` counts from the bottom, in the list without them. */
export function moveToIndex(doc: CanvasDoc, ids: readonly string[], index: number): CanvasDoc {
  const set = new Set(ids);
  const moving = doc.elements.filter((e) => set.has(e.id));
  const rest = doc.elements.filter((e) => !set.has(e.id));
  const at = Math.max(0, Math.min(rest.length, index));
  return { ...doc, elements: [...rest.slice(0, at), ...moving, ...rest.slice(at)] };
}

export function translateElements(doc: CanvasDoc, ids: readonly string[], dx: number, dy: number): CanvasDoc {
  if (!dx && !dy) return doc;
  return updateElements(doc, ids, (el) => ({ ...el, x: el.x + dx, y: el.y + dy }));
}

export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/**
 * Line elements up: one element against the page, several against the selection's bounds. A group
 * moves as one.
 */
export function alignElements(doc: CanvasDoc, ids: readonly string[], edge: AlignEdge, to?: Rect): CanvasDoc {
  const els = findElements(doc, ids);
  if (!els.length) return doc;
  const target = to ?? (els.length === 1 ? { x: 0, y: 0, w: PAGE.w, h: PAGE.h } : union(els.map(elementBounds))!);
  // Units that move together: each group, and each ungrouped element.
  const units = new Map<string, CanvasElement[]>();
  for (const e of els) {
    const k = e.group ?? `#${e.id}`;
    units.set(k, [...(units.get(k) ?? []), e]);
  }
  const shift = new Map<string, Point>();
  for (const members of units.values()) {
    const r = union(members.map(elementBounds))!;
    let dx = 0;
    let dy = 0;
    if (edge === "left") dx = target.x - r.x;
    if (edge === "hcenter") dx = target.x + target.w / 2 - (r.x + r.w / 2);
    if (edge === "right") dx = target.x + target.w - (r.x + r.w);
    if (edge === "top") dy = target.y - r.y;
    if (edge === "vcenter") dy = target.y + target.h / 2 - (r.y + r.h / 2);
    if (edge === "bottom") dy = target.y + target.h - (r.y + r.h);
    for (const m of members) shift.set(m.id, { x: dx, y: dy });
  }
  return updateElements(doc, [...shift.keys()], (el) => {
    const d = shift.get(el.id)!;
    return d.x || d.y ? { ...el, x: el.x + d.x, y: el.y + d.y } : el;
  });
}

/** Even spacing between three or more elements, across (h) or down (v). */
export function distributeElements(doc: CanvasDoc, ids: readonly string[], axis: "h" | "v"): CanvasDoc {
  const els = findElements(doc, ids);
  if (els.length < 3) return doc;
  const items = els.map((e) => ({ e, r: elementBounds(e) }));
  items.sort((a, b) => (axis === "h" ? a.r.x - b.r.x : a.r.y - b.r.y));
  const first = items[0].r;
  const last = items[items.length - 1].r;
  const span = axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
  const total = items.reduce((s, i) => s + (axis === "h" ? i.r.w : i.r.h), 0);
  const gap = (span - total) / (items.length - 1);
  let pos = axis === "h" ? first.x : first.y;
  const shift = new Map<string, number>();
  for (const { e, r } of items) {
    shift.set(e.id, pos - (axis === "h" ? r.x : r.y));
    pos += (axis === "h" ? r.w : r.h) + gap;
  }
  return updateElements(doc, ids, (el) => {
    const d = shift.get(el.id) ?? 0;
    if (Math.abs(d) < 0.01) return el;
    return axis === "h" ? { ...el, x: el.x + d } : { ...el, y: el.y + d };
  });
}

export function groupElements(doc: CanvasDoc, ids: readonly string[]): CanvasDoc {
  if (ids.length < 2) return doc;
  const group = newId();
  return updateElements(doc, ids, (el) => ({ ...el, group }));
}

export function ungroupElements(doc: CanvasDoc, ids: readonly string[]): CanvasDoc {
  return updateElements(doc, ids, (el) => (el.group ? { ...el, group: null } : el));
}

/** Rotate elements about a point (each element also turns by the same angle). */
export function rotateElements(base: CanvasDoc, ids: readonly string[], about: Point, delta: number): CanvasDoc {
  if (!delta) return base;
  return updateElements(base, ids, (el) => {
    const c = rotatePoint(center(el), about, delta);
    let rot = (el.rot + delta) % 360;
    if (rot > 180) rot -= 360;
    if (rot <= -180) rot += 360;
    return { ...el, x: c.x - el.w / 2, y: c.y - el.h / 2, rot: Math.round(rot * 100) / 100 };
  });
}

/** Scale elements about a point by k (text sizes, strokes and shadows too). */
export function scaleElements(base: CanvasDoc, ids: readonly string[], about: Point, k: number, ctx?: CanvasRenderContext): CanvasDoc {
  if (!(k > 0) || close(k, 1)) return base;
  return updateElements(
    base,
    ids,
    (el) => {
      const c0 = center(el);
      const c = { x: about.x + (c0.x - about.x) * k, y: about.y + (c0.y - about.y) * k };
      const w = clampLen(el.w * k);
      const h = clampLen(el.h * k);
      const next = { ...el, x: c.x - w / 2, y: c.y - h / 2, w, h } as CanvasElement;
      if (next.type === "text") next.size = Math.min(600, Math.max(6, Math.round(next.size * k * 10) / 10));
      if (next.type === "shape") {
        next.strokeWidth = Math.min(60, next.strokeWidth * k);
        next.radius = Math.min(1000, next.radius * k);
      }
      if (next.type === "image" && next.shadow) {
        const s = next.shadow;
        next.shadow = { ...s, blur: Math.min(60, s.blur * k), x: Math.max(-80, Math.min(80, s.x * k)), y: Math.max(-80, Math.min(80, s.y * k)) };
      }
      return next;
    },
    ctx,
  );
}

const SHAPE_NAMES: Record<string, string> = {
  rect: "Rectangle",
  ellipse: "Circle",
  line: "Line",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  heart: "Heart",
  arch: "Arch",
  hexagon: "Hexagon",
};

const FIELD_NAMES: Record<string, string> = {
  guest: "Guest's name",
  admits: "Number of guests",
  date: "Date",
  time: "Time",
  venue: "Venue",
  address: "Address",
  hosts: "Hosts",
  title: "Title",
};

/** The layer's name: its own, or one made from what it is. */
export function elementLabel(el: CanvasElement, ctx?: CanvasRenderContext): string {
  if (el.name) return el.name;
  switch (el.type) {
    case "image":
      if (el.asset) return getAsset(el.asset)?.name.en ?? "Picture";
      return el.upload ? "Photo" : "Photo frame";
    case "text": {
      const m = /^\s*\{(\w+)(?:\.(en|ar))?\}\s*$/.exec(el.text);
      if (m && (FIELDS as readonly string[]).includes(m[1])) {
        const lang = m[2] ?? el.lang;
        return `${FIELD_NAMES[m[1]]}${lang === "ar" ? " (Arabic)" : ""}`;
      }
      const t = (ctx ? textValue(el, ctx) : el.text).replace(/\s+/g, " ").trim();
      return t ? (t.length > 32 ? `${t.slice(0, 31)}…` : t) : "Text";
    }
    case "shape":
      return SHAPE_NAMES[el.shape] ?? "Shape";
    case "divider":
      return "Divider";
    case "qr":
      return "Guest's QR code";
  }
}

/** Where a new element of size w × h goes: centred on a point (default: the page's centre), kept on the page. */
export function placeAt(w: number, h: number, at?: Point): { x: number; y: number } {
  const c = at ?? { x: PAGE.w / 2, y: PAGE.h / 2 };
  return { x: c.x - w / 2, y: c.y - h / 2 };
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** New paper colour; text that would no longer read on it turns light (or dark). Returns how many changed. */
export function withPaper(doc: CanvasDoc, color: string, color2: string | null): { doc: CanvasDoc; recolored: number } {
  let recolored = 0;
  const dark = isDark(color);
  const elements = doc.bg.image
    ? doc.elements
    : doc.elements.map((e) => {
        if (e.type !== "text" || e.foil || contrast(e.color, color) >= 2.2) return e;
        recolored++;
        return { ...e, color: dark ? "#F3EADB" : "#2C2520" };
      });
  return { doc: { ...doc, bg: { ...doc.bg, color, color2 }, elements: recolored ? elements : doc.elements }, recolored };
}
