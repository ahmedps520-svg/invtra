import sharp from "sharp";
import type { EventType } from "@prisma/client";
import { buildCardSvg } from "@/lib/card/build";
import { SAMPLE_GUEST, sampleCardContent, themeSampleContent } from "@/lib/card/sample";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { SAMPLE_WIDTH, type SampleLang } from "@/lib/marketing/samples";
import { renderSvgToPng } from "@/server/render/card";

const cache = new Map<string, Buffer>();

/** A design rendered with sample wording and a sample QR, as WebP (see src/lib/marketing/samples.ts). */
export async function sampleCardWebp(themeKey: ThemeKey, lang: SampleLang, occasion: EventType | null): Promise<Buffer> {
  const id = `${themeKey}:${lang}:${occasion ?? ""}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const theme = getTheme(themeKey);
  const language = lang === "ar" ? "AR" : lang === "bi" ? "BILINGUAL" : "EN";
  const svg = buildCardSvg({
    theme,
    design: theme.defaults,
    language,
    content: occasion ? sampleCardContent(occasion) : themeSampleContent(themeKey),
    guest: lang === "ar" ? SAMPLE_GUEST.ar : SAMPLE_GUEST.en,
    qrText: null,
    qrPlaceholder: true,
  });
  const png = renderSvgToPng(svg, SAMPLE_WIDTH);
  const webp = await sharp(png).webp({ quality: 82, effort: 5 }).toBuffer();
  cache.set(id, webp);
  return webp;
}
