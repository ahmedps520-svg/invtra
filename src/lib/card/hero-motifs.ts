import type { InvitationDesign } from "@/lib/design/schema";
import type { HeroMotif } from "@/lib/themes/types";
import { balloon, blossom, branch, cloud, confetti, crescent, cribMobile, crown, heart, lantern, mandala, mix, sparkle, star5, starField, teddy } from "./motifs";

type Palette = InvitationDesign["palette"];

/** Illustration shown above the names in the guest website hero, plus its display width (px). */
export function heroMotif(motif: HeroMotif, p: Palette): { svg: string; width: number } {
  const a = p.accent;
  const svg = (w: number, h: number, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="display:block;width:100%;height:auto" aria-hidden="true" focusable="false">${body}</svg>`;
  switch (motif) {
    case "moonlight":
      return {
        width: 300,
        svg: svg(
          360,
          200,
          crescent(186, 98, 62, a, -28) +
            sparkle(66, 58, 15, a) +
            sparkle(300, 40, 10, a) +
            sparkle(320, 150, 8, a, 0.85) +
            sparkle(40, 160, 7, a, 0.8) +
            starField({ x: 0, y: 0, w: 360, h: 200 }, 14, p.text, 3, { x: 110, y: 20, w: 150, h: 160 }),
        ),
      };
    case "teddy": {
      const pink = mix(a, "#E59A8A", 0.62);
      const s = 56;
      return {
        width: 340,
        svg: svg(
          520,
          310,
          balloon(70, 70, 44, pink, p.muted, 214, 85 + 1.45 * s) +
            balloon(450, 50, 40, mix(a, "#9CB7D6", 0.72), p.muted, 306, 85 + 1.45 * s) +
            balloon(130, 175, 28, mix(p.muted, "#9DB8A6", 0.72), p.muted, 210, 85 + 1.5 * s) +
            teddy(260, 85, s, { fur: a, light: mix(a, "#ffffff", 0.64), dark: p.text, bow: pink }) +
            heart(470, 200, 12, pink, 0.8) +
            star5(40, 250, 9, mix(a, "#E8C77A", 0.6)),
        ),
      };
    }
    case "clouds": {
      const gold = mix(a, "#E8C77A", 0.7);
      return {
        width: 340,
        svg: svg(
          520,
          220,
          cloud(150, 190, 250, p.surface, 1, a) +
            cloud(390, 140, 200, p.surface, 1, a) +
            crescent(300, 52, 28, gold, -25) +
            star5(70, 50, 11, gold) +
            sparkle(470, 40, 10, gold) +
            sparkle(220, 30, 7, gold, 0.8),
        ),
      };
    }
    case "lullaby":
      return {
        width: 320,
        svg: svg(520, 270, cribMobile(260, 0, 500, { line: mix(a, p.text, 0.35), a: mix(a, "#E2C27A", 0.55), b: a, cloud: p.surface })),
      };
    case "royal":
      return { width: 110, svg: svg(160, 104, crown(80, 54, 140, { gold: a, jewel: mix(a, "#7A1F2B", 0.78) })) };
    case "garden": {
      const petal = mix(a, "#ffffff", 0.72);
      return {
        width: 260,
        svg: svg(360, 70, branch(166, 40, 10, 22, 5, 26, a) + branch(194, 40, 350, 22, 5, 26, a) + blossom(180, 40, 18, petal, a)),
      };
    }
    case "henna":
      return { width: 190, svg: svg(300, 300, mandala(150, 150, 146, a)) };
    case "confetti": {
      const colors = [a, mix(a, "#F2CC8F", 0.75), mix(p.muted, "#81B29A", 0.75), p.text, mix(a, "#ffffff", 0.45)];
      return { width: 360, svg: svg(520, 140, confetti({ x: 0, y: 0, w: 520, h: 140 }, 46, colors, 21, { x: 170, y: 40, w: 180, h: 60 }) + star5(260, 70, 18, a)) };
    }
    case "lantern": {
      const c = { metal: a, glow: mix(a, "#FFE3A3", 0.6), glass: mix(p.background, a, 0.16) };
      return {
        width: 340,
        svg: svg(
          520,
          300,
          lantern(80, 0, 40, 150, c) +
            lantern(180, 0, 0, 100, c) +
            lantern(340, 0, 10, 100, c) +
            lantern(440, 0, 70, 150, c) +
            crescent(262, 120, 40, a, -30) +
            sparkle(214, 96, 8, a) +
            sparkle(312, 168, 6, a, 0.85),
        ),
      };
    }
  }
}

/** Subtle repeating background for the whole guest page (CSS url), or null. */
export function heroPattern(motif: HeroMotif, p: Palette): string | null {
  const tile = (w: number, h: number, body: string) =>
    `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}")`;
  switch (motif) {
    case "moonlight":
    case "lantern":
      return tile(320, 320, starField({ x: 0, y: 0, w: 320, h: 320 }, 18, p.text, 31));
    case "lullaby":
      return tile(320, 320, starField({ x: 0, y: 0, w: 320, h: 320 }, 8, p.accent, 17));
    case "teddy":
      return tile(54, 54, `<circle cx="13" cy="13" r="2.4" fill="${p.accent}" opacity="0.16"/><circle cx="40" cy="40" r="2.4" fill="${p.accent}" opacity="0.16"/>`);
    case "confetti": {
      const colors = [p.accent, mix(p.accent, "#F2CC8F", 0.75), mix(p.muted, "#81B29A", 0.75)];
      return tile(360, 360, `<g opacity="0.45">${confetti({ x: 0, y: 0, w: 360, h: 360 }, 14, colors, 41)}</g>`);
    }
    default:
      return null;
  }
}
