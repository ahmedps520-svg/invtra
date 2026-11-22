import { THEME_LIST } from "@/lib/themes/registry";
import { COLLECTION_STYLE } from "@/lib/themes/collection";
import type { ThemeDefinition, ThemeKey } from "@/lib/themes/types";
import { EVENT_TYPES, occasionGroup } from "@/lib/events/types";
import { DESIGN_STYLES as DESIGN_STYLES_ALL, type DesignStyle } from "./design-style-list";

export { DESIGN_STYLES, type DesignStyle } from "./design-style-list";

/** The look of each design, for the style filter and the quiz. */
export const THEME_STYLE: Record<ThemeKey, DesignStyle> = {
  minimal: "classic",
  modern: "classic",
  bilingual: "classic",
  luxury: "luxe",
  royal: "luxe",
  romantic: "floral",
  garden: "floral",
  teddy: "playful",
  clouds: "playful",
  lullaby: "playful",
  confetti: "playful",
  moonlight: "playful",
  traditional: "heritage",
  arabic: "heritage",
  henna: "heritage",
  lantern: "heritage",
  ...COLLECTION_STYLE,
  peony: "floral",
  redoute: "luxe",
  whiterose: "luxe",
  crimson: "floral",
  camellia: "floral",
  cherry: "floral",
  magnolia: "luxe",
  taif: "heritage",
  jasmine: "heritage",
  olive: "classic",
  laurel: "classic",
  wildflower: "playful",
  tulip: "floral",
  hydrangea: "floral",
  sweetpea: "playful",
  forgetmenot: "playful",
  lilyvalley: "floral",
  orchid: "luxe",
  lily: "classic",
  iris: "classic",
  wisteria: "luxe",
  poppy: "playful",
  lavender: "floral",
  pomegranate: "heritage",
  anemone: "floral",
  daisy: "playful",
  fern: "classic",
};

/** Designs shown first wherever the catalogue is listed (the homepage shows the first eight). */
const SHOWCASE: ThemeKey[] = ["peony", "taif", "redoute", "royal", "jasmine", "wildflower", "magnolia", "teddy", "orchid", "whiterose", "olive", "lantern"];

/** The catalogue in showcase order: the featured designs, then the painted ones, then the rest. */
export const SHOWCASE_LIST: ThemeDefinition[] = [
  ...SHOWCASE.map((k) => THEME_LIST.find((t) => t.key === k)!),
  ...THEME_LIST.filter((t) => !SHOWCASE.includes(t.key) && t.card.art),
  ...THEME_LIST.filter((t) => !SHOWCASE.includes(t.key) && !t.card.art),
];

/**
 * A representative slice of the catalogue for the homepage's preview grid: the featured designs,
 * then the first few made mainly for each occasion group. The full catalogue is one link away.
 */
export function homepageDesigns(perGroup = 12): ThemeDefinition[] {
  const featured = SHOWCASE_LIST.slice(0, SHOWCASE.length);
  const picked = new Set(featured.map((t) => t.key));
  const count: Record<string, number> = {};
  for (const t of SHOWCASE_LIST) {
    const g = occasionGroup(t.occasions[0]);
    if (picked.has(t.key) || (count[g] ?? 0) >= perGroup) continue;
    count[g] = (count[g] ?? 0) + 1;
    picked.add(t.key);
  }
  return SHOWCASE_LIST.filter((t) => picked.has(t.key));
}

/**
 * The designs the quiz can recommend: for every occasion, look and language, the best few (as the
 * quiz ranks them), so its answers are the same as over the whole catalogue but the page stays light.
 */
export function quizDesigns(per = 3): ThemeDefinition[] {
  const picked = new Set<ThemeKey>();
  const langs = ["EN", "AR", "BILINGUAL"] as const;
  for (const occasion of EVENT_TYPES) {
    const made = SHOWCASE_LIST.filter((t) => t.occasions.indexOf(occasion) >= 0).sort((a, b) => Math.min(a.occasions.indexOf(occasion), 3) - Math.min(b.occasions.indexOf(occasion), 3));
    for (const style of DESIGN_STYLES_ALL) for (const lang of langs) for (const t of made.filter((t) => THEME_STYLE[t.key] === style && t.recommendedLanguage === lang).slice(0, per)) picked.add(t.key);
    for (const style of DESIGN_STYLES_ALL) for (const t of made.filter((t) => THEME_STYLE[t.key] === style).slice(0, per)) picked.add(t.key);
    for (const t of made.slice(0, per)) picked.add(t.key);
  }
  return SHOWCASE_LIST.filter((t) => picked.has(t.key));
}
