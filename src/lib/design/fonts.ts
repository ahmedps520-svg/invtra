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
} as const;

export type FontKey = keyof typeof FONTS;

export const LATIN_DISPLAY_FONTS: FontKey[] = ["cormorant", "cinzel", "pinyon", "playfair", "italiana", "jost", "quicksand"];
export const LATIN_BODY_FONTS: FontKey[] = ["cormorant", "jost", "playfair", "quicksand"];
export const ARABIC_DISPLAY_FONTS: FontKey[] = ["amiri", "aref-ruqaa", "reem-kufi", "el-messiri", "baloo"];
export const ARABIC_BODY_FONTS: FontKey[] = ["amiri", "plex-arabic", "el-messiri", "reem-kufi", "baloo"];
/** Typefaces for the names: the display faces plus playful and calligraphic ones. */
export const LATIN_NAME_FONTS: FontKey[] = [...LATIN_DISPLAY_FONTS, "great-vibes", "dancing-script", "pacifico", "fredoka", "marcellus"];
export const ARABIC_NAME_FONTS: FontKey[] = [...ARABIC_DISPLAY_FONTS, "lalezar", "rakkas", "marhey", "lemonada", "katibeh"];

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
