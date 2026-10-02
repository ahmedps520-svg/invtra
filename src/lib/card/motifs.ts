/**
 * Illustrated motifs (moons, stars, clouds, teddy bear, balloons, lanterns, mandala,
 * crown, flowers, confetti). Pure SVG strings, drawn procedurally so they recolour
 * with each design's palette and stay crisp at any size. Used by the invitation card
 * (ornaments.ts) and the guest website hero (components/invitation/motif.tsx).
 */

const f = (n: number) => Number(n.toFixed(2));

// ── colour helpers ───────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Linear mix of two hex colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Deterministic pseudo-random sequence so cards render identically every time. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── celestial ────────────────────────────────────────────────────────────────

/** Crescent moon (outer circle minus an offset circle), tilted by `rotate` degrees. */
export function crescent(cx: number, cy: number, R: number, fill: string, rotate = -25, opacity = 1): string {
  const d = R * 0.42;
  const r = R * 0.92;
  const x = (R * R - r * r + d * d) / (2 * d);
  const y = Math.sqrt(Math.max(0, R * R - x * x));
  return `<path transform="translate(${f(cx)} ${f(cy)}) rotate(${rotate})" d="M${f(x)} ${f(-y)}A${f(R)} ${f(R)} 0 1 0 ${f(x)} ${f(y)}A${f(r)} ${f(r)} 0 1 1 ${f(x)} ${f(-y)}Z" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ""}/>`;
}

/** Four-pointed sparkle star. */
export function sparkle(cx: number, cy: number, r: number, fill: string, opacity = 1): string {
  return `<path d="M${f(cx)} ${f(cy - r)}Q${f(cx)} ${f(cy)} ${f(cx + r)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy + r)}Q${f(cx)} ${f(cy)} ${f(cx - r)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy - r)}Z" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ""}/>`;
}

/** Classic five-pointed star with softened tips. */
export function star5(cx: number, cy: number, r: number, fill: string, opacity = 1): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    d += `${i === 0 ? "M" : "L"}${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${fill}" stroke-width="${f(r * 0.12)}" stroke-linejoin="round"${opacity !== 1 ? ` opacity="${opacity}"` : ""}/>`;
}

/** Field of tiny stars/dots inside a rectangle, avoiding an optional box. */
export function starField(
  box: { x: number; y: number; w: number; h: number },
  count: number,
  fill: string,
  seed = 7,
  avoid?: { x: number; y: number; w: number; h: number },
): string {
  const rnd = seeded(seed);
  let out = "";
  for (let i = 0, placed = 0; i < count * 4 && placed < count; i++) {
    const x = box.x + rnd() * box.w;
    const y = box.y + rnd() * box.h;
    if (avoid && x > avoid.x && x < avoid.x + avoid.w && y > avoid.y && y < avoid.y + avoid.h) continue;
    const r = 1.2 + rnd() * 2.2;
    out += rnd() > 0.85 ? sparkle(x, y, r * 3, fill, 0.55 + rnd() * 0.4) : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" opacity="${f(0.35 + rnd() * 0.5)}"/>`;
    placed++;
  }
  return out;
}

/** Soft cumulus cloud, `w` wide, sitting on its baseline at cy. */
export function cloud(cx: number, cy: number, w: number, fill: string, opacity = 1, shadow?: string): string {
  const h = w * 0.26;
  const parts =
    `<rect x="${f(cx - w / 2)}" y="${f(cy - h)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}"/>` +
    `<circle cx="${f(cx - w * 0.22)}" cy="${f(cy - h * 0.95)}" r="${f(w * 0.2)}"/>` +
    `<circle cx="${f(cx + w * 0.04)}" cy="${f(cy - h * 1.35)}" r="${f(w * 0.26)}"/>` +
    `<circle cx="${f(cx + w * 0.28)}" cy="${f(cy - h * 0.9)}" r="${f(w * 0.17)}"/>`;
  const sh = shadow
    ? `<g fill="${shadow}" opacity="0.25" transform="translate(${f(w * 0.025)} ${f(h * 0.18)})">${parts}</g>`
    : "";
  return `${sh}<g fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ""}>${parts}</g>`;
}

// ── nursery ──────────────────────────────────────────────────────────────────

/**
 * Seated teddy bear, head centred at (cx, cy) with head radius `s`.
 * Overall height ≈ 3.9 × s (ear tips at cy − 1.1s, feet at cy + 2.8s).
 */
export function teddy(cx: number, cy: number, s: number, c: { fur: string; light: string; dark: string; bow: string }): string {
  const e = (x: number, y: number, rx: number, ry: number, fill: string, rot = 0) =>
    `<ellipse cx="${f(cx + x * s)}" cy="${f(cy + y * s)}" rx="${f(rx * s)}" ry="${f(ry * s)}" fill="${fill}"${rot ? ` transform="rotate(${rot} ${f(cx + x * s)} ${f(cy + y * s)})"` : ""}/>`;
  const circle = (x: number, y: number, r: number, fill: string) => `<circle cx="${f(cx + x * s)}" cy="${f(cy + y * s)}" r="${f(r * s)}" fill="${fill}"/>`;
  const furDark = mix(c.fur, c.dark, 0.18);
  return (
    // body, arms, feet
    e(0, 1.78, 0.98, 0.9, furDark) +
    e(-0.9, 1.45, 0.3, 0.5, c.fur, 28) +
    e(0.9, 1.45, 0.3, 0.5, c.fur, -28) +
    e(0, 1.86, 0.58, 0.55, c.light) +
    e(-0.58, 2.52, 0.4, 0.31, c.fur) +
    e(0.58, 2.52, 0.4, 0.31, c.fur) +
    e(-0.58, 2.55, 0.22, 0.17, c.light) +
    e(0.58, 2.55, 0.22, 0.17, c.light) +
    // ears
    circle(-0.78, -0.74, 0.36, c.fur) +
    circle(0.78, -0.74, 0.36, c.fur) +
    circle(-0.78, -0.72, 0.2, c.light) +
    circle(0.78, -0.72, 0.2, c.light) +
    // head
    circle(0, 0, 1, c.fur) +
    e(0, 0.36, 0.46, 0.35, c.light) +
    e(0, 0.2, 0.15, 0.1, c.dark) +
    `<path d="M${f(cx)} ${f(cy + 0.3 * s)}V${f(cy + 0.42 * s)}M${f(cx - 0.14 * s)} ${f(cy + 0.46 * s)}Q${f(cx)} ${f(cy + 0.56 * s)} ${f(cx + 0.14 * s)} ${f(cy + 0.46 * s)}" stroke="${c.dark}" stroke-width="${f(0.05 * s)}" fill="none" stroke-linecap="round"/>` +
    circle(-0.36, -0.1, 0.085, c.dark) +
    circle(0.36, -0.1, 0.085, c.dark) +
    circle(-0.33, -0.13, 0.03, "#ffffff") +
    circle(0.39, -0.13, 0.03, "#ffffff") +
    `<g opacity="0.35">${circle(-0.62, 0.3, 0.13, c.bow)}${circle(0.62, 0.3, 0.13, c.bow)}</g>` +
    // bow tie
    `<path d="M${f(cx)} ${f(cy + 1.02 * s)}L${f(cx - 0.34 * s)} ${f(cy + 0.86 * s)}L${f(cx - 0.34 * s)} ${f(cy + 1.18 * s)}Z M${f(cx)} ${f(cy + 1.02 * s)}L${f(cx + 0.34 * s)} ${f(cy + 0.86 * s)}L${f(cx + 0.34 * s)} ${f(cy + 1.18 * s)}Z" fill="${c.bow}" stroke="${c.bow}" stroke-width="${f(0.06 * s)}" stroke-linejoin="round"/>` +
    circle(0, 1.02, 0.08, mix(c.bow, c.dark, 0.25))
  );
}

/** Balloon with highlight, knot and a wavy string ending at (toX, toY). */
export function balloon(cx: number, cy: number, r: number, fill: string, string: string, toX?: number, toY?: number): string {
  const by = cy + r * 1.18;
  const sx = toX ?? cx;
  const sy = toY ?? by + r * 2.2;
  const midY = (by + sy) / 2;
  return (
    `<path d="M${f(cx)} ${f(by + r * 0.12)}C${f(cx - r * 0.35)} ${f(midY - r * 0.4)} ${f(sx + r * 0.35)} ${f(midY + r * 0.4)} ${f(sx)} ${f(sy)}" stroke="${string}" stroke-width="1.6" fill="none" opacity="0.8"/>` +
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(r * 1.18)}" fill="${fill}"/>` +
    `<path d="M${f(cx - r * 0.12)} ${f(by + r * 0.14)}L${f(cx + r * 0.12)} ${f(by + r * 0.14)}L${f(cx)} ${f(by - r * 0.04)}Z" fill="${fill}"/>` +
    `<ellipse cx="${f(cx - r * 0.38)}" cy="${f(cy - r * 0.42)}" rx="${f(r * 0.16)}" ry="${f(r * 0.3)}" fill="#ffffff" opacity="0.45" transform="rotate(-25 ${f(cx - r * 0.38)} ${f(cy - r * 0.42)})"/>`
  );
}

export function heart(cx: number, cy: number, s: number, fill: string, opacity = 1): string {
  // Unit heart 24 wide, centred on (0, 0).
  return `<path transform="translate(${f(cx)} ${f(cy)}) scale(${f(s / 12)})" d="M0 -4.5C-2.2 -10 -12 -10 -12 -2.6C-12 3.6 -4.6 7.6 0 11C4.6 7.6 12 3.6 12 -2.6C12 -10 2.2 -10 0 -4.5Z" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ""}/>`;
}

/**
 * Crib mobile: a gentle arc bar hung from the top edge with items on strings.
 * `cx` centre, `top` y of the hook, `w` width of the arc.
 */
export function cribMobile(cx: number, top: number, w: number, c: { line: string; a: string; b: string; cloud: string }): string {
  const barY = top + w * 0.12;
  const sag = w * 0.08;
  // Quadratic arc whose ends hang `sag` below the centre: y(x) = barY + sag·u², u ∈ [-1, 1].
  const yAt = (x: number) => barY + sag * ((x - cx) / (w / 2)) ** 2;
  let out = `<path d="M${f(cx)} ${f(top)}V${f(barY)}" stroke="${c.line}" stroke-width="2"/>`;
  out += `<path d="M${f(cx - w / 2)} ${f(barY + sag)}Q${f(cx)} ${f(barY - sag)} ${f(cx + w / 2)} ${f(barY + sag)}" stroke="${c.line}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  out += `<circle cx="${f(cx)}" cy="${f(barY)}" r="${f(w * 0.012)}" fill="${c.line}"/>`;
  const items: { dx: number; len: number; kind: "star" | "moon" | "cloud" | "heart" }[] = [
    { dx: -0.46, len: 0.1, kind: "star" },
    { dx: -0.23, len: 0.18, kind: "cloud" },
    { dx: 0, len: 0.22, kind: "moon" },
    { dx: 0.23, len: 0.18, kind: "cloud" },
    { dx: 0.46, len: 0.1, kind: "heart" },
  ];
  const sz = w * 0.055;
  for (const it of items) {
    const x = cx + it.dx * w;
    const y0 = yAt(x);
    const y1 = y0 + it.len * w;
    out += `<path d="M${f(x)} ${f(y0)}V${f(y1)}" stroke="${c.line}" stroke-width="1.4" opacity="0.8"/>`;
    if (it.kind === "star") out += star5(x, y1 + sz, sz, c.a);
    if (it.kind === "heart") out += heart(x, y1 - sz * 0.2, sz * 1.5, c.b);
    if (it.kind === "moon") out += crescent(x, y1 + sz * 1.4, sz * 1.5, c.a, -30);
    if (it.kind === "cloud") out += cloud(x, y1 + sz * 1.6, sz * 3.2, c.cloud, 1, c.b);
  }
  return out;
}

// ── festive & cultural ───────────────────────────────────────────────────────

/** Ramadan lantern (fanous) hanging on a chain from `top`; body height `h`. */
export function lantern(cx: number, top: number, chain: number, h: number, c: { metal: string; glow: string; glass: string }): string {
  const w = h * 0.46;
  const y = top + chain;
  const capH = h * 0.22;
  const bodyTop = y + capH;
  const bodyH = h * 0.56;
  const bodyBot = bodyTop + bodyH;
  const baseH = h * 0.12;
  return (
    `<path d="M${f(cx)} ${f(top)}V${f(y - h * 0.06)}" stroke="${c.metal}" stroke-width="1.5" opacity="0.85"/>` +
    `<circle cx="${f(cx)}" cy="${f(y - h * 0.04)}" r="${f(h * 0.035)}" fill="none" stroke="${c.metal}" stroke-width="2"/>` +
    // cap (dome + finial)
    `<path d="M${f(cx - w * 0.5)} ${f(bodyTop)}Q${f(cx - w * 0.45)} ${f(y + capH * 0.25)} ${f(cx)} ${f(y)}Q${f(cx + w * 0.45)} ${f(y + capH * 0.25)} ${f(cx + w * 0.5)} ${f(bodyTop)}Z" fill="${c.metal}"/>` +
    // glass body
    `<path d="M${f(cx - w * 0.5)} ${f(bodyTop)}L${f(cx + w * 0.5)} ${f(bodyTop)}L${f(cx + w * 0.4)} ${f(bodyBot)}L${f(cx - w * 0.4)} ${f(bodyBot)}Z" fill="${c.glass}"/>` +
    `<ellipse cx="${f(cx)}" cy="${f(bodyTop + bodyH * 0.62)}" rx="${f(w * 0.22)}" ry="${f(bodyH * 0.3)}" fill="${c.glow}" opacity="0.55"/>` +
    `<ellipse cx="${f(cx)}" cy="${f(bodyTop + bodyH * 0.66)}" rx="${f(w * 0.09)}" ry="${f(bodyH * 0.14)}" fill="${c.glow}"/>` +
    `<path d="M${f(cx - w * 0.5)} ${f(bodyTop)}L${f(cx + w * 0.5)} ${f(bodyTop)}L${f(cx + w * 0.4)} ${f(bodyBot)}L${f(cx - w * 0.4)} ${f(bodyBot)}ZM${f(cx - w * 0.17)} ${f(bodyTop)}L${f(cx - w * 0.135)} ${f(bodyBot)}M${f(cx + w * 0.17)} ${f(bodyTop)}L${f(cx + w * 0.135)} ${f(bodyBot)}M${f(cx - w * 0.46)} ${f(bodyTop + bodyH * 0.5)}L${f(cx + w * 0.46)} ${f(bodyTop + bodyH * 0.5)}" fill="none" stroke="${c.metal}" stroke-width="2"/>` +
    // inner arch window motif
    `<path d="M${f(cx - w * 0.08)} ${f(bodyTop + bodyH * 0.42)}Q${f(cx)} ${f(bodyTop + bodyH * 0.18)} ${f(cx + w * 0.08)} ${f(bodyTop + bodyH * 0.42)}" fill="none" stroke="${c.metal}" stroke-width="1.4" opacity="0.8"/>` +
    // base + drop
    `<path d="M${f(cx - w * 0.44)} ${f(bodyBot)}L${f(cx + w * 0.44)} ${f(bodyBot)}L${f(cx + w * 0.22)} ${f(bodyBot + baseH)}L${f(cx - w * 0.22)} ${f(bodyBot + baseH)}Z" fill="${c.metal}"/>` +
    `<path d="M${f(cx)} ${f(bodyBot + baseH)}L${f(cx + w * 0.07)} ${f(bodyBot + baseH + h * 0.06)}L${f(cx)} ${f(bodyBot + baseH + h * 0.1)}L${f(cx - w * 0.07)} ${f(bodyBot + baseH + h * 0.06)}Z" fill="${c.metal}"/>`
  );
}

/** Line-art mandala (henna style). */
export function mandala(cx: number, cy: number, r: number, color: string, opacity = 1): string {
  let out = `<g fill="none" stroke="${color}" stroke-width="${f(Math.max(1, r / 150))}"${opacity !== 1 ? ` opacity="${opacity}"` : ""}>`;
  out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.12)}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.2)}"/>`;
  const ring = (n: number, r0: number, r1: number, width: number) => {
    let d = "";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ax = Math.cos(a);
      const ay = Math.sin(a);
      const px = -ay;
      const py = ax;
      const p0 = [cx + ax * r0, cy + ay * r0];
      const p1 = [cx + ax * r1, cy + ay * r1];
      const m = (r0 + r1) / 2;
      d += `M${f(p0[0])} ${f(p0[1])}Q${f(cx + ax * m + px * width)} ${f(cy + ay * m + py * width)} ${f(p1[0])} ${f(p1[1])}Q${f(cx + ax * m - px * width)} ${f(cy + ay * m - py * width)} ${f(p0[0])} ${f(p0[1])}Z`;
    }
    return `<path d="${d}"/>`;
  };
  out += ring(12, r * 0.2, r * 0.42, r * 0.07);
  out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.46)}"/>`;
  out += ring(18, r * 0.46, r * 0.7, r * 0.06);
  out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.74)}" stroke-dasharray="${f(r * 0.012)} ${f(r * 0.03)}"/>`;
  out += ring(24, r * 0.76, r * 1, r * 0.05);
  out += `</g>`;
  // dots between outer petals
  let dots = "";
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) / 24) * Math.PI * 2;
    dots += `<circle cx="${f(cx + Math.cos(a) * r * 0.9)}" cy="${f(cy + Math.sin(a) * r * 0.9)}" r="${f(r * 0.012)}"/>`;
  }
  return out + `<g fill="${color}"${opacity !== 1 ? ` opacity="${opacity}"` : ""}>${dots}</g>`;
}

/** Paisley (boteh): a plump teardrop whose tip curls over, with inner contour and dots. */
export function paisley(cx: number, cy: number, s: number, rotate: number, color: string, opacity = 1): string {
  const outer = "M6 -16C1 -18 -4 -14 -2 -10C0 -6 6 -9 4 -13M4 -13C14 -10 18 2 14 10C10 18 -2 20 -9 14C-16 8 -14 -4 -6 -9C-2 -11 2 -12 4 -13";
  const inner = "M8 -4C11 2 9 9 4 12C-1 15 -7 12 -8 7C-9 2 -5 -3 0 -5C3 -6 6 -6 8 -4Z";
  return (
    `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${rotate}) scale(${f(s / 18)})" fill="none" stroke="${color}" stroke-width="${f(22 / s)}" stroke-linecap="round" stroke-linejoin="round"${opacity !== 1 ? ` opacity="${opacity}"` : ""}>` +
    `<path d="${outer}"/><path d="${inner}"/>` +
    `<circle cx="0.5" cy="4" r="2" fill="${color}" stroke="none"/>` +
    [[-12, 4], [-11, 9], [-7, 15], [-1, 18.5], [6, 17.5], [12, 13], [16, 6], [16.5, -2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="${color}" stroke="none"/>`).join("") +
    `</g>`
  );
}

/** Royal crown with jewels. */
export function crown(cx: number, cy: number, w: number, c: { gold: string; jewel: string }): string {
  const h = w * 0.62;
  const x0 = cx - w / 2;
  const base = cy + h / 2;
  const top = cy - h / 2;
  const d =
    `M${f(x0)} ${f(base - h * 0.22)}L${f(x0 + w * 0.02)} ${f(top + h * 0.28)}L${f(x0 + w * 0.26)} ${f(top + h * 0.55)}` +
    `L${f(cx)} ${f(top + h * 0.08)}L${f(x0 + w * 0.74)} ${f(top + h * 0.55)}L${f(x0 + w * 0.98)} ${f(top + h * 0.28)}L${f(x0 + w)} ${f(base - h * 0.22)}Z`;
  return (
    `<path d="${d}" fill="${c.gold}"/>` +
    `<rect x="${f(x0)}" y="${f(base - h * 0.24)}" width="${f(w)}" height="${f(h * 0.24)}" rx="${f(h * 0.04)}" fill="${c.gold}"/>` +
    `<circle cx="${f(x0 + w * 0.02)}" cy="${f(top + h * 0.24)}" r="${f(w * 0.045)}" fill="${c.gold}"/>` +
    `<circle cx="${f(cx)}" cy="${f(top + h * 0.03)}" r="${f(w * 0.05)}" fill="${c.gold}"/>` +
    `<circle cx="${f(x0 + w * 0.98)}" cy="${f(top + h * 0.24)}" r="${f(w * 0.045)}" fill="${c.gold}"/>` +
    `<circle cx="${f(cx)}" cy="${f(base - h * 0.12)}" r="${f(w * 0.05)}" fill="${c.jewel}"/>` +
    `<circle cx="${f(x0 + w * 0.25)}" cy="${f(base - h * 0.12)}" r="${f(w * 0.035)}" fill="${c.jewel}"/>` +
    `<circle cx="${f(x0 + w * 0.75)}" cy="${f(base - h * 0.12)}" r="${f(w * 0.035)}" fill="${c.jewel}"/>` +
    `<path d="M${f(cx)} ${f(top + h * 0.3)}L${f(cx + w * 0.05)} ${f(top + h * 0.42)}L${f(cx)} ${f(top + h * 0.54)}L${f(cx - w * 0.05)} ${f(top + h * 0.42)}Z" fill="${c.jewel}"/>`
  );
}

/** Five-petal blossom. */
export function blossom(cx: number, cy: number, r: number, petal: string, centre: string, rotate = 0): string {
  let out = `<g transform="rotate(${rotate} ${f(cx)} ${f(cy)})">`;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 360;
    out += `<ellipse cx="${f(cx)}" cy="${f(cy - r * 0.55)}" rx="${f(r * 0.38)}" ry="${f(r * 0.55)}" fill="${petal}" transform="rotate(${a} ${f(cx)} ${f(cy)})"/>`;
  }
  return out + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.24)}" fill="${centre}"/></g>`;
}

/** Leafy branch: stem from (x0,y0) to (x1,y1) with paired leaves. */
export function branch(x0: number, y0: number, x1: number, y1: number, leaves: number, size: number, color: string, opacity = 1): string {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  let out = `<g transform="translate(${f(x0)} ${f(y0)}) rotate(${f(ang)})"${opacity !== 1 ? ` opacity="${opacity}"` : ""}>`;
  out += `<path d="M0 0Q${f(len / 2)} ${f(len * 0.04)} ${f(len)} 0" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  for (let i = 1; i <= leaves; i++) {
    const t = i / (leaves + 1);
    const x = len * t;
    const L = size * (1 - t * 0.3);
    for (const side of [-1, 1]) {
      out += `<ellipse cx="${f(x + L * 0.35)}" cy="${f(side * L * 0.42)}" rx="${f(L * 0.5)}" ry="${f(L * 0.22)}" fill="${color}" transform="rotate(${side * 35} ${f(x)} 0)" opacity="${f(0.75 + (i % 2) * 0.25)}"/>`;
    }
  }
  out += `<ellipse cx="${f(len + size * 0.3)}" cy="0" rx="${f(size * 0.45)}" ry="${f(size * 0.2)}" fill="${color}"/>`;
  return out + `</g>`;
}

/** Confetti scattered in a band, avoiding the content box. */
export function confetti(
  area: { x: number; y: number; w: number; h: number },
  count: number,
  colors: string[],
  seed = 11,
  avoid?: { x: number; y: number; w: number; h: number },
): string {
  const rnd = seeded(seed);
  let out = "";
  for (let i = 0, placed = 0; i < count * 5 && placed < count; i++) {
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    if (avoid && x > avoid.x && x < avoid.x + avoid.w && y > avoid.y && y < avoid.y + avoid.h) continue;
    const col = colors[Math.floor(rnd() * colors.length)];
    const rot = Math.floor(rnd() * 180);
    const k = rnd();
    const s = 6 + rnd() * 9;
    if (k < 0.4) out += `<rect x="${f(x - s / 2)}" y="${f(y - s / 4)}" width="${f(s)}" height="${f(s / 2)}" rx="1.5" fill="${col}" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
    else if (k < 0.65) out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s / 3)}" fill="${col}"/>`;
    else if (k < 0.85) out += `<path d="M${f(x - s / 2)} ${f(y)}q${f(s / 4)} ${f(-s / 2)} ${f(s / 2)} 0t${f(s / 2)} 0" stroke="${col}" stroke-width="2.4" fill="none" stroke-linecap="round" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
    else out += `<path d="M${f(x)} ${f(y - s / 2)}L${f(x + s / 2)} ${f(y + s / 3)}L${f(x - s / 2)} ${f(y + s / 3)}Z" fill="${col}" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
    placed++;
  }
  return out;
}
