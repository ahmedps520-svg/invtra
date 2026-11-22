/**
 * Designs printed on real artwork (painted botanicals): every design has its artwork, the server's
 * renderer really draws it into the card image, and the ink stays readable on the paper.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildCardSvg } from "@/lib/card/build";
import { SAMPLE_GUEST, themeSampleContent } from "@/lib/card/sample";
import { getDictionary } from "@/lib/i18n";
import { STATIONERY_THEME_KEYS, getTheme } from "@/lib/themes/registry";
import { renderSvgToPng } from "@/server/render/card";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("artwork designs", () => {
  it("each has its artwork on disk, named after the design", () => {
    for (const key of STATIONERY_THEME_KEYS) {
      const art = getTheme(key).card.art;
      expect(art, key).toBeTruthy();
      expect(art!.src).toMatch(new RegExp(`^/stationery/${key}\\.jpg\\?v=\\d+$`));
      expect(existsSync(path.join(process.cwd(), "public", "stationery", `${key}.jpg`)), key).toBe(true);
    }
  });

  it("has a name and a description in English and Arabic", () => {
    for (const locale of ["en", "ar"] as const) {
      const themes = getDictionary(locale).themes;
      for (const key of STATIONERY_THEME_KEYS) {
        expect(themes[key].name, `${locale}/${key}`).toBeTruthy();
        expect(themes[key].description.length, `${locale}/${key}`).toBeGreaterThan(20);
      }
    }
  });

  it("keeps the ink readable on the paper", () => {
    for (const key of STATIONERY_THEME_KEYS) {
      const p = getTheme(key).defaults.palette;
      expect(contrast(p.text, p.background), `${key} text`).toBeGreaterThanOrEqual(7);
      expect(contrast(p.accent, p.background), `${key} accent`).toBeGreaterThanOrEqual(4);
      expect(contrast(p.muted, p.background), `${key} muted`).toBeGreaterThanOrEqual(3);
    }
  });

  it("is drawn into the server-rendered card, not just referenced", async () => {
    const theme = getTheme("peony");
    const svg = buildCardSvg({ theme, design: theme.defaults, language: "EN", content: themeSampleContent("peony"), guest: SAMPLE_GUEST.en, qrPlaceholder: true });
    expect(svg).toContain('href="/stationery/peony.jpg?v=');
    const png = renderSvgToPng(svg, 270);
    // The top-left corner holds painted peonies: far from the plain paper colour.
    const { data, info } = await sharp(png).extract({ left: 0, top: 0, width: 60, height: 60 }).raw().toBuffer({ resolveWithObject: true });
    let painted = 0;
    for (let i = 0; i < data.length; i += info.channels) if (Math.abs(data[i] - data[i + 1]) > 30 || data[i + 1] < 170) painted++;
    expect(painted).toBeGreaterThan(400);
  });

  it("falls back to the plain paper colour when the host picks a solid background", () => {
    const theme = getTheme("taif");
    const design = { ...theme.defaults, background: { ...theme.defaults.background, mode: "solid" as const } };
    const svg = buildCardSvg({ theme, design, language: "AR", content: themeSampleContent("taif"), guest: SAMPLE_GUEST.ar, qrPlaceholder: true });
    expect(svg).not.toContain("/stationery/");
  });
});
