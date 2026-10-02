/** Renders share images for visual QA: npx tsx scripts/og-preview.ts <outDir> [key…] */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ogImagePng } from "@/server/seo/og-image";

const [out = "storage/og", ...keys] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const key of keys.length ? keys : ["home", "invitations", "newborn", "ramadan-eid"]) {
  for (const locale of ["en", "ar"] as const) {
    const png = ogImagePng(key, locale);
    if (png) writeFileSync(path.join(out, `${key}-${locale}.png`), png);
  }
}
