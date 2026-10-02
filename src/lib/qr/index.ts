import QRCode from "qrcode";
import { MARK_PATH } from "@/lib/brand/logo-paths";

/**
 * Styled QR codes rendered as SVG (works in the browser and on the server).
 *
 * Reliability rules (verified by tests that decode the rendered PNG):
 *  - error correction H whenever a centre logo is drawn (logo covers < 6% of the symbol)
 *  - quiet zone of 4 modules, dark modules on a light plate, contrast ≥ 7:1 enforced
 *  - finder patterns keep their 1:1:3:1:1 ratios even when rounded
 */

export type QrStyle = "rounded" | "dots" | "classic";

export interface QrOptions {
  text: string;
  /** Rendered edge length in px, quiet zone included. */
  size: number;
  style?: QrStyle;
  fg?: string;
  bg?: string;
  logo?: boolean;
  logoColor?: string;
  quietZone?: number;
}

type Matrix = { size: number; get: (r: number, c: number) => boolean };

function buildMatrix(text: string, ec: "M" | "Q" | "H"): Matrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ec });
  const m = qr.modules;
  return { size: m.size, get: (r, c) => Boolean(m.data[r * m.size + c]) };
}

function isFinder(r: number, c: number, n: number) {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return (
    `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
  );
}

function finderPath(x: number, y: number, style: QrStyle) {
  const outerR = style === "classic" ? 0 : style === "dots" ? 2.6 : 1.9;
  const innerR = style === "classic" ? 0 : style === "dots" ? 1.9 : 1.2;
  const eyeR = style === "classic" ? 0 : style === "dots" ? 1.5 : 0.8;
  // Ring = outer 7×7 minus inner 5×5 (even-odd), plus the 3×3 eye.
  return roundedRect(x, y, 7, 7, outerR) + roundedRect(x + 1, y + 1, 5, 5, innerR) + roundedRect(x + 2, y + 2, 3, 3, eyeR);
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Pick scanner-safe colours from a palette: dark modules on a light plate. Falls back
 * to near-black on white if the palette cannot reach 7:1.
 */
export function safeQrColors(preferredFg: string, preferredBg: string): { fg: string; bg: string } {
  let fg = preferredFg;
  let bg = preferredBg;
  if (luminance(bg) < 0.6) bg = "#FFFFFF";
  if (luminance(fg) > luminance(bg)) [fg, bg] = [bg, fg];
  if (contrastRatio(fg, bg) < 7) fg = "#141210";
  if (contrastRatio(fg, bg) < 7) bg = "#FFFFFF";
  return { fg, bg };
}

/** Returns the QR as an SVG <g> placed at (x, y), sized `size`×`size`. */
export function qrSvgGroup(opts: QrOptions, x = 0, y = 0): string {
  const style = opts.style ?? "rounded";
  const { fg, bg } = safeQrColors(opts.fg ?? "#141210", opts.bg ?? "#FFFFFF");
  const quiet = opts.quietZone ?? 4;
  const withLogo = opts.logo ?? false;
  const matrix = buildMatrix(opts.text, withLogo ? "H" : "Q");
  const n = matrix.size;
  const total = n + quiet * 2;
  const scale = opts.size / total;

  // Logo hole: an odd number of modules ≈ 22% of the symbol width, centred.
  let hole = 0;
  if (withLogo) {
    hole = Math.round(n * 0.22);
    if (hole % 2 === 0) hole += 1;
  }
  const hs = Math.floor((n - hole) / 2);
  const inHole = (r: number, c: number) => withLogo && r >= hs - 1 && r < hs + hole + 1 && c >= hs - 1 && c < hs + hole + 1;

  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix.get(r, c) || isFinder(r, c, n) || inHole(r, c)) continue;
      const mx = c + quiet;
      const my = r + quiet;
      if (style === "dots") {
        const rad = 0.43;
        d += `M${mx + 0.5 - rad} ${my + 0.5}a${rad} ${rad} 0 1 0 ${rad * 2} 0a${rad} ${rad} 0 1 0 ${-rad * 2} 0z`;
      } else if (style === "rounded") {
        d += roundedRect(mx + 0.04, my + 0.04, 0.92, 0.92, 0.32);
      } else {
        d += `M${mx} ${my}h1v1h-1z`;
      }
    }
  }
  const finders =
    finderPath(quiet, quiet, style) + finderPath(quiet + n - 7, quiet, style) + finderPath(quiet, quiet + n - 7, style);

  let logo = "";
  if (withLogo) {
    const lx = quiet + hs;
    const ly = quiet + hs;
    const pad = hole * 0.14;
    // Mark viewBox is 372×387 — fit inside the hole with padding.
    const box = hole - pad * 2;
    const s = box / 387;
    const ox = lx + pad + (box - 372 * s) / 2;
    const oy = ly + pad;
    logo =
      `<path d="${roundedRect(lx - 0.2, ly - 0.2, hole + 0.4, hole + 0.4, hole * 0.22)}" fill="${bg}"/>` +
      `<path transform="translate(${ox.toFixed(3)} ${oy.toFixed(3)}) scale(${s.toFixed(5)})" fill="${opts.logoColor ?? fg}" fill-rule="evenodd" d="${MARK_PATH}"/>`;
  }

  return (
    `<g transform="translate(${x} ${y}) scale(${scale.toFixed(5)})">` +
    `<path d="${roundedRect(0, 0, total, total, style === "classic" ? 0 : 2.2)}" fill="${bg}"/>` +
    `<path d="${d}" fill="${fg}"/>` +
    `<path d="${finders}" fill="${fg}" fill-rule="evenodd"/>` +
    logo +
    `</g>`
  );
}

export function qrSvg(opts: QrOptions): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.size} ${opts.size}" width="${opts.size}" height="${opts.size}">${qrSvgGroup(opts)}</svg>`;
}

/**
 * The URL encoded in a guest's QR. Upper-case so the whole string fits QR
 * alphanumeric mode (smaller symbol, larger modules → faster, more reliable scans).
 * /Q/<token> records the scan and redirects to the invitation page /i/<token>.
 */
export function qrTargetUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/Q/${token}`.toUpperCase();
}
