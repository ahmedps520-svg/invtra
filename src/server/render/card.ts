import path from "node:path";
import { readdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

/**
 * Rasterises card SVGs with resvg (Rust, no browser needed). resvg performs full
 * OpenType shaping (HarfBuzz port) so Arabic joins and RTL runs render correctly.
 */

let fontFiles: string[] | null = null;

function fonts(): string[] {
  if (fontFiles) return fontFiles;
  const dir = path.join(process.cwd(), "assets", "fonts");
  fontFiles = readdirSync(dir)
    .filter((f) => f.endsWith(".ttf"))
    .map((f) => path.join(dir, f));
  return fontFiles;
}

export function renderSvgToPng(svg: string, width?: number): Buffer {
  const resvg = new Resvg(svg, {
    font: { fontFiles: fonts(), loadSystemFonts: false, defaultFontFamily: "Jost" },
    fitTo: width ? { mode: "width", value: width } : { mode: "original" },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
  });
  return resvg.render().asPng();
}
