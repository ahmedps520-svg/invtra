import type { EventType } from "@prisma/client";
import type { FontKey } from "@/lib/design/fonts";
import type { InvitationDesign } from "@/lib/design/schema";
import { baseCard, design } from "./base";
import type { ArtworkKey, StationeryKey, ThemeArt, ThemeDefinition } from "./types";

/**
 * Designs printed on real artwork: public-domain botanical paintings and flower photographs, laid
 * out on paper (public/stationery/<key>.jpg, credits in public/stationery/CREDITS.md). The card
 * engine sets the text in the artwork's open space; the guest page opens on the same artwork.
 */

/** Bump when artwork files change, so browsers and caches fetch the new images. */
const ART_VERSION = 1;

export interface ArtworkSpec {
  premium: boolean;
  language?: ThemeDefinition["recommendedLanguage"];
  occasions: EventType[];
  palette: InvitationDesign["palette"];
  /** Display, body, Arabic display, Arabic body. */
  fonts: [FontKey, FontKey, FontKey, FontKey];
  /** Typefaces for the names, when they differ from the display faces. */
  names?: { font: FontKey | null; fontAr: FontKey | null };
  nameScale?: number;
  uppercase?: boolean;
  art: Omit<ThemeArt, "src" | "thumb">;
  sections?: ThemeDefinition["page"]["sectionStyle"];
  divider?: ThemeDefinition["page"]["divider"];
}

export function stationery(key: ArtworkKey, s: ArtworkSpec, version = ART_VERSION): ThemeDefinition {
  const [display, body, arabicDisplay, arabicBody] = s.fonts;
  return {
    key,
    recommendedLanguage: s.language ?? "EN",
    premium: s.premium,
    occasions: s.occasions,
    defaults: design({
      palette: s.palette,
      fonts: { display, body, arabicDisplay, arabicBody },
      names: { font: s.names?.font ?? null, fontAr: s.names?.fontAr ?? null, color: null, size: null },
      animation: "elegant",
      card: baseCard,
    }),
    card: {
      ornament: "art",
      stackNames: true,
      namesUppercase: s.uppercase ?? false,
      eyebrowUppercase: true,
      nameScale: s.nameScale ?? 1,
      panel: false,
      art: { src: `/stationery/${key}.jpg?v=${version}`, thumb: `/stationery/thumb/${key}.jpg?v=${version}`, ...s.art },
    },
    page: { hero: "art", sectionStyle: s.sections ?? "cards", namesUppercase: s.uppercase ?? false, divider: s.divider ?? "floral" },
  };
}

export const STATIONERY: Record<StationeryKey, ThemeDefinition> = {
  peony: stationery("peony", {
    premium: false,
    occasions: ["WEDDING", "ENGAGEMENT", "ANNIVERSARY", "BABY_SHOWER"],
    palette: { background: "#FAF4EC", surface: "#FFFBF6", text: "#4A2F31", muted: "#9A7B76", accent: "#A8625C" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 300 }, bottomPad: 90, sidePad: 150, divider: "floral" },
  }),
  redoute: stationery("redoute", {
    premium: true,
    occasions: ["WEDDING", "ENGAGEMENT", "ANNIVERSARY"],
    palette: { background: "#FBF7F0", surface: "#FFFCF7", text: "#3F2A2C", muted: "#8F7773", accent: "#A35F60" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  whiterose: stationery("whiterose", {
    premium: true,
    occasions: ["WEDDING", "ENGAGEMENT", "ANNIVERSARY", "AQIQAH"],
    palette: { background: "#FBF9F4", surface: "#FFFFFB", text: "#2E3329", muted: "#7A8073", accent: "#8A7A48" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "pinyon", fontAr: "aref-ruqaa" },
    art: { content: { x: 190, w: 700, top: 350 }, bottomPad: 100, sidePad: 150, divider: "floral" },
  }),
  crimson: stationery("crimson", {
    premium: false,
    occasions: ["WEDDING", "ANNIVERSARY", "ENGAGEMENT"],
    palette: { background: "#FAF3EE", surface: "#FFFAF6", text: "#3B1C21", muted: "#8E6A6A", accent: "#8C2F3A" },
    fonts: ["playfair", "cormorant", "amiri", "amiri"],
    names: { font: null, fontAr: "aref-ruqaa" },
    nameScale: 0.92,
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  camellia: stationery("camellia", {
    premium: false,
    occasions: ["WEDDING", "ENGAGEMENT", "BIRTHDAY", "BABY_SHOWER"],
    palette: { background: "#FAF6F0", surface: "#FFFCF8", text: "#43292B", muted: "#977B76", accent: "#B0505F" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    art: { content: { x: 290, w: 620, top: 290 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  cherry: stationery("cherry", {
    premium: false,
    occasions: ["ENGAGEMENT", "BABY_SHOWER", "BIRTHDAY", "WEDDING"],
    palette: { background: "#FBF4F1", surface: "#FFFAF8", text: "#4A3034", muted: "#9B7F80", accent: "#B0606F" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "pinyon", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 365 }, bottomPad: 90, sidePad: 150, divider: "floral" },
  }),
  magnolia: stationery("magnolia", {
    premium: true,
    occasions: ["WEDDING", "ANNIVERSARY", "CORPORATE", "GRADUATION"],
    palette: { background: "#F7F6F0", surface: "#FDFDF8", text: "#2F3A2E", muted: "#7A8673", accent: "#68775C" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 340 }, bottomPad: 95, sidePad: 150, divider: "hairline" },
    divider: "line",
  }),
  taif: stationery("taif", {
    premium: true,
    language: "AR",
    occasions: ["WEDDING", "HENNA", "ENGAGEMENT", "ANNIVERSARY"],
    palette: { background: "#FBF5F2", surface: "#FFFBF9", text: "#4A2B33", muted: "#9A7A80", accent: "#A5566B" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 335 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  jasmine: stationery("jasmine", {
    premium: false,
    language: "BILINGUAL",
    occasions: ["WEDDING", "HENNA", "RAMADAN", "ENGAGEMENT", "AQIQAH"],
    palette: { background: "#F8F8F2", surface: "#FEFEFA", text: "#2F3A2F", muted: "#7A8576", accent: "#5F7A55" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  olive: stationery("olive", {
    premium: false,
    occasions: ["WEDDING", "ANNIVERSARY", "CORPORATE", "RAMADAN", "OTHER"],
    palette: { background: "#F6F3EA", surface: "#FCFAF4", text: "#2F3326", muted: "#777B63", accent: "#646C4A" },
    fonts: ["cinzel", "cormorant", "amiri", "amiri"],
    nameScale: 0.8,
    uppercase: true,
    art: { content: { x: 170, w: 740, top: 360 }, bottomPad: 95, sidePad: 150, divider: "diamond" },
    divider: "diamond",
  }),
  laurel: stationery("laurel", {
    premium: false,
    occasions: ["GRADUATION", "CORPORATE", "BIRTHDAY", "OTHER"],
    palette: { background: "#FAF8F2", surface: "#FFFEF9", text: "#26301F", muted: "#767C68", accent: "#8C7237" },
    fonts: ["cinzel", "cormorant", "reem-kufi", "amiri"],
    nameScale: 0.8,
    uppercase: true,
    art: { content: { x: 170, w: 740, top: 320 }, bottomPad: 95, sidePad: 150, divider: "diamond" },
    divider: "diamond",
  }),
  wildflower: stationery("wildflower", {
    premium: false,
    occasions: ["BIRTHDAY", "WEDDING", "BABY_SHOWER", "ENGAGEMENT", "OTHER"],
    palette: { background: "#FBF7EC", surface: "#FFFCF4", text: "#3A3326", muted: "#8A7E66", accent: "#B0553A" },
    fonts: ["cormorant", "jost", "el-messiri", "plex-arabic"],
    names: { font: "pinyon", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 310 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  tulip: stationery("tulip", {
    premium: false,
    occasions: ["ENGAGEMENT", "BIRTHDAY", "GRADUATION", "BABY_SHOWER"],
    palette: { background: "#FBF7EF", surface: "#FFFCF6", text: "#3D2A22", muted: "#917968", accent: "#A84B36" },
    fonts: ["playfair", "jost", "el-messiri", "plex-arabic"],
    names: { font: null, fontAr: "aref-ruqaa" },
    nameScale: 0.92,
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  hydrangea: stationery("hydrangea", {
    premium: false,
    occasions: ["WEDDING", "BABY_SHOWER", "NEWBORN", "ANNIVERSARY"],
    palette: { background: "#F3F5F6", surface: "#FCFDFD", text: "#2B3747", muted: "#738196", accent: "#56708E" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  sweetpea: stationery("sweetpea", {
    premium: false,
    occasions: ["NEWBORN", "BABY_SHOWER", "AQIQAH", "BIRTHDAY"],
    palette: { background: "#FBF2F1", surface: "#FFFAF9", text: "#4A3036", muted: "#9A7D82", accent: "#A85F6D" },
    fonts: ["cormorant", "quicksand", "el-messiri", "baloo"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 355 }, bottomPad: 95, sidePad: 150, divider: "heart" },
    divider: "heart",
  }),
  forgetmenot: stationery("forgetmenot", {
    premium: false,
    occasions: ["NEWBORN", "BABY_SHOWER", "AQIQAH"],
    palette: { background: "#F4F7F9", surface: "#FCFDFE", text: "#2C3B4C", muted: "#768A9E", accent: "#4F7299" },
    fonts: ["cormorant", "quicksand", "el-messiri", "baloo"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 320 }, bottomPad: 95, sidePad: 150, divider: "star" },
    divider: "star",
  }),
  lilyvalley: stationery("lilyvalley", {
    premium: true,
    occasions: ["AQIQAH", "NEWBORN", "WEDDING", "BABY_SHOWER"],
    palette: { background: "#F3F4EE", surface: "#FBFBF7", text: "#2D3A30", muted: "#78867A", accent: "#5E7A61" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "pinyon", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  orchid: stationery("orchid", {
    premium: true,
    occasions: ["WEDDING", "ENGAGEMENT", "CORPORATE", "ANNIVERSARY"],
    palette: { background: "#FBF8F3", surface: "#FFFDF9", text: "#3D2838", muted: "#8C7785", accent: "#9A4C74" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    art: { content: { x: 190, w: 700, top: 350 }, bottomPad: 100, sidePad: 150, divider: "floral" },
  }),
  lily: stationery("lily", {
    premium: false,
    occasions: ["WEDDING", "AQIQAH", "ANNIVERSARY", "CORPORATE"],
    palette: { background: "#F9F8F4", surface: "#FFFFFC", text: "#33302A", muted: "#827D70", accent: "#7A6A4C" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "pinyon", fontAr: "aref-ruqaa" },
    art: { content: { x: 170, w: 740, top: 370 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  iris: stationery("iris", {
    premium: false,
    occasions: ["GRADUATION", "CORPORATE", "BIRTHDAY", "WEDDING"],
    palette: { background: "#F6F5F7", surface: "#FDFDFE", text: "#2E2B45", muted: "#7C7993", accent: "#5E5A86" },
    fonts: ["cormorant", "jost", "el-messiri", "plex-arabic"],
    art: { content: { x: 170, w: 740, top: 335 }, bottomPad: 95, sidePad: 150, divider: "diamond" },
    divider: "diamond",
  }),
  wisteria: stationery("wisteria", {
    premium: true,
    occasions: ["WEDDING", "ENGAGEMENT", "BABY_SHOWER"],
    palette: { background: "#F7F5F8", surface: "#FDFCFE", text: "#34304A", muted: "#827D98", accent: "#6E6396" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    art: { content: { x: 170, w: 740, top: 415 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  poppy: stationery("poppy", {
    premium: false,
    occasions: ["BIRTHDAY", "GRADUATION", "CORPORATE", "OTHER"],
    palette: { background: "#FBF6EF", surface: "#FFFCF7", text: "#3A2420", muted: "#8C746C", accent: "#A9402B" },
    fonts: ["playfair", "jost", "reem-kufi", "plex-arabic"],
    nameScale: 0.92,
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "dots" },
    divider: "dots",
  }),
  lavender: stationery("lavender", {
    premium: false,
    occasions: ["ANNIVERSARY", "BIRTHDAY", "BABY_SHOWER", "ENGAGEMENT"],
    palette: { background: "#F6F4F7", surface: "#FDFCFE", text: "#3A3348", muted: "#857E93", accent: "#6F6290" },
    fonts: ["cormorant", "cormorant", "amiri", "amiri"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    nameScale: 1.05,
    art: { content: { x: 170, w: 740, top: 330 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  pomegranate: stationery("pomegranate", {
    premium: true,
    language: "BILINGUAL",
    occasions: ["RAMADAN", "AQIQAH", "HENNA", "CORPORATE", "WEDDING"],
    palette: { background: "#FAF5EC", surface: "#FFFCF5", text: "#3E231F", muted: "#8D7468", accent: "#9E3D33" },
    fonts: ["cormorant", "cormorant", "aref-ruqaa", "amiri"],
    names: { font: null, fontAr: "aref-ruqaa" },
    art: { content: { x: 170, w: 740, top: 370 }, bottomPad: 95, sidePad: 150, divider: "star" },
    divider: "star",
  }),
  anemone: stationery("anemone", {
    premium: false,
    occasions: ["ENGAGEMENT", "BIRTHDAY", "ANNIVERSARY", "WEDDING"],
    palette: { background: "#F8F6F4", surface: "#FEFDFC", text: "#33263A", muted: "#837587", accent: "#7A5873" },
    fonts: ["cormorant", "jost", "el-messiri", "plex-arabic"],
    names: { font: "great-vibes", fontAr: "aref-ruqaa" },
    art: { content: { x: 170, w: 740, top: 370 }, bottomPad: 95, sidePad: 150, divider: "floral" },
  }),
  daisy: stationery("daisy", {
    premium: false,
    occasions: ["BIRTHDAY", "BABY_SHOWER", "NEWBORN", "GRADUATION", "OTHER"],
    palette: { background: "#FBF8EE", surface: "#FFFDF6", text: "#3A3424", muted: "#888166", accent: "#8D7432" },
    fonts: ["cormorant", "quicksand", "el-messiri", "baloo"],
    names: { font: "dancing-script", fontAr: "marhey" },
    art: { content: { x: 170, w: 740, top: 370 }, bottomPad: 95, sidePad: 150, divider: "dots" },
    divider: "dots",
  }),
  fern: stationery("fern", {
    premium: false,
    occasions: ["CORPORATE", "GRADUATION", "ANNIVERSARY", "WEDDING", "OTHER"],
    palette: { background: "#F4F5EF", surface: "#FCFCF8", text: "#23301F", muted: "#72806C", accent: "#557352" },
    fonts: ["jost", "jost", "reem-kufi", "plex-arabic"],
    names: { font: "cormorant", fontAr: null },
    art: { content: { x: 170, w: 740, top: 340 }, bottomPad: 95, sidePad: 150, divider: "hairline" },
    divider: "line",
  }),
};
