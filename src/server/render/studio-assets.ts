import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Studio pieces are served to browsers as WebP (public/studio), which resvg can't decode: before a
 * Studio card is rasterised, each piece it uses is converted to PNG once and inlined as a data URI.
 */

const STUDIO_HREF = /href="\/studio\/(a|s|t)\/([a-z0-9-]+)\.webp(?:\?v=\d+)?"/g;
const PAPER_HREF = /href="\/studio\/paper\.jpg(?:\?v=\d+)?"/g;

/** Converted pieces, least recently used dropped first once they pass ~96 MB of data URIs. */
const cache = new Map<string, string>();
let cacheBytes = 0;
const CACHE_BYTES = 96 * 1024 * 1024;

function remember(key: string, uri: string) {
  cache.set(key, uri);
  cacheBytes += uri.length;
  while (cacheBytes > CACHE_BYTES && cache.size > 1) {
    const [k, v] = cache.entries().next().value!;
    cache.delete(k);
    cacheBytes -= v.length;
  }
}

async function dataUri(dir: string, id: string): Promise<string | null> {
  const key = `${dir}/${id}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  try {
    const webp = await readFile(path.join(process.cwd(), "public", "studio", dir, `${id}.webp`));
    const png = await sharp(webp).png({ compressionLevel: 3 }).toBuffer();
    const uri = `data:image/png;base64,${png.toString("base64")}`;
    remember(key, uri);
    return uri;
  } catch {
    return null;
  }
}

let paper: string | null = null;

/** Inline every Studio piece (and the paper grain) an SVG refers to. */
export async function inlineStudioAssets(svg: string): Promise<string> {
  const refs = new Map<string, [string, string]>();
  for (const m of svg.matchAll(STUDIO_HREF)) refs.set(m[0], [m[1], m[2]]);
  const uris = new Map<string, string>();
  await Promise.all(
    [...refs].map(async ([match, [dir, id]]) => {
      const uri = await dataUri(dir, id);
      if (uri) uris.set(match, uri);
    }),
  );
  let out = svg.replace(STUDIO_HREF, (m) => (uris.has(m) ? `href="${uris.get(m)}"` : m));
  if (PAPER_HREF.test(out)) {
    paper ??= `data:image/jpeg;base64,${(await readFile(path.join(process.cwd(), "public", "studio", "paper.jpg"))).toString("base64")}`;
    out = out.replace(PAPER_HREF, `href="${paper}"`);
  }
  return out;
}
