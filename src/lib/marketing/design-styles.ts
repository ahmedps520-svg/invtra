import type { ThemeKey } from "@/lib/themes/types";

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
};
