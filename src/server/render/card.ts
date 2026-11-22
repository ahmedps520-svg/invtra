import path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
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

/** Design artwork referenced by public path (e.g. "/stationery/peony.jpg?v=1"): the browser loads it by URL, resvg gets it inlined. */
const ARTWORK_HREF = /href="\/stationery\/([a-z0-9-]+)\.(jpg|png)(?:\?v=\d+)?"/g;
const artwork = new Map<string, string>();

function inlineArtwork(svg: string): string {
  return svg.replace(ARTWORK_HREF, (_m, name: string, ext: string) => {
    const file = `${name}.${ext}`;
    let uri = artwork.get(file);
    if (!uri) {
      const data = readFileSync(path.join(process.cwd(), "public", "stationery", file)).toString("base64");
      uri = `data:image/${ext === "jpg" ? "jpeg" : "png"};base64,${data}`;
      artwork.set(file, uri);
    }
    return `href="${uri}"`;
  });
}

export function renderSvgToPng(svg: string, width?: number): Buffer {
  const resvg = new Resvg(inlineArtwork(svg), {
    font: { fontFiles: fonts(), loadSystemFonts: false, defaultFontFamily: "Jost" },
    fitTo: width ? { mode: "width", value: width } : { mode: "original" },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
  });
  return resvg.render().asPng();
}
