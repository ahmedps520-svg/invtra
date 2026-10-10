import type { InvitationDesign } from "@/lib/design/schema";
import { THEME_KEYS, type ThemeDefinition, type ThemeKey } from "./types";

export * from "./types";

const baseSections: InvitationDesign["sections"] = {
  countdown: true,
  schedule: true,
  gallery: true,
  details: true,
  map: true,
  rsvp: true,
  music: true,
  contact: true,
};

const baseCard: InvitationDesign["card"] = {
  showBranding: true,
  showGuestName: true,
  showVenueAddress: true,
  lines: { eyebrow: true, names: true, intro: true, date: true, time: true, venue: true },
  qr: { enabled: true, link: "", caption: "", position: "bottom-center", size: "md", style: "rounded", showLogo: true },
};

const emptyTexts: InvitationDesign["texts"] = { eyebrow: "", intro: "", closing: "", eyebrowAr: "", introAr: "", closingAr: "", extra: "", extraAr: "" };

function design(d: Omit<InvitationDesign, "sections" | "card" | "texts" | "monogram" | "names" | "customQr" | "background" | "digits"> &
  Partial<Pick<InvitationDesign, "card" | "background" | "digits">>): InvitationDesign {
  return {
    texts: emptyTexts,
    monogram: "",
    names: { font: null, fontAr: null, color: null },
    sections: baseSections,
    background: { mode: "theme", imageKey: null, overlay: 0.35 },
    customQr: { x: 0.5, y: 0.82, size: 0.22 },
    digits: "arab",
    ...d,
    card: d.card ?? baseCard,
  };
}

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  minimal: {
    key: "minimal",
    occasions: ["WEDDING", "ENGAGEMENT", "ANNIVERSARY", "BIRTHDAY", "GRADUATION", "CORPORATE", "NEWBORN", "OTHER"],
    recommendedLanguage: "EN",
    premium: false,
    defaults: design({
      palette: { background: "#FBF9F5", surface: "#FFFFFF", text: "#24201C", muted: "#8A8178", accent: "#A08060" },
      fonts: { display: "cormorant", body: "jost", arabicDisplay: "amiri", arabicBody: "plex-arabic" },
      animation: "subtle",
    }),
    card: { ornament: "hairline", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 1, panel: false },
    page: { hero: "centered", sectionStyle: "lines", namesUppercase: false, divider: "line" },
  },
  luxury: {
    key: "luxury",
    occasions: ["WEDDING", "ENGAGEMENT", "ANNIVERSARY", "CORPORATE"],
    recommendedLanguage: "EN",
    premium: true,
    defaults: design({
      palette: { background: "#0E0D0C", surface: "#181613", text: "#F3EDE2", muted: "#A39A8C", accent: "#C9A66B" },
      fonts: { display: "cinzel", body: "cormorant", arabicDisplay: "amiri", arabicBody: "amiri" },
      animation: "elegant",
    }),
    card: { ornament: "deco", stackNames: true, namesUppercase: true, eyebrowUppercase: true, nameScale: 0.82, panel: false },
    page: { hero: "framed", sectionStyle: "panels", namesUppercase: true, divider: "diamond" },
  },
  romantic: {
    key: "romantic",
    occasions: ["WEDDING", "ENGAGEMENT", "ANNIVERSARY", "BABY_SHOWER"],
    recommendedLanguage: "EN",
    premium: false,
    defaults: design({
      palette: { background: "#F7EDEA", surface: "#FFF9F7", text: "#4A3232", muted: "#9C7D78", accent: "#B67D74" },
      fonts: { display: "pinyon", body: "cormorant", arabicDisplay: "aref-ruqaa", arabicBody: "amiri" },
      animation: "elegant",
    }),
    card: { ornament: "floral", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 1.2, panel: false },
    page: { hero: "monogram", sectionStyle: "cards", namesUppercase: false, divider: "floral" },
  },
  modern: {
    key: "modern",
    occasions: ["CORPORATE", "GRADUATION", "BIRTHDAY", "WEDDING", "OTHER"],
    recommendedLanguage: "EN",
    premium: false,
    defaults: design({
      palette: { background: "#EFEDE8", surface: "#FFFFFF", text: "#151515", muted: "#6E6B66", accent: "#2F4A3E" },
      fonts: { display: "jost", body: "jost", arabicDisplay: "reem-kufi", arabicBody: "plex-arabic" },
      animation: "subtle",
      card: { ...baseCard, qr: { ...baseCard.qr, style: "dots" } },
    }),
    card: { ornament: "geometric", stackNames: true, namesUppercase: true, eyebrowUppercase: true, nameScale: 0.9, panel: true },
    page: { hero: "split", sectionStyle: "cards", namesUppercase: true, divider: "dots" },
  },
  traditional: {
    key: "traditional",
    occasions: ["WEDDING", "ENGAGEMENT", "HENNA", "AQIQAH"],
    recommendedLanguage: "EN",
    premium: true,
    defaults: design({
      palette: { background: "#F3EAD9", surface: "#FBF6EC", text: "#3A2A1A", muted: "#86705A", accent: "#7A2E2E" },
      fonts: { display: "playfair", body: "cormorant", arabicDisplay: "aref-ruqaa", arabicBody: "amiri" },
      animation: "elegant",
      card: { ...baseCard, qr: { ...baseCard.qr, style: "classic" } },
    }),
    card: { ornament: "baroque", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 0.95, panel: false },
    page: { hero: "framed", sectionStyle: "panels", namesUppercase: false, divider: "diamond" },
  },
  arabic: {
    key: "arabic",
    occasions: ["WEDDING", "ENGAGEMENT", "HENNA", "AQIQAH", "RAMADAN"],
    recommendedLanguage: "AR",
    premium: false,
    defaults: design({
      palette: { background: "#F6EFE3", surface: "#FFFBF4", text: "#2B2118", muted: "#8D7B66", accent: "#9A7440" },
      fonts: { display: "cormorant", body: "cormorant", arabicDisplay: "aref-ruqaa", arabicBody: "amiri" },
      animation: "elegant",
    }),
    card: { ornament: "arabesque", stackNames: true, namesUppercase: false, eyebrowUppercase: false, nameScale: 1.05, panel: false },
    page: { hero: "arch", sectionStyle: "panels", namesUppercase: false, divider: "star" },
  },
  bilingual: {
    key: "bilingual",
    occasions: ["WEDDING", "ENGAGEMENT", "NEWBORN", "AQIQAH", "CORPORATE", "OTHER"],
    recommendedLanguage: "BILINGUAL",
    premium: false,
    defaults: design({
      palette: { background: "#F8F5EF", surface: "#FFFFFF", text: "#1D2A3A", muted: "#7A8494", accent: "#A9844E" },
      fonts: { display: "cormorant", body: "cormorant", arabicDisplay: "amiri", arabicBody: "amiri" },
      animation: "elegant",
    }),
    card: { ornament: "arch", stackNames: false, namesUppercase: false, eyebrowUppercase: true, nameScale: 0.95, panel: false },
    page: { hero: "arch", sectionStyle: "lines", namesUppercase: false, divider: "star" },
  },
  royal: {
    key: "royal",
    recommendedLanguage: "EN",
    premium: true,
    occasions: ["WEDDING", "ENGAGEMENT", "ANNIVERSARY", "CORPORATE"],
    defaults: design({
      palette: { background: "#0F2E26", surface: "#143A30", text: "#F3EBDA", muted: "#B8C2B6", accent: "#C9A35B" },
      fonts: { display: "cinzel", body: "cormorant", arabicDisplay: "aref-ruqaa", arabicBody: "amiri" },
      animation: "elegant",
      card: { ...baseCard, qr: { ...baseCard.qr, style: "classic" } },
    }),
    card: { ornament: "royal", stackNames: true, namesUppercase: true, eyebrowUppercase: true, nameScale: 0.82, panel: false },
    page: { hero: "framed", sectionStyle: "panels", namesUppercase: true, divider: "diamond", motif: "royal" },
  },
  garden: {
    key: "garden",
    recommendedLanguage: "EN",
    premium: false,
    occasions: ["ENGAGEMENT", "BABY_SHOWER", "BIRTHDAY", "WEDDING", "ANNIVERSARY", "OTHER"],
    defaults: design({
      palette: { background: "#F1F4EC", surface: "#FBFCF8", text: "#2F3B2F", muted: "#7D8A79", accent: "#7E9A72" },
      fonts: { display: "cormorant", body: "jost", arabicDisplay: "amiri", arabicBody: "plex-arabic" },
      animation: "subtle",
    }),
    card: { ornament: "garden", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 1, panel: false },
    page: { hero: "centered", sectionStyle: "cards", namesUppercase: false, divider: "floral", motif: "garden" },
  },
  henna: {
    key: "henna",
    recommendedLanguage: "AR",
    premium: true,
    occasions: ["HENNA", "WEDDING", "ENGAGEMENT"],
    defaults: design({
      palette: { background: "#F6EADB", surface: "#FCF4EA", text: "#4A2A1E", muted: "#9B7B66", accent: "#B5562C" },
      fonts: { display: "playfair", body: "cormorant", arabicDisplay: "aref-ruqaa", arabicBody: "amiri" },
      animation: "elegant",
    }),
    card: { ornament: "henna", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 0.95, panel: false },
    page: { hero: "arch", sectionStyle: "panels", namesUppercase: false, divider: "diamond", motif: "henna" },
  },
  moonlight: {
    key: "moonlight",
    recommendedLanguage: "EN",
    premium: true,
    occasions: ["NEWBORN", "AQIQAH", "BABY_SHOWER"],
    defaults: design({
      palette: { background: "#1B2440", surface: "#243057", text: "#F4EFE6", muted: "#AEB4C8", accent: "#E2C58B" },
      fonts: { display: "cormorant", body: "quicksand", arabicDisplay: "el-messiri", arabicBody: "baloo" },
      animation: "elegant",
      card: { ...baseCard, qr: { ...baseCard.qr, style: "dots" } },
    }),
    card: { ornament: "moonlight", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 1.05, panel: false },
    page: { hero: "centered", sectionStyle: "cards", namesUppercase: false, divider: "moon", motif: "moonlight" },
  },
  teddy: {
    key: "teddy",
    recommendedLanguage: "EN",
    premium: false,
    occasions: ["NEWBORN", "BABY_SHOWER", "BIRTHDAY", "AQIQAH"],
    defaults: design({
      palette: { background: "#F8F1E7", surface: "#FFFAF3", text: "#5A4535", muted: "#9C8571", accent: "#C49A6C" },
      fonts: { display: "quicksand", body: "quicksand", arabicDisplay: "baloo", arabicBody: "baloo" },
      animation: "subtle",
      card: { ...baseCard, qr: { ...baseCard.qr, style: "dots" } },
    }),
    card: { ornament: "teddy", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 0.95, panel: false },
    page: { hero: "centered", sectionStyle: "cards", namesUppercase: false, divider: "heart", motif: "teddy" },
  },
  clouds: {
    key: "clouds",
    recommendedLanguage: "EN",
    premium: false,
    occasions: ["NEWBORN", "BABY_SHOWER", "AQIQAH", "BIRTHDAY"],
    defaults: design({
      palette: { background: "#EAF2FA", surface: "#FFFFFF", text: "#2E4157", muted: "#7E91A6", accent: "#7FA6CC" },
      fonts: { display: "quicksand", body: "quicksand", arabicDisplay: "baloo", arabicBody: "baloo" },
      animation: "subtle",
      card: { ...baseCard, qr: { ...baseCard.qr, style: "dots" } },
    }),
    card: { ornament: "clouds", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 0.95, panel: false },
    page: { hero: "centered", sectionStyle: "cards", namesUppercase: false, divider: "star", motif: "clouds" },
  },
  lullaby: {
    key: "lullaby",
    recommendedLanguage: "EN",
    premium: true,
    occasions: ["NEWBORN", "BABY_SHOWER", "AQIQAH"],
    defaults: design({
      palette: { background: "#F6F1F5", surface: "#FFFCFE", text: "#4B4253", muted: "#988FA0", accent: "#B59BC9" },
      fonts: { display: "cormorant", body: "quicksand", arabicDisplay: "el-messiri", arabicBody: "baloo" },
      animation: "elegant",
    }),
    card: { ornament: "lullaby", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 1.05, panel: false },
    page: { hero: "centered", sectionStyle: "lines", namesUppercase: false, divider: "moon", motif: "lullaby" },
  },
  confetti: {
    key: "confetti",
    recommendedLanguage: "EN",
    premium: false,
    occasions: ["BIRTHDAY", "GRADUATION", "CORPORATE", "OTHER"],
    defaults: design({
      palette: { background: "#FBF7F2", surface: "#FFFFFF", text: "#1F1D2B", muted: "#6D6A7C", accent: "#E07A5F" },
      fonts: { display: "jost", body: "jost", arabicDisplay: "reem-kufi", arabicBody: "plex-arabic" },
      animation: "subtle",
      card: { ...baseCard, qr: { ...baseCard.qr, style: "rounded" } },
    }),
    card: { ornament: "confetti", stackNames: true, namesUppercase: true, eyebrowUppercase: true, nameScale: 0.9, panel: false },
    page: { hero: "centered", sectionStyle: "cards", namesUppercase: true, divider: "dots", motif: "confetti" },
  },
  lantern: {
    key: "lantern",
    recommendedLanguage: "AR",
    premium: true,
    occasions: ["RAMADAN", "AQIQAH", "CORPORATE"],
    defaults: design({
      palette: { background: "#14213D", surface: "#1C2B4D", text: "#F5EDE0", muted: "#AFB5C6", accent: "#D9A441" },
      fonts: { display: "cormorant", body: "cormorant", arabicDisplay: "aref-ruqaa", arabicBody: "amiri" },
      animation: "elegant",
    }),
    card: { ornament: "lantern", stackNames: true, namesUppercase: false, eyebrowUppercase: true, nameScale: 1, panel: false },
    page: { hero: "arch", sectionStyle: "panels", namesUppercase: false, divider: "star", motif: "lantern" },
  },
};

export const DEFAULT_THEME: ThemeKey = "minimal";

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === "string" && (THEME_KEYS as readonly string[]).includes(v);
}

export function getTheme(key: string | null | undefined): ThemeDefinition {
  return isThemeKey(key) ? THEMES[key] : THEMES[DEFAULT_THEME];
}

export const THEME_LIST: ThemeDefinition[] = THEME_KEYS.map((k) => THEMES[k]);
