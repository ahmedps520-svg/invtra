/**
 * Geometry for INVTRA Studio: rotated boxes, the resize and rotate gestures, and snapping. Boxes are
 * card pixels with (x, y) the top-left of the unrotated box and `rot` (degrees, clockwise) about its
 * centre — the same convention the documents use.
 */

export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned rectangle. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle rotated about its centre. */
export interface Box extends Rect {
  rot: number;
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
export const CORNER_HANDLES: Handle[] = ["nw", "ne", "se", "sw"];

const RAD = Math.PI / 180;

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rotatePoint(p: Point, c: Point, deg: number): Point {
  if (!deg) return { x: p.x, y: p.y };
  const a = deg * RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** The four corners of a box (nw, ne, se, sw) after rotation. */
export function corners(b: Box): Point[] {
  const c = center(b);
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ].map((p) => rotatePoint(p, c, b.rot));
}

/** The axis-aligned bounds of a (rotated) box. */
export function bounds(b: Box): Rect {
  if (!b.rot) return { x: b.x, y: b.y, w: b.w, h: b.h };
  const pts = corners(b);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function union(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** A point in a box's own (unrotated) frame, relative to its top-left corner. */
export function toLocal(p: Point, b: Box): Point {
  const q = rotatePoint(p, center(b), -b.rot);
  return { x: q.x - b.x, y: q.y - b.y };
}

export function contains(b: Box, p: Point, pad = 0): boolean {
  const q = toLocal(p, b);
  return q.x >= -pad && q.y >= -pad && q.x <= b.w + pad && q.y <= b.h + pad;
}

/** Rectangle from two corner points (a marquee). */
export function rectFrom(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Which way a handle pulls: -1 / 0 / 1 on each axis. */
export function handleSign(h: Handle): { sx: -1 | 0 | 1; sy: -1 | 0 | 1 } {
  return {
    sx: h.includes("e") ? 1 : h.includes("w") ? -1 : 0,
    sy: h.includes("s") ? 1 : h.includes("n") ? -1 : 0,
  };
}

export function isCorner(h: Handle): boolean {
  return h.length === 2;
}

export interface ResizeOptions {
  /** Keep the width : height ratio (corner handles; side handles then grow both ways). */
  keepRatio?: boolean;
  /** Resize about the centre (Alt). */
  fromCenter?: boolean;
  minW?: number;
  minH?: number;
}

/**
 * The box after dragging one of its handles to `p` (card coordinates). The opposite side stays put
 * (or the centre, with fromCenter), also when the box is rotated.
 */
export function resizeBox(b0: Box, handle: Handle, p: Point, opts: ResizeOptions = {}): Box {
  const minW = opts.minW ?? 4;
  const minH = opts.minH ?? 4;
  const { sx, sy } = handleSign(handle);
  const c0 = center(b0);
  // Pointer in the box's frame, origin at its centre.
  const q = rotatePoint(p, c0, -b0.rot);
  const qx = q.x - c0.x;
  const qy = q.y - c0.y;
  const ax = opts.fromCenter ? 0 : (-sx * b0.w) / 2;
  const ay = opts.fromCenter ? 0 : (-sy * b0.h) / 2;
  let w = b0.w;
  let h = b0.h;
  if (sx) w = Math.max(minW, opts.fromCenter ? 2 * sx * qx : sx * (qx - ax));
  if (sy) h = Math.max(minH, opts.fromCenter ? 2 * sy * qy : sy * (qy - ay));
  if (opts.keepRatio) {
    const ratio = b0.w / b0.h;
    if (sx && sy) {
      const k = Math.max(w / b0.w, h / b0.h);
      w = Math.max(minW, b0.w * k);
      h = w / ratio;
    } else if (sx) {
      h = w / ratio;
    } else {
      w = h * ratio;
    }
    if (h < minH) {
      h = minH;
      w = h * ratio;
    }
  }
  return placeResized(b0, handle, w, h, opts.fromCenter);
}

/** The box resized to w × h by a handle: the opposite side stays put (or the centre, with fromCenter). */
export function placeResized(b0: Box, handle: Handle, w: number, h: number, fromCenter = false): Box {
  const { sx, sy } = handleSign(handle);
  const c0 = center(b0);
  // The new centre, in the box's frame: the anchor plus half the new size on each pulled axis.
  const lx = fromCenter || !sx ? 0 : (-sx * b0.w) / 2 + (sx * w) / 2;
  const ly = fromCenter || !sy ? 0 : (-sy * b0.h) / 2 + (sy * h) / 2;
  const c1 = rotatePoint({ x: c0.x + lx, y: c0.y + ly }, c0, b0.rot);
  return { x: c1.x - w / 2, y: c1.y - h / 2, w, h, rot: b0.rot };
}

/** Degrees from the centre to a point (0 = right, 90 = down). */
export function angleTo(c: Point, p: Point): number {
  return Math.atan2(p.y - c.y, p.x - c.x) / RAD;
}

/** -180 < deg ≤ 180. */
export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.round(a * 100) / 100;
}

/** Rotation while dragging the rotate handle: Shift snaps to 15° steps, otherwise 0/45/90… pull within 3°. */
export function snapAngle(deg: number, step15: boolean): number {
  const a = normalizeAngle(deg);
  if (step15) return normalizeAngle(Math.round(a / 15) * 15);
  const near = Math.round(a / 45) * 45;
  return Math.abs(a - near) <= 3 ? normalizeAngle(near) : a;
}

// ─────────────────────────── snapping ───────────────────────────

export interface Guides {
  /** Vertical guide lines (x positions). */
  x: number[];
  /** Horizontal guide lines (y positions). */
  y: number[];
}

export interface SnapTargets {
  x: number[];
  y: number[];
}

/** Lines things snap to: the card's edges and middle, and each other element's edges and centre. */
export function snapTargets(page: { w: number; h: number }, others: Rect[]): SnapTargets {
  const x = [0, page.w / 2, page.w];
  const y = [0, page.h / 2, page.h];
  for (const r of others) {
    x.push(r.x, r.x + r.w / 2, r.x + r.w);
    y.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  return { x, y };
}

function nearest(values: number[], targets: number[], threshold: number): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const v of values) {
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, line: t };
    }
  }
  return best;
}

/**
 * Snap a rectangle being moved: its edges and centre line up with the targets when within
 * `threshold`. Returns the adjustment and the guide lines to draw.
 */
export function snapRect(r: Rect, targets: SnapTargets, threshold: number): { dx: number; dy: number; guides: Guides } {
  const sx = nearest([r.x, r.x + r.w / 2, r.x + r.w], targets.x, threshold);
  const sy = nearest([r.y, r.y + r.h / 2, r.y + r.h], targets.y, threshold);
  const dx = sx?.delta ?? 0;
  const dy = sy?.delta ?? 0;
  // Every line the snapped rectangle now touches (an edge and the centre can line up at once).
  const moved = { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
  const eps = 0.01;
  const guides: Guides = { x: [], y: [] };
  if (sx) for (const v of [moved.x, moved.x + moved.w / 2, moved.x + moved.w]) if (targets.x.some((t) => Math.abs(t - v) < eps) && !guides.x.includes(v)) guides.x.push(v);
  if (sy) for (const v of [moved.y, moved.y + moved.h / 2, moved.y + moved.h]) if (targets.y.some((t) => Math.abs(t - v) < eps) && !guides.y.includes(v)) guides.y.push(v);
  return { dx, dy, guides };
}

/** Snap single values (an edge being resized). */
export function snapValue(v: number, targets: number[], threshold: number): { value: number; line: number | null } {
  const s = nearest([v], targets, threshold);
  return s ? { value: v + s.delta, line: s.line } : { value: v, line: null };
}
