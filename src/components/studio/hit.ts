import { assetThumb, getAsset } from "@/lib/canvas/assets";
import { contains, toLocal, type Point } from "@/lib/canvas/geometry";
import { boxOf } from "@/lib/canvas/ops";
import type { CanvasDoc, CanvasElement } from "@/lib/canvas/schema";

/**
 * Picking what's under the pointer. Painted pieces are picked by their paint, not their box (the
 * transparent corners of a flower don't hide what's beneath), using each piece's thumbnail's alpha.
 */

interface Mask {
  w: number;
  h: number;
  a: Uint8ClampedArray;
}

const masks = new Map<string, Mask | "loading" | "failed">();

/** Start loading the alpha masks of the pieces a document uses. */
export function preloadMasks(doc: CanvasDoc): void {
  if (typeof window === "undefined") return;
  for (const el of doc.elements) {
    if (el.type !== "image" || !el.asset || masks.has(el.asset)) continue;
    const id = el.asset;
    masks.set(id, "loading");
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g) throw new Error("no 2d");
        g.drawImage(img, 0, 0);
        const data = g.getImageData(0, 0, c.width, c.height).data;
        const a = new Uint8ClampedArray(c.width * c.height);
        for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3];
        masks.set(id, { w: c.width, h: c.height, a });
      } catch {
        masks.set(id, "failed");
      }
    };
    img.onerror = () => masks.set(id, "failed");
    img.src = assetThumb(id);
  }
}

/** Is the piece painted at this point (true when its mask isn't known yet)? */
function paintedAt(el: Extract<CanvasElement, { type: "image" }>, p: Point, pad: number): boolean {
  if (!el.asset) return true;
  const m = masks.get(el.asset);
  if (!m || typeof m === "string") return true;
  const q = toLocal(p, boxOf(el));
  let lx = q.x / el.w;
  let ly = q.y / el.h;
  if (el.flipX) lx = 1 - lx;
  if (el.flipY) ly = 1 - ly;
  const [c0, c1, c2, c3] = el.crop ?? [0, 0, 1, 1];
  const u = (c0 + lx * (c2 - c0)) * m.w;
  const v = (c1 + ly * (c3 - c1)) * m.h;
  // A few pixels of slack, so thin stems and petals are easy to catch.
  const r = Math.max(1, Math.round((pad / el.w) * m.w));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = Math.round(u + dx);
      const y = Math.round(v + dy);
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      if (m.a[y * m.w + x] > 24) return true;
    }
  }
  return false;
}

/** Outline-only shapes (frames) are picked on their line, not inside. */
function onOutline(el: Extract<CanvasElement, { type: "shape" }>, p: Point, pad: number): boolean {
  const q = toLocal(p, boxOf(el));
  const t = pad + el.strokeWidth / 2;
  if (el.shape === "ellipse") {
    const rx = el.w / 2;
    const ry = el.h / 2;
    const d = Math.hypot((q.x - rx) / rx, (q.y - ry) / ry);
    return Math.abs(d - 1) * Math.min(rx, ry) <= t;
  }
  return q.x <= t || q.y <= t || el.w - q.x <= t || el.h - q.y <= t;
}

/** Elements under a point, topmost first. `pad` is in card pixels (a few screen pixels). */
export function elementsAt(doc: CanvasDoc, p: Point, pad: number): CanvasElement[] {
  const out: CanvasElement[] = [];
  for (let i = doc.elements.length - 1; i >= 0; i--) {
    const el = doc.elements[i];
    if (el.hidden) continue;
    const extra = el.type === "shape" && el.shape === "line" ? Math.max(pad, 10) : pad;
    if (!contains(boxOf(el), p, extra)) continue;
    if (el.type === "image" && !paintedAt(el, p, pad)) continue;
    if (el.type === "shape" && !el.fill && !el.foil && el.shape !== "line" && !onOutline(el, p, pad)) continue;
    out.push(el);
  }
  return out;
}

/** A label for a piece in the library or on the card. */
export function assetName(id: string | null): string {
  return (id && getAsset(id)?.name.en) || "Picture";
}
