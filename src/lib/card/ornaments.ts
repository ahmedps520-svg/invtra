import type { InvitationDesign } from "@/lib/design/schema";
import type { CardOrnament } from "@/lib/themes/types";

/**
 * Decorative layers for each theme's invitation card, drawn procedurally so they
 * scale crisply and recolour with the customer's palette.
 */

type Palette = InvitationDesign["palette"];

export interface OrnamentContext {
  W: number;
  H: number;
  palette: Palette;
  /** y coordinate where the footer (QR band) begins. */
  footerTop: number;
  /** Draw the theme texture (false when the customer chose a plain colour / own image). */
  texture: boolean;
}

export interface OrnamentResult {
  background: string;
  foreground: string;
  /** Box available to the main text. */
  content: { x: number; w: number; top: number; bottom: number };
  /** Small motif drawn between the names and the date (centred at 0,0, ~120×28). */
  divider: (cx: number, cy: number, scale: number) => string;
  /** Inset from the canvas edge the footer must respect. */
  bottomPad: number;
  sidePad: number;
}

const f = (n: number) => Number(n.toFixed(2));

export function star(cx: number, cy: number, r: number, points = 8, innerRatio = 0.72): string {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * innerRatio;
    d += `${i === 0 ? "M" : "L"}${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  }
  return d + "Z";
}

function diamond(cx: number, cy: number, r: number) {
  return `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
}

/** A botanical sprig: curved stem with alternating leaves and a few berries. */
function sprig(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bend: number,
  leaves: number,
  leafLen: number,
  color: string,
  opacity = 0.75,
): string {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  const at = (t: number) => ({
    x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1,
    y: (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1,
  });
  const tangent = (t: number) => {
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  let out = `<path d="M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity="${opacity}"/>`;
  for (let i = 1; i <= leaves; i++) {
    const t = i / (leaves + 1);
    const p = at(t);
    const side = i % 2 === 0 ? 1 : -1;
    const ang = tangent(t) + side * 48;
    const L = leafLen * (1 - t * 0.35);
    const Wd = L * 0.36;
    out += `<path transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(ang)})" d="M0 0C${f(L * 0.3)} ${f(-Wd)} ${f(L * 0.75)} ${f(-Wd)} ${f(L)} 0C${f(L * 0.75)} ${f(Wd)} ${f(L * 0.3)} ${f(Wd)} 0 0Z" fill="${color}" opacity="${f(opacity * (0.55 + 0.45 * (i % 3) / 2))}"/>`;
  }
  const tip = at(1);
  const tAng = (tangent(1) * Math.PI) / 180;
  for (let k = 0; k < 3; k++) {
    const a = tAng + (k - 1) * 0.5;
    out += `<circle cx="${f(tip.x + Math.cos(a) * 16)}" cy="${f(tip.y + Math.sin(a) * 16)}" r="${4.5 - k * 0.6}" fill="${color}" opacity="${opacity}"/>`;
  }
  return out;
}

/** Rectangle outline with a gap centred on the top edge (room for a crest). */
function gappedRect(inset: number, W: number, H: number, gap: number) {
  const l = inset;
  const r = W - inset;
  const t = inset;
  const b = H - inset;
  return `M${W / 2 - gap / 2} ${t}H${l}V${b}H${r}V${t}H${W / 2 + gap / 2}`;
}

function cornerFlourish(x: number, y: number, sx: 1 | -1, sy: 1 | -1, color: string) {
  return `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round">
<path d="M0 64C0 28 28 0 64 0"/>
<path d="M16 118C16 62 62 16 118 16" stroke-width="1.2" opacity="0.8"/>
<path d="M64 0C96 0 106 22 90 38C79 49 62 38 71 28"/>
<path d="M0 64C0 96 22 106 38 90C49 79 38 62 28 71"/>
<circle cx="38" cy="38" r="5" fill="${color}" stroke="none"/>
</g>`;
}

function decoCorner(x: number, y: number, sx: 1 | -1, sy: 1 | -1, color: string) {
  let d = "";
  for (let i = 0; i < 3; i++) {
    const o = i * 9;
    const l = 46 - i * 12;
    d += `M${o} ${o + l}V${o}H${o + l}`;
  }
  return `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/>
<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="${diamond(30, 30, 5)}" fill="${color}"/>`;
}

function hairlineDivider(color: string) {
  return (cx: number, cy: number, s: number) =>
    `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="M-70 0H-14M14 0H70" stroke="${color}" stroke-width="1.4"/><path d="${diamond(0, 0, 6)}" fill="${color}"/></g>`;
}

function diamondDivider(color: string) {
  return (cx: number, cy: number, s: number) =>
    `<g transform="translate(${cx} ${cy}) scale(${s})" fill="${color}"><path d="M-90 0H-22M22 0H90" stroke="${color}" stroke-width="1.2"/><path d="${diamond(0, 0, 9)}"/><path d="${diamond(-16, 0, 4)}"/><path d="${diamond(16, 0, 4)}"/></g>`;
}

function floralDivider(color: string) {
  return (cx: number, cy: number, s: number) =>
    `<g transform="translate(${cx} ${cy}) scale(${s})">${sprig(-8, 0, -96, -4, 10, 4, 22, color, 0.85)}${sprig(8, 0, 96, -4, -10, 4, 22, color, 0.85)}<circle cx="0" cy="0" r="4" fill="${color}"/></g>`;
}

function dotsDivider(color: string) {
  return (cx: number, cy: number, s: number) =>
    `<g transform="translate(${cx} ${cy}) scale(${s})" fill="${color}"><rect x="-34" y="-5" width="10" height="10"/><rect x="-14" y="-5" width="10" height="10" opacity="0.6"/><rect x="6" y="-5" width="10" height="10"/><rect x="26" y="-5" width="10" height="10" opacity="0.35"/></g>`;
}

function starDivider(color: string) {
  return (cx: number, cy: number, s: number) =>
    `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="M-96 0H-24M24 0H96" stroke="${color}" stroke-width="1.2"/><path d="${star(0, 0, 13)}" fill="${color}"/><circle cx="-34" cy="0" r="2.5" fill="${color}"/><circle cx="34" cy="0" r="2.5" fill="${color}"/></g>`;
}

export function buildOrnament(kind: CardOrnament, ctx: OrnamentContext): OrnamentResult {
  const { W, H, palette: p, footerTop, texture } = ctx;
  const a = p.accent;
  switch (kind) {
    case "deco": {
      const background = texture
        ? `<defs><radialGradient id="vg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${p.surface}"/><stop offset="1" stop-color="${p.background}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#vg)"/>`
        : "";
      let rays = "";
      for (let deg = 25; deg <= 155; deg += 10) {
        const r = (deg * Math.PI) / 180;
        rays += `M${f(W / 2 + Math.cos(r) * 34)} ${f(52 + Math.sin(r) * 34)}L${f(W / 2 + Math.cos(r) * 84)} ${f(52 + Math.sin(r) * 84)}`;
      }
      const foreground =
        `<path d="${gappedRect(40, W, H, 220)}" fill="none" stroke="${a}" stroke-width="2.4"/>` +
        `<path d="${gappedRect(54, W, H, 220)}" fill="none" stroke="${a}" stroke-width="0.9" opacity="0.7"/>` +
        decoCorner(66, 66, 1, 1, a) +
        decoCorner(W - 66, 66, -1, 1, a) +
        decoCorner(66, H - 66, 1, -1, a) +
        decoCorner(W - 66, H - 66, -1, -1, a) +
        `<path d="${rays}" stroke="${a}" stroke-width="1.6" opacity="0.85"/>` +
        `<path d="M${W / 2 - 26} 52A26 26 0 0 0 ${W / 2 + 26} 52Z" fill="${a}"/>`;
      return { background, foreground, content: { x: 150, w: W - 300, top: 190, bottom: footerTop - 30 }, divider: diamondDivider(a), bottomPad: 100, sidePad: 120 };
    }
    case "floral": {
      const background = texture
        ? `<defs><radialGradient id="glow" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${p.surface}" stop-opacity="0.95"/><stop offset="1" stop-color="${p.background}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#glow)"/>`
        : "";
      const foreground =
        sprig(-30, 300, 330, -30, -60, 9, 54, a, 0.7) +
        sprig(-30, 160, 170, -30, 30, 5, 40, a, 0.5) +
        sprig(W + 30, 230, W - 260, -30, 50, 7, 46, a, 0.55) +
        sprig(W + 30, H - 230, W - 230, H + 30, -40, 6, 44, a, 0.5) +
        sprig(-30, H - 200, 200, H + 30, 40, 5, 40, a, 0.45);
      return { background, foreground, content: { x: 150, w: W - 300, top: 200, bottom: footerTop - 30 }, divider: floralDivider(a), bottomPad: 80, sidePad: 110 };
    }
    case "geometric": {
      let modules = "";
      const cells = [
        [0, 0], [1, 0], [3, 0], [0, 1], [2, 1], [3, 1], [1, 2], [3, 2], [0, 3], [2, 3],
      ];
      for (const [cx, cy] of cells) modules += `<rect x="${86 + cx * 20}" y="${86 + cy * 20}" width="14" height="14" fill="${a}" opacity="${0.35 + ((cx + cy) % 3) * 0.2}"/>`;
      const r = (W - 260) / 2;
      const top = 140;
      const panelPath = `M130 ${top + r}A${r} ${r} 0 0 1 ${W - 130} ${top + r}V${H - 70}H130Z`;
      const background =
        (texture ? `<circle cx="${W - 150}" cy="210" r="330" fill="${a}" opacity="0.08"/><circle cx="160" cy="${H - 160}" r="210" fill="${a}" opacity="0.05"/>` : "") +
        `<path d="${panelPath}" fill="${p.surface}"/>`;
      const foreground =
        modules +
        `<path d="M${W - 70} 120V420" stroke="${a}" stroke-width="2"/>` +
        `<path transform="translate(${W / 2} ${top + r}) scale(0.965) translate(${-W / 2} ${-(top + r)})" d="M130 ${top + r}A${r} ${r} 0 0 1 ${W - 130} ${top + r}V${H - 70}" fill="none" stroke="${a}" stroke-width="1.4" opacity="0.6"/>`;
      return { background, foreground, content: { x: 190, w: W - 380, top: 300, bottom: footerTop - 30 }, divider: dotsDivider(a), bottomPad: 105, sidePad: 170 };
    }
    case "baroque": {
      const background = texture
        ? `<defs><radialGradient id="pv" cx="50%" cy="50%" r="70%"><stop offset="0.55" stop-color="${p.background}" stop-opacity="0"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0.10"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#pv)"/>`
        : "";
      const crest =
        `<path d="${diamond(W / 2, 44, 13)}" fill="${a}"/>` +
        `<path d="M${W / 2 - 18} 44C${W / 2 - 40} 22 ${W / 2 - 64} 52 ${W / 2 - 44} 58M${W / 2 + 18} 44C${W / 2 + 40} 22 ${W / 2 + 64} 52 ${W / 2 + 44} 58" fill="none" stroke="${a}" stroke-width="2"/>`;
      const foreground =
        `<path d="${gappedRect(34, W, H, 160)}" fill="none" stroke="${a}" stroke-width="3"/>` +
        `<path d="${gappedRect(48, W, H, 160)}" fill="none" stroke="${a}" stroke-width="1"/>` +
        cornerFlourish(62, 62, 1, 1, a) +
        cornerFlourish(W - 62, 62, -1, 1, a) +
        cornerFlourish(62, H - 62, 1, -1, a) +
        cornerFlourish(W - 62, H - 62, -1, -1, a) +
        crest;
      return { background, foreground, content: { x: 160, w: W - 320, top: 200, bottom: footerTop - 30 }, divider: diamondDivider(a), bottomPad: 100, sidePad: 130 };
    }
    case "arabesque": {
      const archTop = 132;
      const spring = 430;
      const L = 150;
      const R = W - 150;
      const rad = 560;
      const arch = (inset: number) =>
        `M${L + inset} ${footerTop - 10}V${spring}A${rad - inset} ${rad - inset} 0 0 1 ${W / 2} ${archTop + inset}A${rad - inset} ${rad - inset} 0 0 1 ${R - inset} ${spring}V${footerTop - 10}`;
      let pattern = "";
      if (texture) {
        for (let y = 0; y < H; y += 90) for (let x = (y / 90) % 2 ? 45 : 0; x < W; x += 90) pattern += star(x, y, 9);
      }
      const background = texture ? `<path d="${pattern}" fill="${a}" opacity="0.06"/>` : "";
      const foreground =
        `<rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${a}" stroke-width="1.6"/>` +
        [
          [36, 36],
          [W - 36, 36],
          [36, H - 36],
          [W - 36, H - 36],
        ]
          .map(([x, y]) => `<path d="${star(x, y, 26)}" fill="${p.background}" stroke="${a}" stroke-width="1.6"/><path d="${star(x, y, 13)}" fill="${a}"/>`)
          .join("") +
        `<path d="${arch(0)}" fill="none" stroke="${a}" stroke-width="2.2"/>` +
        `<path d="${arch(14)}" fill="none" stroke="${a}" stroke-width="0.9" opacity="0.7"/>` +
        `<path d="${star(W / 2, archTop - 46, 16)}" fill="${a}"/>`;
      return { background, foreground, content: { x: 190, w: W - 380, top: 262, bottom: footerTop - 34 }, divider: starDivider(a), bottomPad: 95, sidePad: 180 };
    }
    case "arch": {
      const r = 400;
      const cy = 140 + r;
      const arch = (inset: number) =>
        `M${W / 2 - r + inset} ${footerTop - 10}V${cy}A${r - inset} ${r - inset} 0 0 1 ${W / 2 + r - inset} ${cy}V${footerTop - 10}`;
      const background = texture ? `<path d="M${W / 2 - r} ${H}V${cy}A${r} ${r} 0 0 1 ${W / 2 + r} ${cy}V${H}Z" fill="${p.surface}" opacity="0.8"/>` : "";
      const foreground =
        `<path d="${arch(0)}" fill="none" stroke="${a}" stroke-width="2"/>` +
        `<path d="${arch(14)}" fill="none" stroke="${a}" stroke-width="0.8" opacity="0.7"/>` +
        `<path d="${star(W / 2, 98, 15, 4, 0.35)}" fill="${a}"/>` +
        `<circle cx="${W / 2 - 34}" cy="98" r="2.5" fill="${a}"/><circle cx="${W / 2 + 34}" cy="98" r="2.5" fill="${a}"/>`;
      return { background, foreground, content: { x: 200, w: W - 400, top: 260, bottom: footerTop - 30 }, divider: starDivider(a), bottomPad: 80, sidePad: 160 };
    }
    case "hairline":
    default: {
      const foreground =
        `<rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${p.muted}" stroke-opacity="0.35" stroke-width="1.5"/>` +
        `<path d="M${W / 2 - 110} 120H${W / 2 - 22}M${W / 2 + 22} 120H${W / 2 + 110}" stroke="${a}" stroke-width="1.4"/>` +
        `<path d="${diamond(W / 2, 120, 7)}" fill="${a}"/>`;
      return { background: "", foreground, content: { x: 130, w: W - 260, top: 175, bottom: footerTop - 30 }, divider: hairlineDivider(a), bottomPad: 80, sidePad: 110 };
    }
  }
}
