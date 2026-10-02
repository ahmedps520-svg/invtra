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
  | "blushBronze"
  | "emeraldCrown"
  | "sapphireGold"
  | "burgundyCrown"
  | "ivoryRoyal"
  | "sageGarden"
  | "eucalyptusMist"
  | "blushGarden"
  | "oliveGrove"
  | "hennaTerracotta"
  | "saffronHenna"
  | "rosewoodHenna"
  | "emeraldHenna"
  | "nightSky"
  | "duskPlum"
  | "midnightTeal"
  | "ivoryMoon"
  | "honeyBear"
  | "babyBlueBear"
  | "blushBear"
  | "mintBear"
  | "skyBlue"
  | "blushSky"
  | "mintSky"
  | "butterSky"
  | "lavenderLullaby"
  | "babyBlueLullaby"
  | "blushLullaby"
  | "sageLullaby"
  | "coralParty"
  | "navyParty"
  | "mintParty"
  | "berryParty"
  | "midnightLantern"
  | "plumLantern"
  | "emeraldLantern"
  | "ivoryLantern";

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
  royal: [
    { name: "emeraldCrown", palette: { background: "#0F2E26", surface: "#143A30", text: "#F3EBDA", muted: "#B8C2B6", accent: "#C9A35B" } },
    { name: "sapphireGold", palette: { background: "#0F1E3D", surface: "#16284D", text: "#F2ECDF", muted: "#AEB6C8", accent: "#C9A35B" } },
    { name: "burgundyCrown", palette: { background: "#3A1019", surface: "#4A1722", text: "#F5E9DC", muted: "#C9AFA8", accent: "#D2AE6A" } },
    { name: "ivoryRoyal", palette: { background: "#F7F2E7", surface: "#FFFCF5", text: "#1F2A24", muted: "#7E857B", accent: "#9A7A3C" } },
  ],
  garden: [
    { name: "sageGarden", palette: { background: "#F1F4EC", surface: "#FBFCF8", text: "#2F3B2F", muted: "#7D8A79", accent: "#7E9A72" } },
    { name: "eucalyptusMist", palette: { background: "#EEF3F1", surface: "#FAFCFB", text: "#23332F", muted: "#76877F", accent: "#5F8A7A" } },
    { name: "blushGarden", palette: { background: "#F8EFEC", surface: "#FFFAF8", text: "#3D2C2B", muted: "#94817D", accent: "#B47F74" } },
    { name: "oliveGrove", palette: { background: "#F3F1E6", surface: "#FCFBF5", text: "#2E3020", muted: "#7F8068", accent: "#7A7B45" } },
  ],
  henna: [
    { name: "hennaTerracotta", palette: { background: "#F6EADB", surface: "#FCF4EA", text: "#4A2A1E", muted: "#9B7B66", accent: "#B5562C" } },
    { name: "saffronHenna", palette: { background: "#F8EEDA", surface: "#FFF8EA", text: "#43301A", muted: "#97805F", accent: "#C9862B" } },
    { name: "rosewoodHenna", palette: { background: "#F5E6E3", surface: "#FCF3F1", text: "#47232A", muted: "#9A7A7E", accent: "#9E3F4E" } },
    { name: "emeraldHenna", palette: { background: "#EEF2EA", surface: "#FAFCF6", text: "#1F3328", muted: "#768878", accent: "#2F6B4F" } },
  ],
  moonlight: [
    { name: "nightSky", palette: { background: "#1B2440", surface: "#243057", text: "#F4EFE6", muted: "#AEB4C8", accent: "#E2C58B" } },
    { name: "duskPlum", palette: { background: "#2A1E36", surface: "#352747", text: "#F5EEF2", muted: "#B8A9BF", accent: "#E3BFA0" } },
    { name: "midnightTeal", palette: { background: "#132B33", surface: "#1A3842", text: "#EEF4F2", muted: "#A5BCBB", accent: "#D8C28A" } },
    { name: "ivoryMoon", palette: { background: "#F5F2EA", surface: "#FFFDF8", text: "#25304D", muted: "#7C8398", accent: "#B99757" } },
  ],
  teddy: [
    { name: "honeyBear", palette: { background: "#F8F1E7", surface: "#FFFAF3", text: "#5A4535", muted: "#9C8571", accent: "#C49A6C" } },
    { name: "babyBlueBear", palette: { background: "#EEF4F9", surface: "#FBFDFF", text: "#2F435A", muted: "#7D8FA3", accent: "#8FAFCB" } },
    { name: "blushBear", palette: { background: "#FAEFEF", surface: "#FFF8F8", text: "#5A3A3E", muted: "#A0858A", accent: "#D99A9F" } },
    { name: "mintBear", palette: { background: "#EEF6F1", surface: "#FAFDFB", text: "#2E4A3E", muted: "#7C978A", accent: "#86B59F" } },
  ],
  clouds: [
    { name: "skyBlue", palette: { background: "#EAF2FA", surface: "#FFFFFF", text: "#2E4157", muted: "#7E91A6", accent: "#7FA6CC" } },
    { name: "blushSky", palette: { background: "#FBEFF2", surface: "#FFFFFF", text: "#553946", muted: "#A08791", accent: "#E3A3B5" } },
    { name: "mintSky", palette: { background: "#EAF6F1", surface: "#FFFFFF", text: "#284A3F", muted: "#789A8E", accent: "#7CC2A8" } },
    { name: "butterSky", palette: { background: "#FBF5E3", surface: "#FFFFFF", text: "#4C4129", muted: "#9C9070", accent: "#E3C36B" } },
  ],
  lullaby: [
    { name: "lavenderLullaby", palette: { background: "#F6F1F5", surface: "#FFFCFE", text: "#4B4253", muted: "#988FA0", accent: "#B59BC9" } },
    { name: "babyBlueLullaby", palette: { background: "#F0F5FA", surface: "#FCFEFF", text: "#33445A", muted: "#8292A5", accent: "#93B4D6" } },
    { name: "blushLullaby", palette: { background: "#FBF1F1", surface: "#FFFBFB", text: "#523C44", muted: "#A08A90", accent: "#DDA2AE" } },
    { name: "sageLullaby", palette: { background: "#F1F5EF", surface: "#FCFDFB", text: "#34433A", muted: "#83917F", accent: "#9BB89A" } },
  ],
  confetti: [
    { name: "coralParty", palette: { background: "#FBF7F2", surface: "#FFFFFF", text: "#1F1D2B", muted: "#6D6A7C", accent: "#E07A5F" } },
    { name: "navyParty", palette: { background: "#1F2240", surface: "#2A2E52", text: "#F7F3EC", muted: "#B0B3C8", accent: "#F2CC8F" } },
    { name: "mintParty", palette: { background: "#F0F7F3", surface: "#FFFFFF", text: "#1E2B26", muted: "#6A7C73", accent: "#3FA37C" } },
    { name: "berryParty", palette: { background: "#FBF2F5", surface: "#FFFFFF", text: "#2B1B24", muted: "#7C6873", accent: "#C2457A" } },
  ],
  lantern: [
    { name: "midnightLantern", palette: { background: "#14213D", surface: "#1C2B4D", text: "#F5EDE0", muted: "#AFB5C6", accent: "#D9A441" } },
    { name: "plumLantern", palette: { background: "#2B1730", surface: "#38203F", text: "#F6ECE6", muted: "#BCA7B8", accent: "#E0AE52" } },
    { name: "emeraldLantern", palette: { background: "#0F2A25", surface: "#163731", text: "#F2ECDD", muted: "#A9BBB2", accent: "#D6A548" } },
    { name: "ivoryLantern", palette: { background: "#F7F1E4", surface: "#FFFBF2", text: "#23304A", muted: "#7D8396", accent: "#B07A1F" } },
  ],
};

export function samePalette(a: Palette, b: Palette): boolean {
  return (Object.keys(a) as (keyof Palette)[]).every((k) => a[k].toLowerCase() === b[k].toLowerCase());
}

/** The preset matching a palette exactly (any theme), if there is one. */
export function findPreset(themeKey: ThemeKey, palette: Palette): PalettePreset | null {
  return PALETTE_PRESETS[themeKey].find((p) => samePalette(p.palette, palette)) ?? null;
}
