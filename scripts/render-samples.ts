/**
 * Renders every theme × language to PNG for visual QA.
 * Run: npx tsx scripts/render-samples.ts [outDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { THEME_LIST } from "@/lib/themes/registry";
import { buildCardSvg, type CardLanguage } from "@/lib/card/build";
import { renderSvgToPng } from "@/server/render/card";

const out = process.argv[2] ?? "storage/samples";
mkdirSync(out, { recursive: true });

const content = {
  eventType: "WEDDING" as const,
  title: "The Wedding of Ahmed & Sara",
  titleAr: "حفل زفاف أحمد وسارة",
  hostNames: "Ahmed & Sara",
  hostNamesAr: "أحمد و سارة",
  date: { en: "Saturday, 12 December 2026", ar: "السبت، ١٢ ديسمبر ٢٠٢٦" },
  time: { en: "7:30 PM", ar: "٧:٣٠ مساءً" },
  venueName: "The Grand Ballroom, Four Seasons Resort",
  venueNameAr: "القاعة الكبرى، فندق فور سيزونز",
  address: "Jumeirah Beach Road, Dubai",
  addressAr: "شارع جميرا، دبي",
};

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
      content,
      guest: { name: language === "AR" ? "عائلة الأحمد" : "Khalid & Noura Al Mansoori", allowedCount: 2 },
      qrText: "HTTP://LOCALHOST:3000/Q/8F3K92QXHT",
    });
    const png = renderSvgToPng(svg, 540);
    writeFileSync(path.join(out, `${theme.key}-${language}.png`), png);
  }
}
console.log("rendered in", Date.now() - t0, "ms");
