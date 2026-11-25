"use client";

import { memo, useMemo } from "react";
import { backgroundMarkup, backingColor, buildCanvasSvg, elementMarkup, type CanvasRenderContext } from "@/lib/canvas/render";
import { CANVAS_H, CANVAS_W, EMPTY_CANVAS, type CanvasBackground, type CanvasDoc, type CanvasElement } from "@/lib/canvas/schema";

/**
 * The card as the editor draws it: each element is its own <g>, drawn at the origin and placed by a
 * transform, so moving or turning something only changes that transform (its pictures aren't
 * reloaded), and only elements that changed are drawn again.
 */

const cache = new WeakMap<CanvasRenderContext, Map<string, string>>();

function cached(ctx: CanvasRenderContext, key: string, make: () => string): string {
  let m = cache.get(ctx);
  if (!m) {
    m = new Map();
    cache.set(ctx, m);
  }
  let v = m.get(key);
  if (v === undefined) {
    if (m.size > 3000) m.clear();
    v = make();
    m.set(key, v);
  }
  return v;
}

const docs = new Map<string, CanvasDoc>();
/** A stand-in document carrying only what elements read from it (the paper colour behind printed pieces). */
function docWithBacking(backing: string): CanvasDoc {
  let d = docs.get(backing);
  if (!d) {
    d = { ...EMPTY_CANVAS, bg: { ...EMPTY_CANVAS.bg, color: backing } };
    docs.set(backing, d);
  }
  return d;
}

/** Everything about an element except where it is and how it's turned. */
function contentKey(el: CanvasElement): string {
  return JSON.stringify(el, function (this: unknown, k: string, v: unknown) {
    return this === el && (k === "x" || k === "y" || k === "rot") ? undefined : v;
  });
}

function localMarkup(el: CanvasElement, backing: string, ctx: CanvasRenderContext): string {
  const key = contentKey(el) + (el.type === "image" ? `|${backing}` : "");
  return cached(ctx, key, () => elementMarkup({ ...el, x: 0, y: 0, rot: 0 } as CanvasElement, docWithBacking(backing), ctx));
}

const r2 = (v: number) => Math.round(v * 100) / 100;

const ElementNode = memo(function ElementNode({ el, backing, ctx, ghost }: { el: CanvasElement; backing: string; ctx: CanvasRenderContext; ghost: boolean }) {
  const markup = localMarkup(el, backing, ctx);
  const t = `translate(${r2(el.x)} ${r2(el.y)})${el.rot ? ` rotate(${r2(el.rot)} ${r2(el.w / 2)} ${r2(el.h / 2)})` : ""}`;
  return <g data-id={el.id} transform={t} opacity={ghost ? 0 : undefined} dangerouslySetInnerHTML={{ __html: markup }} />;
});

const Background = memo(function Background({ bg, ctx }: { bg: CanvasBackground; ctx: CanvasRenderContext }) {
  const markup = cached(ctx, `bg|${JSON.stringify(bg)}`, () => backgroundMarkup(bg, ctx));
  return <g dangerouslySetInnerHTML={{ __html: markup }} />;
});

export function EditCard({ doc, ctx, ghostId }: { doc: CanvasDoc; ctx: CanvasRenderContext; ghostId: string | null }) {
  const backing = backingColor(doc.bg);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width="100%"
      height="100%"
      className="block select-none"
      aria-label="Invitation card"
      role="img"
    >
      <Background bg={doc.bg} ctx={ctx} />
      {doc.elements.map((el) => (
        <ElementNode key={el.id} el={el} backing={backing} ctx={ctx} ghost={el.id === ghostId} />
      ))}
    </svg>
  );
}

/** The finished card exactly as guests get it (no editor helpers). */
export function PreviewCard({ doc, ctx }: { doc: CanvasDoc; ctx: CanvasRenderContext }) {
  const svg = useMemo(() => buildCanvasSvg(doc, ctx), [doc, ctx]);
  return <div className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
