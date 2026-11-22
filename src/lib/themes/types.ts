import type { EventType } from "@prisma/client";
import type { InvitationDesign } from "@/lib/design/schema";
import { COLLECTION_KEYS } from "./collection-keys";

const CODED_THEME_KEYS = [
  "minimal",
  "luxury",
  "romantic",
  "modern",
  "traditional",
  "arabic",
  "bilingual",
  "royal",
  "garden",
  "henna",
  "moonlight",
  "teddy",
  "clouds",
  "lullaby",
  "confetti",
  "lantern",
] as const;
/** Designs printed on real artwork: painted botanicals and flower photographs (see stationery.ts). */
export const STATIONERY_THEME_KEYS = [
  "peony",
  "redoute",
  "whiterose",
  "crimson",
  "camellia",
  "cherry",
  "magnolia",
  "taif",
  "jasmine",
  "olive",
  "laurel",
  "wildflower",
  "tulip",
  "hydrangea",
  "sweetpea",
  "forgetmenot",
  "lilyvalley",
  "orchid",
  "lily",
  "iris",
  "wisteria",
  "poppy",
  "lavender",
  "pomegranate",
  "anemone",
  "daisy",
  "fern",
] as const;
export { COLLECTION_KEYS };
export const THEME_KEYS = [...CODED_THEME_KEYS, ...STATIONERY_THEME_KEYS, ...COLLECTION_KEYS] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export type StationeryKey = (typeof STATIONERY_THEME_KEYS)[number];
export type CollectionKey = (typeof COLLECTION_KEYS)[number];
/** Every design printed on artwork (the hand-arranged ones and the generated collection). */
export type ArtworkKey = StationeryKey | CollectionKey;

export type CardOrnament =
  | "hairline"
  | "deco"
  | "floral"
  | "geometric"
  | "baroque"
  | "arabesque"
  | "arch"
  | "royal"
  | "garden"
  | "henna"
  | "moonlight"
  | "teddy"
  | "clouds"
  | "lullaby"
  | "confetti"
  | "lantern"
  | "art";
export type HeroStyle = "centered" | "framed" | "arch" | "split" | "monogram" | "art";
export type SectionStyle = "lines" | "cards" | "panels";
export type HeroMotif = "royal" | "garden" | "henna" | "moonlight" | "teddy" | "clouds" | "lullaby" | "confetti" | "lantern";

/** Painted or photographed artwork (real flowers on paper) that a design is built on. */
export interface ThemeArt {
  /** Full-bleed 1080 × 1350 artwork under the text: a public path, versioned for caching. */
  src: string;
  /** The same artwork at thumbnail size, for small previews drawn in the browser (design pickers). */
  thumb: string;
  /** Box the text may use, in card pixels. Its bottom follows the QR footer. */
  content: { x: number; w: number; top: number };
  /** Inset the footer (QR, guest line, branding) keeps from the bottom and the sides. */
  bottomPad: number;
  sidePad: number;
  /** Small motif between the greeting and the date. */
  divider: "floral" | "diamond" | "hairline" | "dots" | "star" | "heart";
}

export interface ThemeDefinition {
  key: ThemeKey;
  /** Language the theme is designed around; any theme can render any language. */
  recommendedLanguage: "EN" | "AR" | "BILINGUAL";
  premium: boolean;
  /** Occasions this design is made for (used for filtering and suggestions). */
  occasions: EventType[];
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
    /** Artwork the card is printed on (ornament "art"). */
    art?: ThemeArt;
  };
  page: {
    hero: HeroStyle;
    sectionStyle: SectionStyle;
    namesUppercase: boolean;
    /** Decorative motif used between page sections. */
    divider: "line" | "diamond" | "floral" | "star" | "dots" | "moon" | "heart";
    /** Illustration shown at the top of the guest website's hero. */
    motif?: HeroMotif;
  };
}
