import path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

/**
 * Rasterises card SVGs with resvg (Rust, no browser needed). resvg performs full
 * OpenType shaping (HarfBuzz port) so Arabic joins and RTL runs render correctly.
 */

let fontIndex: { all: string[]; byFamily: Map<string, string[]> } | null = null;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The font files (assets/fonts, named "<family-slug>-<weight>[-italic].ttf"), by family. */
function fonts() {
  if (fontIndex) return fontIndex;
  const dir = path.join(process.cwd(), "assets", "fonts");
  const all = readdirSync(dir)
    .filter((f) => f.endsWith(".ttf"))
    .sort()
    .map((f) => path.join(dir, f));
  fontIndex = { all, byFamily: new Map() };
  return fontIndex;
}

function familyFiles(family: string): string[] {
  const idx = fonts();
  let files = idx.byFamily.get(family);
  if (!files) {
    const re = new RegExp(`^${slug(family)}-\\d+(-italic)?\\.ttf$`);
    files = idx.all.filter((f) => re.test(path.basename(f)));
    idx.byFamily.set(family, files);
  }
  return files;
}

/** Always available: the default face, and Arabic faces for text a design's own font can't draw. */
const BASE_FAMILIES = ["Jost", "IBM Plex Sans Arabic", "Amiri"];

/**
 * The fonts a card uses (and the base ones), so each render loads a few files rather than all of
 * them. A family that isn't found loads everything, as before.
 */
export function fontFilesFor(svg: string): string[] {
  const families = new Set(BASE_FAMILIES);
  for (const m of svg.matchAll(/font-family(?:="|:\s*)([^";>]+)/g)) {
    for (const part of m[1].split(",")) {
      const f = part.trim().replace(/^(['"]|&quot;|&apos;)|(['"]|&quot;|&apos;)$/g, "");
      if (f) families.add(f);
    }
  }
  const out: string[] = [];
  for (const f of families) {
    const files = familyFiles(f);
    if (!files.length && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(f)) return fonts().all;
    out.push(...files);
  }
  return out;
}

/** Design artwork referenced by public path (e.g. "/stationery/peony.jpg?v=1"): the browser loads it by URL, resvg gets it inlined. */
const ARTWORK_HREF = /href="\/stationery\/([a-z0-9-]+)\.(jpg|png)(?:\?v=\d+)?"/g;
/** Recently used artwork as data URIs (~300 KB each); bounded, since there are hundreds of designs. */
const artwork = new Map<string, string>();
const ARTWORK_CACHE = 24;

function inlineArtwork(svg: string): string {
  return svg.replace(ARTWORK_HREF, (_m, name: string, ext: string) => {
    const file = `${name}.${ext}`;
    let uri = artwork.get(file);
    if (uri) {
      artwork.delete(file);
    } else {
      const data = readFileSync(path.join(process.cwd(), "public", "stationery", file)).toString("base64");
      uri = `data:image/${ext === "jpg" ? "jpeg" : "png"};base64,${data}`;
      if (artwork.size >= ARTWORK_CACHE) artwork.delete(artwork.keys().next().value!);
    }
    artwork.set(file, uri);
    return `href="${uri}"`;
  });
}

export function renderSvgToPng(svg: string, width?: number): Buffer {
  const resvg = new Resvg(inlineArtwork(svg), {
    font: { fontFiles: fontFilesFor(svg), loadSystemFonts: false, defaultFontFamily: "Jost" },
    fitTo: width ? { mode: "width", value: width } : { mode: "original" },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
  });
  return resvg.render().asPng();
}
