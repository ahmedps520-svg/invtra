/** Font families available to invitation designs. Keys are stable; names match @font-face + TTF family names. */
export const FONTS = {
  cormorant: { family: "Cormorant Garamond", script: "latin", kind: "serif" },
  jost: { family: "Jost", script: "latin", kind: "sans" },
  cinzel: { family: "Cinzel", script: "latin", kind: "serif" },
  pinyon: { family: "Pinyon Script", script: "latin", kind: "script" },
  playfair: { family: "Playfair Display", script: "latin", kind: "serif" },
  italiana: { family: "Italiana", script: "latin", kind: "serif" },
  amiri: { family: "Amiri", script: "arabic", kind: "serif" },
  "aref-ruqaa": { family: "Aref Ruqaa", script: "arabic", kind: "script" },
  "reem-kufi": { family: "Reem Kufi", script: "arabic", kind: "sans" },
  "plex-arabic": { family: "IBM Plex Sans Arabic", script: "arabic", kind: "sans" },
  "el-messiri": { family: "El Messiri", script: "arabic", kind: "sans" },
  quicksand: { family: "Quicksand", script: "latin", kind: "sans" },
  baloo: { family: "Baloo Bhaijaan 2", script: "arabic", kind: "sans" },
  // Offered for the names (the couple, the baby, the graduate…).
  "great-vibes": { family: "Great Vibes", script: "latin", kind: "script" },
  "dancing-script": { family: "Dancing Script", script: "latin", kind: "script" },
  pacifico: { family: "Pacifico", script: "latin", kind: "script" },
  fredoka: { family: "Fredoka", script: "latin", kind: "sans" },
  marcellus: { family: "Marcellus", script: "latin", kind: "serif" },
  lalezar: { family: "Lalezar", script: "arabic", kind: "sans" },
  rakkas: { family: "Rakkas", script: "arabic", kind: "serif" },
  marhey: { family: "Marhey", script: "arabic", kind: "sans" },
  lemonada: { family: "Lemonada", script: "arabic", kind: "sans" },
  katibeh: { family: "Katibeh", script: "arabic", kind: "script" },
  // More for the names: Arabic calligraphy and display faces, and Latin scripts.
  gulzar: { family: "Gulzar", script: "arabic", kind: "script" },
  alkalami: { family: "Alkalami", script: "arabic", kind: "script" },
  ruwudu: { family: "Ruwudu", script: "arabic", kind: "script" },
  vibes: { family: "Vibes", script: "arabic", kind: "script" },
  mirza: { family: "Mirza", script: "arabic", kind: "serif" },
  scheherazade: { family: "Scheherazade New", script: "arabic", kind: "serif" },
  markazi: { family: "Markazi Text", script: "arabic", kind: "serif" },
  kufam: { family: "Kufam", script: "arabic", kind: "sans" },
  "reem-kufi-fun": { family: "Reem Kufi Fun", script: "arabic", kind: "sans" },
  jomhuria: { family: "Jomhuria", script: "arabic", kind: "sans" },
  blaka: { family: "Blaka", script: "arabic", kind: "sans" },
  parisienne: { family: "Parisienne", script: "latin", kind: "script" },
  "alex-brush": { family: "Alex Brush", script: "latin", kind: "script" },
  allura: { family: "Allura", script: "latin", kind: "script" },
  italianno: { family: "Italianno", script: "latin", kind: "script" },
  "monsieur-la-doulaise": { family: "Monsieur La Doulaise", script: "latin", kind: "script" },
  windsong: { family: "WindSong", script: "latin", kind: "script" },
  "imperial-script": { family: "Imperial Script", script: "latin", kind: "script" },
  "rouge-script": { family: "Rouge Script", script: "latin", kind: "script" },
} as const;

export type FontKey = keyof typeof FONTS;

export const LATIN_DISPLAY_FONTS: FontKey[] = ["cormorant", "cinzel", "pinyon", "playfair", "italiana", "jost", "quicksand"];
export const LATIN_BODY_FONTS: FontKey[] = ["cormorant", "jost", "playfair", "quicksand"];
export const ARABIC_DISPLAY_FONTS: FontKey[] = ["amiri", "aref-ruqaa", "reem-kufi", "el-messiri", "baloo"];
export const ARABIC_BODY_FONTS: FontKey[] = ["amiri", "plex-arabic", "el-messiri", "reem-kufi", "baloo"];
/** Typefaces for the names: the display faces plus playful and calligraphic ones. */
export const LATIN_NAME_FONTS: FontKey[] = [
  ...LATIN_DISPLAY_FONTS,
  "great-vibes",
  "parisienne",
  "alex-brush",
  "allura",
  "italianno",
  "monsieur-la-doulaise",
  "windsong",
  "imperial-script",
  "rouge-script",
  "dancing-script",
  "pacifico",
  "fredoka",
  "marcellus",
];
export const ARABIC_NAME_FONTS: FontKey[] = [
  ...ARABIC_DISPLAY_FONTS,
  "gulzar",
  "alkalami",
  "ruwudu",
  "mirza",
  "scheherazade",
  "markazi",
  "vibes",
  "kufam",
  "reem-kufi-fun",
  "jomhuria",
  "blaka",
  "lalezar",
  "rakkas",
  "marhey",
  "lemonada",
  "katibeh",
];
/** Typefaces for the decorative "و" / "&" between the couple's names (the first is the default). */
export const ARABIC_JOIN_FONTS: FontKey[] = ["alkalami", "ruwudu", "aref-ruqaa", "gulzar", "rakkas", "amiri", "katibeh", "vibes"];
export const LATIN_JOIN_FONTS: FontKey[] = ["great-vibes", "parisienne", "monsieur-la-doulaise", "imperial-script", "alex-brush", "pinyon", "italianno", "windsong"];

/**
 * The ink of each join font's "و" / "&", per unit of font size, as the renderer draws it: how far it
 * drops below the baseline, how wide it is, and how far its middle sits from the anchor (negative
 * is to the left). Used to space the couple's names around it, centre it and keep its tail off the ornament.
 */
export const JOIN_GLYPHS: Partial<Record<FontKey, { drop: number; width: number; offset: number }>> = {
  alkalami: { drop: 0.43, width: 0.57, offset: -0.11 },
  ruwudu: { drop: 0.42, width: 0.57, offset: -0.13 },
  "aref-ruqaa": { drop: 0, width: 0.48, offset: -0.01 },
  gulzar: { drop: 0, width: 0.25, offset: -0.01 },
  rakkas: { drop: 0.01, width: 0.4, offset: -0.03 },
  amiri: { drop: 0.21, width: 0.41, offset: -0.08 },
  katibeh: { drop: 0.24, width: 0.25, offset: -0.04 },
  vibes: { drop: 0.11, width: 0.48, offset: 0 },
  "great-vibes": { drop: 0.04, width: 0.72, offset: 0.07 },
  parisienne: { drop: 0.09, width: 0.76, offset: -0.02 },
  "monsieur-la-doulaise": { drop: 0.19, width: 0.77, offset: 0.15 },
  "imperial-script": { drop: 0.04, width: 0.83, offset: 0.13 },
  "alex-brush": { drop: 0.12, width: 0.72, offset: 0 },
  pinyon: { drop: 0, width: 0.44, offset: 0.04 },
  italianno: { drop: 0.1, width: 0.68, offset: 0.15 },
  windsong: { drop: 0.03, width: 0.76, offset: 0.18 },
};

/** The weight a display face is set in (light Jost, bolder Quicksand / Fredoka). */
export function displayWeight(key: FontKey): number {
  return key === "jost" ? 300 : key === "quicksand" || key === "fredoka" ? 600 : FONTS[key].kind === "script" ? 400 : 500;
}

/** Weights that exist for each family (see scripts/fetch-fonts.py). */
export const FONT_WEIGHTS: Record<string, number[]> = {
  "Cormorant Garamond": [300, 400, 500, 600],
  Jost: [300, 400, 500, 600],
  Cinzel: [400, 500, 600],
  "Pinyon Script": [400],
  "Playfair Display": [400, 500],
  Italiana: [400],
  Amiri: [400, 700],
  "Aref Ruqaa": [400, 700],
  "Reem Kufi": [400, 500, 600],
  "IBM Plex Sans Arabic": [300, 400, 500, 600],
  "El Messiri": [400, 500, 600],
  Quicksand: [400, 500, 600, 700],
  "Baloo Bhaijaan 2": [400, 500, 600, 700],
  "Great Vibes": [400],
  "Dancing Script": [400, 600],
  Pacifico: [400],
  Fredoka: [400, 600],
  Marcellus: [400],
  Lalezar: [400],
  Rakkas: [400],
  Marhey: [400, 600],
  Lemonada: [400, 600],
  Katibeh: [400],
  Gulzar: [400],
  Alkalami: [400],
  Ruwudu: [400],
  Vibes: [400],
  Mirza: [400],
  "Scheherazade New": [400],
  "Markazi Text": [400],
  Kufam: [400],
  "Reem Kufi Fun": [400],
  Jomhuria: [400],
  Blaka: [400],
  Parisienne: [400],
  "Alex Brush": [400],
  Allura: [400],
  Italianno: [400],
  "Monsieur La Doulaise": [400],
  WindSong: [400],
  "Imperial Script": [400],
  "Rouge Script": [400],
};

export function nearestWeight(family: string, weight: number): number {
  const ws = FONT_WEIGHTS[family] ?? [400];
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

/** CSS font-family stack for a key, with sensible script fallbacks. */
export function fontStack(key: FontKey): string {
  const f = FONTS[key];
  const fallback =
    f.script === "arabic" ? '"Amiri", serif' : f.kind === "sans" ? '"Jost", sans-serif' : '"Cormorant Garamond", serif';
  return `"${f.family}", ${fallback}`;
}
