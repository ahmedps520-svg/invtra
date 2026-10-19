import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Event, Order } from "@prisma/client";
import { renderSvgToPng } from "@/server/render/card";
import { buildEventCardSvg } from "@/server/invitations/render";

/**
 * Protected previews. Until an order for the event is approved, the invitation leaves the server
 * only as a small, low-quality JPEG stamped "PREVIEW ONLY · LOW RESOLUTION" across the whole card:
 * it is rendered at preview size (never scaled down in the browser from a full-size original), and
 * neither the card's SVG nor the original images are sent to the browser.
 */

export const PREVIEW_WIDTH = 540;
const QUALITY = 55;
export const PREVIEW_LABEL = "PREVIEW ONLY · LOW RESOLUTION";
const PREVIEW_LABEL_AR = "معاينة فقط · دقة منخفضة";

/** The full-quality design may be shown or downloaded: an order for the event has been approved. */
export function isUnlocked(event: Pick<Event, "purchasedAt" | "plan">): boolean {
  return Boolean(event.purchasedAt || event.plan);
}

/** A payment-link order (Admin → Custom events) shows the design in full once it's paid. */
export const orderUnlocked = (order: Pick<Order, "status">) => order.status === "PAID" || order.status === "REFUNDED";

const SAMPLE = { EN: { name: "Sample Guest", allowedCount: 2 }, AR: { name: "ضيف تجريبي", allowedCount: 2 } };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Diagonal repeated label over the whole card, plus a solid band at the foot. */
function watermarkSvg(w: number, h: number): string {
  const rows: string[] = [];
  const step = 92;
  const diag = Math.ceil(Math.hypot(w, h));
  for (let y = -diag; y < diag; y += step) {
    const shift = (Math.abs(y / step) % 2) * 160;
    rows.push(
      `<text x="${-diag + shift}" y="${y}" font-family="Jost" font-weight="600" font-size="22" letter-spacing="3">${esc(`${PREVIEW_LABEL}     `.repeat(14))}</text>`,
    );
  }
  const band = 58;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g transform="translate(${w / 2} ${h / 2}) rotate(-32)">
    <g fill="#ffffff" fill-opacity="0.42" stroke="#1d1a17" stroke-opacity="0.28" stroke-width="0.8">${rows.join("")}</g>
  </g>
  <rect x="0" y="${h - band}" width="${w}" height="${band}" fill="#1d1a17" fill-opacity="0.78"/>
  <text x="${w / 2}" y="${h - band + 25}" text-anchor="middle" fill="#ffffff" font-family="Jost" font-weight="600" font-size="17" letter-spacing="3">${esc(PREVIEW_LABEL)}</text>
  <text x="${w / 2}" y="${h - band + 47}" text-anchor="middle" fill="#ffffff" fill-opacity="0.85" font-family="IBM Plex Sans Arabic" font-weight="500" font-size="14" direction="rtl">${esc(PREVIEW_LABEL_AR)}</text>
</svg>`;
}

/** Watermarks an already-rendered image (PNG or JPEG of any size) into a protected preview. */
export async function protectImage(input: Buffer): Promise<Buffer> {
  const small = await sharp(input)
    .resize({ width: PREVIEW_WIDTH, withoutEnlargement: false })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = small.info;
  const overlay = renderSvgToPng(watermarkSvg(width, height));
  return sharp(small.data)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
}

const cache = new Map<string, Buffer>();
const CACHE_MAX = 150;

/** Design fields the editor can change before saving. */
export type PreviewDraft = Partial<Pick<Event, "themeKey" | "design" | "imageMode" | "customImageKey" | "customImageWidth" | "customImageHeight">>;

/** The event's card (or an unsaved draft of it) as a protected preview JPEG. */
export async function renderProtectedPreview(event: Event, draft: PreviewDraft = {}): Promise<Buffer> {
  const e = { ...event, ...draft } as Event;
  const svg = await buildEventCardSvg(e, { guest: e.language === "AR" ? SAMPLE.AR : SAMPLE.EN, qrPlaceholder: e.product !== "PHOTO_ONLY" });
  const hash = createHash("sha1").update(svg).digest("hex");
  const hit = cache.get(hash);
  if (hit) return hit;
  // Rasterised straight at preview size: no full-size image is ever produced for a preview.
  const png = renderSvgToPng(svg, PREVIEW_WIDTH);
  const jpeg = await protectImage(png);
  cache.set(hash, jpeg);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return jpeg;
}

export function previewResponse(jpeg: Buffer, opts: { cache?: "private" | "public" } = {}): Response {
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.length),
      "Cache-Control": opts.cache === "public" ? "public, max-age=600" : "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
