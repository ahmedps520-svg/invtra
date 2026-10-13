import { spawn } from "node:child_process";
import { setPriority } from "node:os";
import sharp from "sharp";
import { renderSvgToPng } from "@/server/render/card";
import { FONTS, type FontKey } from "@/lib/design/fonts";
import { escapeXml } from "@/lib/card/text";

/**
 * The "video for your Status": the event's card on a 9:16 stage, animated with ffmpeg.
 *
 * Every layer is drawn once as a still and ffmpeg moves them: a deep backdrop in the card's
 * colour with a soft light behind the card, two layers of dust drifting upwards at whole
 * pixels per frame (so they never shimmer), the card settling into place, a light sweeping
 * across it twice, and the title and a small INVTRA mark fading in. The host's music, if they
 * added any, plays underneath. The card is there from the very first frame, because that
 * frame is the thumbnail WhatsApp shows in chats.
 *
 * 720×1280 is what WhatsApp keeps of a video even in HD, so rendering more is wasted work.
 */

export const VIDEO_W = 720;
export const VIDEO_H = 1280;
export const VIDEO_FPS = 30;
export const VIDEO_SECONDS = 12;

/** WhatsApp's Status UI covers roughly the top and bottom 140 pixels — keep content clear of them. */
const SAFE_TOP = 150;
const SWEEP_W = 350;

export type VideoLanguage = "EN" | "AR" | "BILINGUAL";

export interface StatusVideoInput {
  /** The card as shown to everyone (no guest name, no QR). */
  card: Buffer;
  language: VideoLanguage;
  fonts: { display: FontKey; arabicDisplay: FontKey };
  /** The design's colours: the backdrop is a deep shade of the card's own colour (or its accent). */
  palette: { background: string; accent: string };
  /** Seeds the dust so the same event always gets the same video. */
  seed: string;
}

export interface Music {
  path: string;
  format: "mp3" | "m4a" | "ogg";
}

export type Geometry = ReturnType<typeof layout>;
export interface Layer {
  name: (typeof LAYERS)[number];
  png: Buffer;
}

const LAYERS = ["stage", "fine", "bokeh", "shadow", "card", "sweep", "title", "brand"] as const;
const TITLE = { EN: "You’re invited", AR: "أنتم مدعوون" } as const;

/** Where everything sits on the stage. */
export function layout(cardW: number, cardH: number, language: VideoLanguage) {
  // Fit the card in a 614×800 box (uploaded designs can be taller than the usual 4:5).
  const scale = Math.min(614 / cardW, 800 / cardH);
  const w = Math.round(cardW * scale);
  const h = Math.round(cardH * scale);
  const titleH = language === "BILINGUAL" ? 128 : 88;
  const gap = 40;
  const top = Math.max(SAFE_TOP, Math.round((VIDEO_H - (titleH + gap + h)) / 2));
  return {
    card: { w, h, x: Math.round((VIDEO_W - w) / 2), y: top + titleH + gap },
    title: { y: top, h: titleH },
    shadowPad: 74,
    brandY: Math.min(VIDEO_H - 168, top + titleH + gap + h + 44),
  };
}

export async function buildLayers(input: StatusVideoInput): Promise<{ layers: Layer[]; geometry: Geometry }> {
  const meta = await sharp(input.card).metadata();
  const g = layout(meta.width ?? 1080, meta.height ?? 1350, input.language);
  const random = rng(input.seed);
  const [inner, outer] = backdrop(input.palette);
  const cx = VIDEO_W / 2;
  const cy = g.card.y + g.card.h / 2;

  // The stage: a deep shade of the card's colour, lighter behind the card, with a warm light and
  // a vignette — then a faint static grain, which keeps a dark gradient from banding into rings.
  const stage = await grain(renderSvgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_W}" height="${VIDEO_H}">
      <defs>
        <radialGradient id="bg" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${VIDEO_H * 0.62}">
          <stop offset="0" stop-color="${inner}"/>
          <stop offset="1" stop-color="${outer}"/>
        </radialGradient>
        <radialGradient id="light" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${g.card.h * 0.78}">
          <stop offset="0" stop-color="#fff3dc" stop-opacity="0.26"/>
          <stop offset="0.5" stop-color="#fff3dc" stop-opacity="0.08"/>
          <stop offset="1" stop-color="#fff3dc" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="edges" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity="0.3"/>
          <stop offset="0.2" stop-color="#000" stop-opacity="0"/>
          <stop offset="0.82" stop-color="#000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity="0.32"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#light)"/>
      <rect width="100%" height="100%" fill="url(#edges)"/>
    </svg>`,
  ), random);

  // Dust: fine specks, and a few large out-of-focus ones that move twice as fast (parallax).
  // Soft edges come from a radial gradient per dot — much cheaper than blurring the layer.
  const frames = VIDEO_FPS * VIDEO_SECONDS;
  const dust = (count: number, rMin: number, rMax: number, oMin: number, oMax: number, travel: number) => {
    const h = VIDEO_H + travel;
    const dots = Array.from({ length: count }, () => {
      const r = rMin + random() * (rMax - rMin);
      const o = oMin + random() * (oMax - oMin);
      return `<circle cx="${(random() * VIDEO_W).toFixed(1)}" cy="${(random() * h).toFixed(1)}" r="${r.toFixed(1)}" fill="url(#d)" opacity="${o.toFixed(3)}"/>`;
    }).join("");
    return renderSvgToPng(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_W}" height="${h}">
        <defs><radialGradient id="d"><stop offset="0" stop-color="#fff4dc"/><stop offset="0.45" stop-color="#fff4dc" stop-opacity="0.75"/><stop offset="1" stop-color="#fff4dc" stop-opacity="0"/></radialGradient></defs>
        ${dots}
      </svg>`,
    );
  };
  const fine = dust(44, 1.6, 3.4, 0.35, 0.85, frames);
  const bokeh = dust(12, 7, 15, 0.1, 0.22, frames * 2);

  // The card and its shadow (the shadow layer carries padding so it can spread).
  const card = await sharp(input.card).resize(g.card.w, g.card.h).png().toBuffer();
  const pad = g.shadowPad;
  // (Drawn, then blurred in a second pass — sharp applies composites after other operations.)
  const shadow = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${g.card.w + pad * 2}" height="${g.card.h + pad * 2}"><rect x="${pad + 6}" y="${pad + 20}" width="${g.card.w - 12}" height="${g.card.h - 8}" fill="#000" fill-opacity="0.62"/></svg>`,
    ),
  )
    .blur(18)
    .png()
    .toBuffer();

  // The light sweep: a band of warm white leaning ~11°, fading out 90px either side of its
  // centre line (the gradient runs across the band, so its edges are soft all the way along).
  const lean = SWEEP_W * 0.42;
  const len = Math.hypot(g.card.h, lean);
  const [nx, ny] = [(g.card.h / len) * 90, (lean / len) * 90];
  const [mx, my] = [SWEEP_W / 2, g.card.h / 2];
  const sweep = renderSvgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SWEEP_W}" height="${g.card.h}">
      <defs><linearGradient id="l" gradientUnits="userSpaceOnUse" x1="${(mx - nx).toFixed(1)}" y1="${(my - ny).toFixed(1)}" x2="${(mx + nx).toFixed(1)}" y2="${(my + ny).toFixed(1)}">
        <stop offset="0" stop-color="#fffaf0" stop-opacity="0"/>
        <stop offset="0.5" stop-color="#fffaf0" stop-opacity="0.32"/>
        <stop offset="1" stop-color="#fffaf0" stop-opacity="0"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#l)"/>
    </svg>`,
  );

  const title = renderSvgToPng(titleSvg(input, g.title.h));
  const brand = renderSvgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_W}" height="40">
      <text x="${cx}" y="26" text-anchor="middle" font-family="Jost" font-weight="500" font-size="15.5" letter-spacing="4.2" fill="#fffaf0" fill-opacity="0.6">INVTRA.STORE</text>
    </svg>`,
  );

  const png = { stage, fine, bokeh, shadow, card, sweep, title, brand };
  return { geometry: g, layers: LAYERS.map((name) => ({ name, png: png[name] })) };
}

/** "You're invited" in the card's own display font, with a small ornament under it. */
function titleSvg(input: StatusVideoInput, h: number) {
  const latin = FONTS[input.fonts.display];
  const arabic = FONTS[input.fonts.arabicDisplay];
  const latinSize = latin.kind === "script" ? 66 : latin.family === "Cinzel" ? 40 : 54;
  const arabicSize = arabic.kind === "script" ? 56 : 50;
  const italic = latin.family === "Cormorant Garamond" || latin.family === "Playfair Display";
  const shadow = `<filter id="sh" x="-20%" y="-50%" width="140%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000" flood-opacity="0.35"/></filter>`;
  const line = (text: string, family: string, size: number, y: number, opts: { italic?: boolean; rtl?: boolean } = {}) =>
    `<text x="${VIDEO_W / 2}" y="${y}" text-anchor="middle"${opts.rtl ? ' direction="rtl"' : ""} font-family="'${family}'" font-size="${size}"${opts.italic ? ' font-style="italic"' : ""} fill="#fffaf0" filter="url(#sh)">${escapeXml(text)}</text>`;
  const lines =
    input.language === "AR"
      ? line(TITLE.AR, arabic.family, arabicSize, 56, { rtl: true })
      : input.language === "EN"
        ? line(TITLE.EN, latin.family, latinSize, 56, { italic })
        : line(TITLE.AR, arabic.family, arabicSize, 54, { rtl: true }) + line(TITLE.EN, latin.family, Math.round(latinSize * 0.68), 100, { italic });
  const cx = VIDEO_W / 2;
  const oy = h - 12;
  const ornament = `<g stroke="#fffaf0" stroke-opacity="0.7" stroke-width="1"><line x1="${cx - 62}" y1="${oy}" x2="${cx - 11}" y2="${oy}"/><line x1="${cx + 11}" y1="${oy}" x2="${cx + 62}" y2="${oy}"/></g>
    <rect x="${cx - 3.5}" y="${oy - 3.5}" width="7" height="7" transform="rotate(45 ${cx} ${oy})" fill="#fffaf0" fill-opacity="0.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_W}" height="${h}"><defs>${shadow}</defs>${lines}${ornament}</svg>`;
}

/** ffmpeg expression: 0→1 between a and b, easing out (cubic). */
const easeOut = (a: number, b: number) => `(1-pow(1-clip((t-${a})/${b - a},0,1),3))`;
/** ffmpeg expression: 0→1 between a and b, smooth at both ends. */
const smooth = (a: number, b: number) => {
  const p = `clip((t-${a})/${b - a},0,1)`;
  return `(${p}*${p}*(3-2*${p}))`;
};

/** The ffmpeg arguments that turn the layers (written to `dir` as <name>.png) into the MP4 at `out`. */
export function ffmpegArgs(dir: string, g: Geometry, out: string, music?: Music | null): string[] {
  const T = VIDEO_SECONDS;
  // Every layer is read once as a single frame. Those that change over time are repeated
  // inside the filter graph (the loop filter) for as long as they change; overlay keeps
  // reusing the last frame of the rest. No per-frame decoding keeps ffmpeg light enough for a
  // small server.
  const inputs = LAYERS.flatMap((name) => ["-i", `${dir}/${name}.png`]);
  const frames = (seconds: number | null) => `loop=loop=${seconds === null ? -1 : Math.round(seconds * VIDEO_FPS)}:size=1,setpts=N/${VIDEO_FPS}/TB`;
  // The music's container is passed explicitly, so ffmpeg never guesses a demuxer for an uploaded file.
  const audio = music ? ["-stream_loop", "-1", "-f", music.format === "m4a" ? "mov" : music.format, "-i", music.path] : [];

  // The light passes twice: just after the card lands, and again near the end.
  const pass = (a: number, b: number) => `if(between(t,${a},${b}),-${SWEEP_W}+${g.card.w + SWEEP_W}*${smooth(a, b)},`;
  const sweepX = `${pass(1.8, 3.1)}${pass(7.6, 8.9)}-${SWEEP_W + 10}))`;
  const rise = (px: number, a: number, b: number) => `${px}*(1-${easeOut(a, b)})`;
  const cardY = (base: number) => `${base}+${rise(40, 0, 1.5)}`;

  const filter = [
    `[0:v]${frames(null)},format=rgb24[stage]`,
    `[4:v]${frames(null)},format=rgba[paper]`,
    `[paper][5:v]overlay=x='${sweepX}':y=0:eval=frame:format=rgb[card]`,
    `[6:v]${frames(1.8)},format=rgba,fade=t=in:st=0.6:d=1.0:alpha=1[title]`,
    `[7:v]${frames(3.2)},format=rgba,fade=t=in:st=2.1:d=1.0:alpha=1[brand]`,
    `[stage][2:v]overlay=x=0:y='-2*n':eval=frame:format=rgb[s1]`,
    `[s1][1:v]overlay=x=0:y='-n':eval=frame:format=rgb[s2]`,
    `[s2][3:v]overlay=x=${g.card.x - g.shadowPad}:y='${cardY(g.card.y - g.shadowPad)}':eval=frame:format=rgb[s3]`,
    `[s3][card]overlay=x=${g.card.x}:y='${cardY(g.card.y)}':eval=frame:format=rgb[s4]`,
    `[s4][title]overlay=x=0:y='${g.title.y}+${rise(16, 0.6, 1.8)}':eval=frame:format=rgb[s5]`,
    `[s5][brand]overlay=x=0:y=${g.brandY}:format=rgb,format=yuv420p[v]`,
    ...(music ? [`[8:a]aresample=44100,afade=t=in:st=0:d=0.8,afade=t=out:st=${T - 1.8}:d=1.8[a]`] : []),
  ].join(";");

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    ...inputs,
    ...audio,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    ...(music ? ["-map", "[a]", "-c:a", "aac", "-b:a", "160k", "-ac", "2"] : []),
    "-t",
    String(T),
    "-r",
    String(VIDEO_FPS),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-g",
    String(VIDEO_FPS * 2),
    "-threads",
    "2",
    "-x264-params",
    "rc-lookahead=10",
    "-movflags",
    "+faststart",
    out,
  ];
}

/** The still shown before the video plays: a moment after everything has settled. */
export function posterArgs(video: string, out: string): string[] {
  return ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ss", "6", "-i", video, "-frames:v", "1", "-q:v", "3", out];
}

/** Runs ffmpeg at low priority with a time limit; rejects with the tail of its error output. */
export function runFfmpeg(bin: string, args: string[], timeoutMs = 180_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["-protocol_whitelist", "file", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    try {
      if (child.pid) setPriority(child.pid, 10); // keep the web server responsive
    } catch {
      // not permitted here — fine
    }
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${signal ? `stopped (${signal})` : `exited with ${code}`}: ${stderr.trim().slice(-800)}`));
    });
  });
}

/** Adds ±2 levels of triangular noise (the same in every frame, so it costs almost nothing to encode). */
async function grain(png: Buffer, random: () => number): Promise<Buffer> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i++) data[i] = Math.min(255, Math.max(0, data[i] + Math.round((random() - random()) * 2)));
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
}

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * The backdrop's two colours (centre, edge), worked out in OKLCH so every hue comes out
 * equally deep: the hue of the card's background when it has one (a green card gets a deep
 * green stage), otherwise of its accent; grey designs get a warm charcoal.
 */
export function backdrop(palette: { background: string; accent: string }): [string, string] {
  const bg = toOklch(palette.background);
  const accent = toOklch(palette.accent);
  const [, C, h] = bg[1] >= 0.025 ? bg : accent;
  const hue = C < 0.02 ? 60 : h;
  const chroma = C < 0.02 ? 0.012 : Math.min(C, 0.075);
  return [fromOklch(0.36, chroma, hue), fromOklch(0.18, chroma * 0.6, hue)];
}

function toOklch(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function fromOklch(L: number, C: number, h: number): string {
  const A = C * Math.cos((h * Math.PI) / 180);
  const B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gam = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, gam(v))) * 255).toString(16).padStart(2, "0")).join("")}`;
}
