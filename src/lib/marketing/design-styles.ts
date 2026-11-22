import { THEME_LIST } from "@/lib/themes/registry";
import type { ThemeDefinition, ThemeKey } from "@/lib/themes/types";

/** The look of each design, for the style filter and the quiz. */
export type DesignStyle = "classic" | "luxe" | "floral" | "playful" | "heritage";
export const DESIGN_STYLES: DesignStyle[] = ["classic", "luxe", "floral", "playful", "heritage"];

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
