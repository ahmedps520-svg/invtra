import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { buildCardSvg } from "@/lib/card/build";
import { sampleCardContent, themeSampleContent } from "@/lib/card/sample";
import { escapeXml, measure, type TextStyle } from "@/lib/card/text";
import { getTheme, isThemeKey, type ThemeKey } from "@/lib/themes/registry";
import { INVITATIONS_HUB, getOccasionPage } from "@/lib/seo/occasion-pages";
import { renderSvgToPng } from "@/server/render/card";

/**
 * 1200×630 share images (Open Graph / X / WhatsApp link previews): the page's headline
 * beside real invitation designs, rendered with the same engine as the invitations.
 */

export const OG_SIZE = { width: 1200, height: 630 };

type Spec = { title: string; subtitle: string; cards: { theme: ThemeKey; content?: ReturnType<typeof sampleCardContent> }[] };

function specFor(key: string, locale: Locale): Spec | null {
  const dict = getDictionary(locale);
  const m = dict.marketing;
  const ar = locale === "ar";
  const tagline = ar ? "دعوات إلكترونية تصل عبر واتساب" : "Digital invitations, delivered on WhatsApp";
  switch (key) {
    case "home":
      return { title: `${m.hero.titleLine1} ${m.hero.titleLine2}`, subtitle: ar ? "دعوات رقمية للأعراس والمواليد وكل مناسبة — عبر واتساب" : "Digital invitations for weddings, newborns & every occasion — on WhatsApp", cards: [{ theme: "teddy" }, { theme: "luxury" }, { theme: "lantern" }] };
    case "invitations":
      return { title: INVITATIONS_HUB[locale].h1, subtitle: tagline, cards: [{ theme: "moonlight" }, { theme: "royal" }, { theme: "confetti" }] };
    case "designs":
      return { title: m.designsPage.title, subtitle: m.designs.title, cards: [{ theme: "clouds" }, { theme: "romantic" }, { theme: "henna" }] };
    case "pricing":
      return { title: m.pricing.title, subtitle: tagline, cards: [{ theme: "minimal" }, { theme: "traditional" }] };
  }
  const page = getOccasionPage(key);
  if (page) {
    const content = sampleCardContent(page.type);
    const second = (["luxury", "minimal", "arabic"] as ThemeKey[]).find((t) => t !== page.theme && getTheme(t).occasions.includes(page.type)) ?? "minimal";
    return { title: page[locale].title, subtitle: tagline, cards: [{ theme: second, content }, { theme: page.theme }] };
  }
  if (isThemeKey(key)) {
    return { title: `${dict.themes[key].name}`, subtitle: dict.themes[key].description, cards: [{ theme: key }] };
  }
  return null;
}

/** Greedy word wrap using the card engine's font metrics. */
function wrap(text: string, style: TextStyle, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next, style) <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,.;:—-]+$/, "")}…`;
  return kept;
}

const cache = new Map<string, Buffer>();

export function ogImagePng(key: string, locale: Locale): Buffer | null {
  const id = `${key}:${locale}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const spec = specFor(key, locale);
  if (!spec) return null;

  const ar = locale === "ar";
  const { width: W, height: H } = OG_SIZE;
  const textW = 480;
  const textX = ar ? W - 80 : 80;
  const anchor = ar ? "end" : "start";
  const rtl = ar ? ' direction="rtl" xml:lang="ar" text-anchor="end"' : ` text-anchor="${anchor}"`;
  const titleStyle: TextStyle = ar ? { family: "Amiri", weight: 700, size: 56 } : { family: "Cormorant Garamond", weight: 500, size: 62 };
  let titleLines = wrap(spec.title, titleStyle, textW, 3);
  if (titleLines.length === 3) {
    titleStyle.size = ar ? 48 : 52;
    titleLines = wrap(spec.title, titleStyle, textW, 3);
  }
  const subStyle: TextStyle = ar ? { family: "IBM Plex Sans Arabic", weight: 400, size: 26 } : { family: "Jost", weight: 400, size: 25 };
  const subLines = wrap(spec.subtitle, subStyle, textW, 2);
  const lineH = titleStyle.size * (ar ? 1.35 : 1.08);
  const blockH = 40 + 34 + titleLines.length * lineH + 22 + subLines.length * subStyle.size * 1.45;
  let y = Math.max(70, (H - blockH) / 2);

  let text = `<text x="${textX}" y="${y + 18}" text-anchor="${anchor}" font-family="Jost" font-weight="500" font-size="20" letter-spacing="7" fill="#84664a">INVTRA</text>`;
  y += 40 + 34;
  titleLines.forEach((l, i) => {
    y += i === 0 ? titleStyle.size * 0.9 : lineH;
    text += `<text x="${textX}" y="${y.toFixed(1)}" font-family="${titleStyle.family}" font-weight="${titleStyle.weight}" font-size="${titleStyle.size}" fill="#1e1a16"${rtl}>${escapeXml(l)}</text>`;
  });
  y += 22;
  for (const l of subLines) {
    y += subStyle.size * 1.45;
    text += `<text x="${textX}" y="${y.toFixed(1)}" font-family="${subStyle.family}" font-size="${subStyle.size}" fill="#57504a"${rtl}>${escapeXml(l)}</text>`;
  }
  text += `<text x="${textX}" y="${H - 56}" text-anchor="${anchor}" font-family="Jost" font-weight="500" font-size="20" letter-spacing="1" fill="#84664a">invtra.store</text>`;

  // Cards, fanned on the opposite side of the text.
  const cardW = 300;
  const cardH = cardW * 1.25;
  const centre = ar ? 310 : W - 310;
  const n = spec.cards.length;
  const slots = n === 1 ? [{ dx: 0, rot: 0 }] : n === 2 ? [{ dx: -78, rot: -6 }, { dx: 78, rot: 5 }] : [{ dx: -125, rot: -9 }, { dx: 125, rot: 9 }, { dx: 0, rot: 0 }];
  let cards = "";
  spec.cards.forEach((c, i) => {
    const theme = getTheme(c.theme);
    const svg = buildCardSvg({
      theme,
      design: theme.defaults,
      language: ar ? "AR" : "EN",
      content: c.content ?? themeSampleContent(c.theme),
      guest: { name: ar ? "خالد الهاشمي" : "Khalid Al Hashimi", allowedCount: 2 },
      qrText: "HTTPS://INVTRA.STORE/Q/SAMPLE0000",
    });
    const png = renderSvgToPng(svg, cardW * 2).toString("base64");
    const s = slots[i];
    const cx = centre + (ar ? -s.dx : s.dx);
    const cy = H / 2 + (s.rot ? 18 : 0);
    const x = cx - cardW / 2;
    const yy = cy - cardH / 2;
    cards += `<g transform="rotate(${ar ? -s.rot : s.rot} ${cx} ${cy})">
      <rect x="${x + 6}" y="${yy + 16}" width="${cardW}" height="${cardH}" rx="6" fill="#3a2a1a" opacity="0.22" filter="url(#shadow)"/>
      <image href="data:image/png;base64,${png}" x="${x}" y="${yy}" width="${cardW}" height="${cardH}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="${x}" y="${yy}" width="${cardW}" height="${cardH}" fill="none" stroke="#000" stroke-opacity="0.06"/>
    </g>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="glow" cx="${ar ? 0.28 : 0.72}" cy="0.5" r="0.62"><stop offset="0" stop-color="#efe4d6"/><stop offset="1" stop-color="#faf7f2"/></radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#c9b092" stroke-opacity="0.45"/>
    ${cards}
    ${text}
  </svg>`;
  const out = renderSvgToPng(svg);
  cache.set(id, out);
  return out;
}
