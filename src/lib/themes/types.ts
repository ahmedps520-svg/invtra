import type { InvitationDesign } from "@/lib/design/schema";

export const THEME_KEYS = ["minimal", "luxury", "romantic", "modern", "traditional", "arabic", "bilingual"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export type CardOrnament = "hairline" | "deco" | "floral" | "geometric" | "baroque" | "arabesque" | "arch";
export type HeroStyle = "centered" | "framed" | "arch" | "split" | "monogram";
export type SectionStyle = "lines" | "cards" | "panels";

export interface ThemeDefinition {
  key: ThemeKey;
  /** Language the theme is designed around; any theme can render any language. */
  recommendedLanguage: "EN" | "AR" | "BILINGUAL";
  premium: boolean;
  defaults: InvitationDesign;
  card: {
    ornament: CardOrnament;
    /** Render host names as "Ahmed / & / Sara" on separate lines. */
    stackNames: boolean;
    namesUppercase: boolean;
    eyebrowUppercase: boolean;
    /** Relative size of the host names (1 = default). */
    nameScale: number;
    /** Draw content on an inner panel (surface colour) rather than directly on the background. */
    panel: boolean;
  };
  page: {
    hero: HeroStyle;
    sectionStyle: SectionStyle;
    namesUppercase: boolean;
    /** Decorative motif used between page sections. */
    divider: "line" | "diamond" | "floral" | "star" | "dots";
  };
}
