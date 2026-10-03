/**
 * Copies the flag SVGs used by the phone-number country picker into public/flags/.
 * Source: country-flag-icons (MIT) — https://gitlab.com/catamphetamine/country-flag-icons
 * Run after upgrading either package: node scripts/copy-flags.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { getCountries } from "libphonenumber-js/max";

const src = path.join("node_modules", "country-flag-icons", "3x2");
const out = path.join("public", "flags");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
let n = 0;
const missing = [];
for (const c of getCountries()) {
  const file = path.join(src, `${c}.svg`);
  if (existsSync(file)) {
    copyFileSync(file, path.join(out, `${c}.svg`));
    n++;
  } else missing.push(c);
}
console.log(`Copied ${n} flags to ${out}${missing.length ? ` (no flag for: ${missing.join(", ")})` : ""}`);
console.log(readdirSync(out).length, "files");
