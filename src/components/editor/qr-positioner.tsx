"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { CardPreview } from "@/components/invitation/card-preview";
import type { CardImage } from "@/lib/card/build";
import type { InvitationDesign } from "@/lib/design/schema";
import { clamp } from "@/lib/utils";

type CustomQr = InvitationDesign["customQr"];

/* Plate geometry used by buildCustomCardSvg: QR q = size·W, padding 8% on each side, caption 16% below. */
const PLATE_W = 1.16;
const PLATE_H = 1.32;
export const QR_MIN = 0.12;
export const QR_MAX = 0.45;

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Keep the plate fully on the image (the renderer clamps the same way). */
export function clampQr(v: CustomQr, aspect: number): CustomQr {
  const size = clamp(v.size, QR_MIN, QR_MAX);
  const halfW = (PLATE_W * size) / 2;
  const halfH = (PLATE_H * size) / aspect / 2;
  const x = halfW >= 0.5 ? 0.5 : clamp(v.x, halfW, 1 - halfW);
  const y = halfH >= 0.5 ? 0.5 : clamp(v.y, halfH, 1 - halfH);
  return { x: round(x), y: round(y), size: round(size) };
}

/**
 * The customer's own invitation with the QR plate drawn exactly as guests receive it,
 * plus a draggable / resizable handle over the plate. Arrow keys nudge, +/− resize.
 */
export function QrPositioner({
  image,
  design,
  themeKey,
  language,
  onChange,
  label,
  describedBy,
}: {
  image: CardImage;
  design: InvitationDesign;
  themeKey: string;
  language: "EN" | "AR" | "BILINGUAL";
  onChange: (v: CustomQr) => void;
  label: string;
  describedBy?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; px: number; py: number; start: CustomQr; w: number; h: number } | null>(null);
  const liveId = useId();
  const aspect = image.height / image.width;
  const v = clampQr(design.customQr, aspect);
  const plateW = PLATE_W * v.size;
  const plateH = (PLATE_H * v.size) / aspect;

  const begin = (mode: "move" | "resize", e: ReactPointerEvent<HTMLElement>) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, start: v, w: rect.width, h: rect.height };
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / d.w;
    const dy = (e.clientY - d.py) / d.h;
    if (d.mode === "move") {
      onChange(clampQr({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }, aspect));
    } else {
      // Corner handle: the plate grows symmetrically around its centre.
      const fromX = (2 * dx) / PLATE_W;
      const fromY = (2 * dy * aspect) / PLATE_H;
      onChange(clampQr({ ...d.start, size: d.start.size + (fromX + fromY) / 2 }, aspect));
    }
  };

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    let next: CustomQr | null = null;
    if (e.key === "ArrowLeft") next = { ...v, x: v.x - step };
    else if (e.key === "ArrowRight") next = { ...v, x: v.x + step };
    else if (e.key === "ArrowUp") next = { ...v, y: v.y - step };
    else if (e.key === "ArrowDown") next = { ...v, y: v.y + step };
    else if (e.key === "+" || e.key === "=") next = { ...v, size: v.size + step };
    else if (e.key === "-" || e.key === "_") next = { ...v, size: v.size - step };
    if (!next) return;
    e.preventDefault();
    onChange(clampQr(next, aspect));
  };

  return (
    <div ref={boxRef} className="relative mx-auto w-full touch-none select-none overflow-hidden rounded-[3px] shadow-lift" dir="ltr">
      <CardPreview themeKey={themeKey} design={{ ...design, customQr: v }} language={language} customImage={image} qrPlaceholder title={label} />
      <div
        role="group"
        tabIndex={0}
        aria-label={label}
        aria-describedby={[describedBy, liveId].filter(Boolean).join(" ")}
        onPointerDown={(e) => begin("move", e)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        className="group absolute cursor-grab rounded-[10%] outline-none ring-2 ring-bronze-500/0 ring-offset-0 transition-[box-shadow] duration-200 hover:ring-bronze-500/80 focus-visible:ring-bronze-500 active:cursor-grabbing"
        style={{
          left: `${(v.x - plateW / 2) * 100}%`,
          top: `${(v.y - plateH / 2) * 100}%`,
          width: `${plateW * 100}%`,
          height: `${plateH * 100}%`,
          boxShadow: "0 0 0 1px rgb(255 255 255 / 0.9), 0 0 0 3px rgb(132 102 74 / 0.75), 0 10px 30px -8px rgb(30 26 22 / 0.45)",
        }}
      >
        <span
          aria-hidden="true"
          onPointerDown={(e) => begin("resize", e)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute -bottom-2.5 -right-2.5 flex size-6 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-bronze-600 shadow-lift transition-transform duration-200 hover:scale-110"
        >
          <svg viewBox="0 0 12 12" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 10.5h6.5V4M2 8l6-6" />
          </svg>
        </span>
      </div>
      <span id={liveId} className="sr-only" aria-live="polite">
        {`${Math.round(v.x * 100)}%, ${Math.round(v.y * 100)}%, ${Math.round(v.size * 100)}%`}
      </span>
    </div>
  );
}
