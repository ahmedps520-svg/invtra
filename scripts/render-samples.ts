/**
 * Renders every theme × language to PNG for visual QA.
 * Run: npx tsx scripts/render-samples.ts [outDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { THEME_LIST } from "@/lib/themes/registry";
import { buildCardSvg, type CardLanguage } from "@/lib/card/build";
import { renderSvgToPng } from "@/server/render/card";
import { themeSampleContent } from "@/lib/card/sample";

const out = process.argv[2] ?? "storage/samples";
mkdirSync(out, { recursive: true });


const only = process.env.THEME;
const langs: CardLanguage[] = (process.env.LANGS?.split(",") as CardLanguage[]) ?? ["EN", "AR", "BILINGUAL"];
const t0 = Date.now();
for (const theme of THEME_LIST) {
  if (only && theme.key !== only) continue;
  for (const language of langs) {
    const svg = buildCardSvg({
      theme,
      design: theme.defaults,
      language,
      content: themeSampleContent(theme.key),
      guest: { name: language === "AR" ? "عائلة الأحمد" : "Khalid & Noura Al Mansoori", allowedCount: 2 },
      qrText: "HTTP://LOCALHOST:3000/Q/8F3K92QXHT",
    });
    const png = renderSvgToPng(svg, 540);
    writeFileSync(path.join(out, `${theme.key}-${language}.png`), png);
  }
}
console.log("rendered in", Date.now() - t0, "ms");
