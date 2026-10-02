import type { InvitationDesign } from "@/lib/design/schema";
import type { ThemeKey } from "@/lib/themes/registry";

export type Palette = InvitationDesign["palette"];

/** Keys of the preset names in the `editor.palettes` dictionary. */
export type PaletteName =
  | "ivoryBronze"
  | "sageLinen"
  | "doveGrey"
  | "blushPaper"
  | "inkCream"
  | "onyxGold"
  | "midnightSilver"
  | "emeraldGold"
  | "bordeauxChampagne"
  | "ivoryGold"
  | "blushRose"
  | "lavenderMist"
  | "peachSage"
  | "dustyBlue"
  | "mauveEvening"
  | "stoneForest"
  | "galleryTerracotta"
  | "charcoalSand"
  | "navyBrass"
  | "oliveCream"
  | "parchmentBurgundy"
  | "royalNavy"
  | "forestBrass"
  | "oxbloodGold"
  | "antiqueSepia"
  | "sandBronze"
  | "nightGold"
  | "turquoiseTile"
  | "roseCopper"
  | "porcelainNavy"
  | "sageStone"
  | "blushBronze";

export interface PalettePreset {
  name: PaletteName;
  palette: Palette;
}

/**
 * Hand-picked colourways per theme. The first entry of each list is the theme's own
 * palette (kept in sync with src/lib/themes/registry.ts). Every preset keeps body text
 * at ≥ 4.5:1 against its background.
 */
export const PALETTE_PRESETS: Record<ThemeKey, PalettePreset[]> = {
  minimal: [
    { name: "ivoryBronze", palette: { background: "#FBF9F5", surface: "#FFFFFF", text: "#24201C", muted: "#8A8178", accent: "#A08060" } },
    { name: "sageLinen", palette: { background: "#F3F4EE", surface: "#FBFCF8", text: "#27302A", muted: "#7A847B", accent: "#6F8466" } },
    { name: "doveGrey", palette: { background: "#F2F1EF", surface: "#FAFAF9", text: "#222326", muted: "#7F8085", accent: "#6F7A88" } },
    { name: "blushPaper", palette: { background: "#F9F1EE", surface: "#FFFAF8", text: "#3B2A2A", muted: "#958280", accent: "#B0847A" } },
    { name: "inkCream", palette: { background: "#F6F0E4", surface: "#FFFBF3", text: "#1F2633", muted: "#7B8190", accent: "#2F3B57" } },
  ],
  luxury: [
    { name: "onyxGold", palette: { background: "#0E0D0C", surface: "#181613", text: "#F3EDE2", muted: "#A39A8C", accent: "#C9A66B" } },
    { name: "midnightSilver", palette: { background: "#0D1220", surface: "#151B2C", text: "#EEF1F6", muted: "#9AA3B5", accent: "#C3C9D3" } },
    { name: "emeraldGold", palette: { background: "#0C1F19", surface: "#122A22", text: "#F2EDE0", muted: "#A3AE9F", accent: "#C9A66B" } },
    { name: "bordeauxChampagne", palette: { background: "#2A0E14", surface: "#36141B", text: "#F6EBDF", muted: "#C2A9A0", accent: "#D8B98A" } },
    { name: "ivoryGold", palette: { background: "#F7F2E8", surface: "#FFFCF5", text: "#1E1A14", muted: "#8D8273", accent: "#A8843F" } },
  ],
  romantic: [
    { name: "blushRose", palette: { background: "#F7EDEA", surface: "#FFF9F7", text: "#4A3232", muted: "#9C7D78", accent: "#B67D74" } },
    { name: "lavenderMist", palette: { background: "#F1EDF4", surface: "#FBF9FC", text: "#3B3047", muted: "#8F849C", accent: "#8E76A8" } },
    { name: "peachSage", palette: { background: "#F8EDE4", surface: "#FFFAF5", text: "#45362C", muted: "#9C8676", accent: "#7F9373" } },
    { name: "dustyBlue", palette: { background: "#EDF1F4", surface: "#F9FBFC", text: "#2C3A47", muted: "#7F8D99", accent: "#7C93AC" } },
    { name: "mauveEvening", palette: { background: "#3A2630", surface: "#45303A", text: "#F6E8EA", muted: "#C6A9B0", accent: "#E2B7B0" } },
  ],
  modern: [
    { name: "stoneForest", palette: { background: "#EFEDE8", surface: "#FFFFFF", text: "#151515", muted: "#6E6B66", accent: "#2F4A3E" } },
    { name: "galleryTerracotta", palette: { background: "#FAFAF8", surface: "#FFFFFF", text: "#161616", muted: "#6F6F6F", accent: "#B35A36" } },
    { name: "charcoalSand", palette: { background: "#1C1C1C", surface: "#262626", text: "#F2EFEA", muted: "#A8A39B", accent: "#D2B48C" } },
    { name: "navyBrass", palette: { background: "#E9ECEF", surface: "#FFFFFF", text: "#14213D", muted: "#66718A", accent: "#A4823F" } },
    { name: "oliveCream", palette: { background: "#ECEBE0", surface: "#FAF9F2", text: "#22261D", muted: "#74776A", accent: "#5D6B3A" } },
  ],
  traditional: [
    { name: "parchmentBurgundy", palette: { background: "#F3EAD9", surface: "#FBF6EC", text: "#3A2A1A", muted: "#86705A", accent: "#7A2E2E" } },
    { name: "royalNavy", palette: { background: "#F2ECDD", surface: "#FBF7EE", text: "#1B2440", muted: "#6F7287", accent: "#A88A3E" } },
    { name: "forestBrass", palette: { background: "#EFEBDD", surface: "#F9F7EF", text: "#1F3127", muted: "#6C7564", accent: "#9C7A3C" } },
    { name: "oxbloodGold", palette: { background: "#3B1418", surface: "#481C21", text: "#F4E7D2", muted: "#C9AE96", accent: "#D4AF6A" } },
    { name: "antiqueSepia", palette: { background: "#F5EFE3", surface: "#FDF9F1", text: "#3D2E22", muted: "#8C7A66", accent: "#8B6A45" } },
  ],
  arabic: [
    { name: "sandBronze", palette: { background: "#F6EFE3", surface: "#FFFBF4", text: "#2B2118", muted: "#8D7B66", accent: "#9A7440" } },
    { name: "nightGold", palette: { background: "#121722", surface: "#1B2130", text: "#F1E9D8", muted: "#A8A190", accent: "#CDA765" } },
    { name: "turquoiseTile", palette: { background: "#EEF3F1", surface: "#FAFCFB", text: "#173431", muted: "#6E8580", accent: "#2A7A72" } },
    { name: "roseCopper", palette: { background: "#F6ECE8", surface: "#FFF9F6", text: "#3A2522", muted: "#977C76", accent: "#B0694F" } },
    { name: "emeraldGold", palette: { background: "#0F2A22", surface: "#15352B", text: "#F3ECDC", muted: "#A9B3A2", accent: "#CFAE6B" } },
  ],
  bilingual: [
    { name: "porcelainNavy", palette: { background: "#F8F5EF", surface: "#FFFFFF", text: "#1D2A3A", muted: "#7A8494", accent: "#A9844E" } },
    { name: "ivoryGold", palette: { background: "#FAF6EE", surface: "#FFFDF8", text: "#2A2219", muted: "#8B7F70", accent: "#B08D4F" } },
    { name: "nightGold", palette: { background: "#101828", surface: "#182235", text: "#F2EDE3", muted: "#A2A9B8", accent: "#C9A66B" } },
    { name: "sageStone", palette: { background: "#F0F2EC", surface: "#FAFBF8", text: "#263027", muted: "#7B857C", accent: "#7D8F6E" } },
    { name: "blushBronze", palette: { background: "#F8EFEC", surface: "#FFFAF8", text: "#3A2A28", muted: "#9A8480", accent: "#A97A62" } },
  ],
};

export function samePalette(a: Palette, b: Palette): boolean {
  return (Object.keys(a) as (keyof Palette)[]).every((k) => a[k].toLowerCase() === b[k].toLowerCase());
}

/** The preset matching a palette exactly (any theme), if there is one. */
export function findPreset(themeKey: ThemeKey, palette: Palette): PalettePreset | null {
  return PALETTE_PRESETS[themeKey].find((p) => samePalette(p.palette, palette)) ?? null;
}
