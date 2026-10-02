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
  qr: { position: "bottom-center", size: "md", style: "rounded", showLogo: true },
};

const emptyTexts: InvitationDesign["texts"] = { eyebrow: "", intro: "", closing: "", eyebrowAr: "", introAr: "", closingAr: "" };

function design(d: Omit<InvitationDesign, "sections" | "card" | "texts" | "monogram" | "customQr" | "background" | "digits"> &
  Partial<Pick<InvitationDesign, "card" | "background" | "digits">>): InvitationDesign {
  return {
    texts: emptyTexts,
    monogram: "",
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
};

export const DEFAULT_THEME: ThemeKey = "minimal";

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === "string" && (THEME_KEYS as readonly string[]).includes(v);
}

export function getTheme(key: string | null | undefined): ThemeDefinition {
  return isThemeKey(key) ? THEMES[key] : THEMES[DEFAULT_THEME];
}

export const THEME_LIST: ThemeDefinition[] = THEME_KEYS.map((k) => THEMES[k]);
