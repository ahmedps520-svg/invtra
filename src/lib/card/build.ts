import type { EventType } from "@prisma/client";
import { cardQrText, type InvitationDesign } from "@/lib/design/schema";
import { FONTS, displayWeight } from "@/lib/design/fonts";
import type { ThemeDefinition } from "@/lib/themes/types";
import { CARD_PHRASES, copyFor } from "@/lib/invitation-copy";
import { fmt } from "@/lib/i18n/config";
import { qrSvgGroup } from "@/lib/qr";
import { buildOrnament } from "./ornaments";
import { ascent, escapeXml, fit, isArabic, measure, type TextStyle } from "./text";

/**
 * Builds the invitation image as an SVG string. Pure and isomorphic: the editor
 * renders it live in the browser, the server rasterises the same SVG with resvg
 * (src/server/render/card.ts) for WhatsApp.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;

export type CardLanguage = "EN" | "AR" | "BILINGUAL";

export interface CardContent {
  eventType: EventType;
  title: string;
  titleAr?: string | null;
  hostNames: string;
  hostNamesAr?: string | null;
  /** Pre-formatted in the event's timezone. */
  date: { en: string; ar: string };
  time: { en: string; ar: string };
  venueName: string;
  venueNameAr?: string | null;
  address: string;
  addressAr?: string | null;
}

export interface CardImage {
  href: string;
  width: number;
  height: number;
}

export interface CardInput {
  theme: ThemeDefinition;
  design: InvitationDesign;
  language: CardLanguage;
  content: CardContent;
  guest?: { name: string; allowedCount: number } | null;
  /** Text encoded in the QR. Omit for a non-personal card (e.g. social preview). */
  qrText?: string | null;
  /** Draw a sample QR (editor preview) when no qrText is given. */
  qrPlaceholder?: boolean;
  backgroundImage?: CardImage | null;
}

type Block = { height: number; render: (top: number) => string };

const BASE_GAPS = { afterMonogram: 26, afterEyebrow: 26, afterNames: 28, afterIntro: 30, afterDivider: 30, afterDate: 8, afterTime: 26, afterVenue: 6 };

function family(key: keyof typeof FONTS) {
  return FONTS[key].family;
}

function textEl(
  line: string,
  x: number,
  baseline: number,
  style: TextStyle,
  fill: string,
  anchor: "start" | "middle" | "end" = "middle",
  opacity = 1,
): string {
  const ar = isArabic(line);
  const t = style.uppercase && !ar ? line.toUpperCase() : line;
  // For RTL text, SVG "start"/"end" are mirrored — convert from absolute alignment.
  const a = ar && anchor !== "middle" ? (anchor === "start" ? "end" : "start") : anchor;
  const ls = !ar && style.letterSpacing ? ` letter-spacing="${(style.letterSpacing * style.size).toFixed(2)}"` : "";
  return (
    `<text x="${x.toFixed(1)}" y="${baseline.toFixed(1)}" font-family="'${style.family}'" font-size="${style.size.toFixed(1)}"` +
    ` font-weight="${style.weight}"${style.italic ? ' font-style="italic"' : ""} fill="${fill}"${opacity !== 1 ? ` fill-opacity="${opacity}"` : ""}` +
    ` text-anchor="${a}"${ar ? ' direction="rtl" xml:lang="ar"' : ""}${ls}>${escapeXml(t)}</text>`
  );
}

/** Multi-line text block, centred on cx. */
function textBlock(
  text: string,
  style: TextStyle,
  maxWidth: number,
  maxLines: number,
  cx: number,
  fill: string,
  leading = 1.25,
  opacity = 1,
): Block {
  const r = fit(text, style, maxWidth, { maxLines });
  const s = r.style;
  const lh = s.size * leading;
  const asc = Math.min(Math.max(ascent(s), s.size * 0.72), s.size * 1.0);
  const height = asc + lh * (r.lines.length - 1) + s.size * 0.28;
  return {
    height,
    render: (top) => r.lines.map((l, i) => textEl(l, cx, top + asc + i * lh, s, fill, "middle", opacity)).join(""),
  };
}

/** Sample code drawn in the editor before there's a guest. */
const SAMPLE_QR = "HTTPS://INVTRA.STORE/Q/SAMPLE0000";

/**
 * What the card's QR encodes: nothing when the QR is turned off, else the design's own link
 * when one is set, else the guest's personal link (or the sample in the editor).
 */
function effectiveQrText(design: InvitationDesign, qrText: string | null | undefined, placeholder: boolean | undefined): string | null {
  if (!qrText && !placeholder) return null;
  return cardQrText(design, qrText || SAMPLE_QR);
}

/** Extra lines typed in the editor: one per line, at most four. */
function splitExtra(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function splitNames(names: string): [string, string] | null {
  const m = names.split(/\s+(?:&|and|و)\s+|\s*&\s*/i);
  if (m.length === 2 && m[0].trim() && m[1].trim()) return [m[0].trim(), m[1].trim()];
  return null;
}

export function buildCardSvg(input: CardInput): string {
  const { theme, design, language, content, guest } = input;
  const p = design.palette;
  const W = CARD_W;
  const H = CARD_H;
  const isAr = language === "AR";
  const bi = language === "BILINGUAL";
  const qrSizes = { sm: 210, md: 250, lg: 300 } as const;
  const qrSize = qrSizes[design.card.qr.size];
  const qrText = effectiveQrText(design, input.qrText, input.qrPlaceholder);
  const hasQr = Boolean(qrText);
  const lines = design.card.lines;
  const showGuest = Boolean(guest) && design.card.showGuestName;
  const phrases = isAr ? CARD_PHRASES.ar : CARD_PHRASES.en;
  const scanText = design.card.qr.caption || phrases.scan;
  const footerLang: "en" | "ar" = isAr ? "ar" : "en";

  // ── Footer geometry ────────────────────────────────────────────────────────
  const preliminary = buildOrnament(theme.card.ornament, { W, H, palette: p, footerTop: H, texture: false });
  const bottomPad = preliminary.bottomPad;
  const centered = design.card.qr.position === "bottom-center";
  const brandingH = design.card.showBranding ? 34 : 0;
  let footerTop: number;
  if (!hasQr) footerTop = H - bottomPad - brandingH - (showGuest ? 50 : 0);
  else if (centered) footerTop = H - bottomPad - brandingH - qrSize - 46 - (showGuest ? 52 : 0);
  else footerTop = H - bottomPad - brandingH - qrSize - 10;

  const textureOn = design.background.mode === "theme";
  const orn = buildOrnament(theme.card.ornament, { W, H, palette: p, footerTop, texture: textureOn });
  const { x: cx0, w: cw, top: ctop, bottom: cbottom } = orn.content;
  const cx = cx0 + cw / 2;

  // ── Fonts ──────────────────────────────────────────────────────────────────
  const latinDisplay = family(design.fonts.display);
  const latinBody = family(design.fonts.body);
  const arDisplay = family(design.fonts.arabicDisplay);
  const arBody = family(design.fonts.arabicBody);
  const bodyItalic = ["cormorant", "playfair"].includes(design.fonts.body);
  // The names can have their own typeface and colour (else the display typefaces and text colour).
  const namesKey = design.names?.font ?? design.fonts.display;
  const namesLatin = family(namesKey);
  const namesArabic = family(design.names?.fontAr ?? design.fonts.arabicDisplay);
  const namesWeight = displayWeight(namesKey);
  const namesColor = design.names?.color ?? p.text;
  const namesUpper = theme.card.namesUppercase && FONTS[namesKey].kind !== "script";
  const amp = ["cormorant", "playfair"].includes(namesKey);

  const enCopy = copyFor(content.eventType, "en", { eyebrow: design.texts.eyebrow, intro: design.texts.intro });
  const arCopy = copyFor(content.eventType, "ar", { eyebrow: design.texts.eyebrowAr, intro: design.texts.introAr });

  const build = (k: number, nk: number): { blocks: Block[]; gaps: number[] } => {
    const blocks: Block[] = [];
    const gaps: number[] = [];
    const push = (b: Block, gapAfter: number) => {
      blocks.push(b);
      gaps.push(gapAfter * k);
    };

    // Monogram
    if (design.monogram) {
      const r = 54 * k;
      const mono = design.monogram;
      const st: TextStyle = { family: isArabic(mono) ? arDisplay : latinDisplay, weight: 500, size: 46 * k, letterSpacing: 0.04 };
      push(
        {
          height: r * 2,
          render: (top) =>
            `<circle cx="${cx}" cy="${top + r}" r="${r}" fill="none" stroke="${p.accent}" stroke-width="1.6"/>` +
            `<circle cx="${cx}" cy="${top + r}" r="${r - 7 * k}" fill="none" stroke="${p.accent}" stroke-width="0.7" opacity="0.6"/>` +
            textEl(mono, cx, top + r + st.size * 0.34, st, p.accent),
        },
        BASE_GAPS.afterMonogram,
      );
    }

    // Eyebrow
    const eyebrowStyleEn: TextStyle = {
      family: latinBody,
      weight: 500,
      size: 23 * k,
      letterSpacing: theme.card.eyebrowUppercase ? 0.28 : 0.04,
      uppercase: theme.card.eyebrowUppercase,
    };
    const eyebrowStyleAr: TextStyle = { family: arBody, weight: 400, size: 32 * k };
    if (lines.eyebrow) {
      if (isAr || bi) push(textBlock(arCopy.eyebrow, eyebrowStyleAr, cw, 2, cx, p.accent), bi ? 10 : BASE_GAPS.afterEyebrow);
      if (!isAr) push(textBlock(enCopy.eyebrow, eyebrowStyleEn, cw, 2, cx, p.accent), BASE_GAPS.afterEyebrow);
    }

    // Names
    const nameSize = 116 * theme.card.nameScale * k * nk;
    const namesFor = (names: string, arabic: boolean, scale = 1): Block => {
      const st: TextStyle = arabic
        ? { family: namesArabic, weight: 400, size: nameSize * 0.95 * scale }
        : {
            family: namesLatin,
            weight: namesWeight,
            size: nameSize * scale,
            uppercase: namesUpper,
            letterSpacing: namesUpper ? 0.08 : 0,
          };
      const pair = theme.card.stackNames ? splitNames(names) : null;
      if (!pair) return textBlock(names, st, cw, 2, cx, namesColor, 1.05);
      const a1 = fit(pair[0], st, cw, { maxLines: 1 });
      const a2 = fit(pair[1], st, cw, { maxLines: 1 });
      const s = { ...st, size: Math.min(a1.style.size, a2.style.size) };
      const ampStyle: TextStyle = arabic
        ? { family: namesArabic, weight: 400, size: s.size * 0.5 }
        : { family: amp ? namesLatin : "Cormorant Garamond", weight: 400, italic: true, size: s.size * 0.7 };
      const asc = s.size * 0.86;
      const lh1 = s.size * 1.02;
      const ampH = ampStyle.size * (arabic ? 1.05 : 0.95);
      return {
        height: asc + lh1 + ampH + s.size * 0.3,
        render: (top) =>
          textEl(pair[0], cx, top + asc, s, namesColor) +
          textEl(arabic ? "و" : "&", cx, top + asc + ampH * 0.95, ampStyle, p.accent) +
          textEl(pair[1], cx, top + asc + ampH + lh1 * 0.92, s, namesColor),
      };
    };
    const namesEn = content.hostNames.trim();
    const namesAr = (content.hostNamesAr ?? "").trim();
    if (!lines.names || (!namesEn && !namesAr)) {
      // Left off the card (or not given).
    } else if (isAr) push(namesFor(namesAr || namesEn, Boolean(namesAr) || isArabic(namesEn)), BASE_GAPS.afterNames);
    else if (bi) {
      push(namesFor(namesAr || namesEn, Boolean(namesAr) || isArabic(namesEn), 0.78), namesAr && namesEn ? 6 : BASE_GAPS.afterNames);
      if (namesAr && namesEn)
        push(textBlock(namesEn, { family: namesLatin, weight: namesWeight, size: nameSize * 0.6, uppercase: namesUpper, letterSpacing: namesUpper ? 0.08 : 0 }, cw, 1, cx, namesColor), BASE_GAPS.afterNames);
    } else if (namesEn) push(namesFor(namesEn, false), BASE_GAPS.afterNames);

    // Intro line
    const introEn: TextStyle = { family: latinBody, weight: 400, italic: bodyItalic, size: 33 * k };
    const introAr: TextStyle = { family: arBody, weight: 400, size: 36 * k };
    if (lines.intro) {
      if (isAr || bi) push(textBlock(arCopy.intro, introAr, cw * 0.9, 2, cx, p.text, 1.45, 0.85), bi ? 6 : BASE_GAPS.afterIntro);
      if (!isAr) push(textBlock(enCopy.intro, introEn, cw * (bi ? 0.9 : 0.86), bi ? 2 : 3, cx, p.text, 1.3, 0.85), BASE_GAPS.afterIntro);
    }

    // Divider (between the greeting and the practical details, when there are both)
    const venueEnText = content.venueName.trim();
    const venueArText = (content.venueNameAr || (isAr ? content.venueName : "")).trim();
    const addrText = design.card.showVenueAddress ? ((isAr ? content.addressAr || content.address : content.address) ?? "").trim() : "";
    const extraEn = splitExtra(design.texts.extra);
    const extraAr = splitExtra(design.texts.extraAr);
    const hasVenue = lines.venue && Boolean(isAr ? venueArText : venueEnText || (bi && venueArText));
    const below = lines.date || (lines.time && Boolean(content.time.en || content.time.ar)) || hasVenue || Boolean(addrText) || extraEn.length > 0 || extraAr.length > 0;
    if (blocks.length && below) push({ height: 24 * k, render: (top) => orn.divider(cx, top + 12 * k, k) }, BASE_GAPS.afterDivider);

    // Date & time
    const dateEn: TextStyle = { family: latinBody, weight: 500, size: 31 * k, uppercase: true, letterSpacing: 0.14 };
    const dateAr: TextStyle = { family: arBody, weight: 700, size: 36 * k };
    const timeEn: TextStyle = { family: latinBody, weight: 400, size: 28 * k, letterSpacing: 0.06 };
    const timeAr: TextStyle = { family: arBody, weight: 400, size: 32 * k };
    // An unknown time ("to be announced") has no line.
    const showTime = lines.time && Boolean(content.time.en || content.time.ar);
    if (lines.date) {
      if (isAr || bi) push(textBlock(content.date.ar, dateAr, cw, 1, cx, p.text), showTime ? BASE_GAPS.afterDate : BASE_GAPS.afterTime);
      if (!isAr) push(textBlock(content.date.en, dateEn, cw, 1, cx, p.text), showTime ? BASE_GAPS.afterDate : BASE_GAPS.afterTime);
    }
    if (!showTime) {
      // Left off the card.
    } else if (isAr) push(textBlock(`${CARD_PHRASES.ar.at} ${content.time.ar}`, timeAr, cw, 1, cx, p.muted), BASE_GAPS.afterTime);
    else if (bi) push(textBlock(`${content.time.en}  ·  ${content.time.ar}`, timeEn, cw, 1, cx, p.muted), BASE_GAPS.afterTime);
    else push(textBlock(`${CARD_PHRASES.en.at} ${content.time.en}`, timeEn, cw, 1, cx, p.muted), BASE_GAPS.afterTime);

    // Venue
    const venueEn: TextStyle = { family: latinDisplay === "Pinyon Script" ? latinBody : latinBody, weight: 600, size: 33 * k };
    const venueAr: TextStyle = { family: arBody, weight: 700, size: 36 * k };
    const addrEn: TextStyle = { family: latinBody, weight: 400, size: 25 * k };
    const addrAr: TextStyle = { family: arBody, weight: 400, size: 28 * k };
    if (lines.venue) {
      if ((isAr || bi) && venueArText) push(textBlock(venueArText, venueAr, cw, 2, cx, p.text), bi && venueEnText ? 4 : BASE_GAPS.afterVenue);
      if (!isAr && venueEnText) push(textBlock(venueEnText, venueEn, cw, 2, cx, p.text), BASE_GAPS.afterVenue);
    }
    if (addrText) push(textBlock(addrText, isAr ? addrAr : addrEn, cw * 0.92, 2, cx, p.muted), 0);

    // Your own extra lines (custom events), Arabic first on bilingual cards like the rest.
    const extraStyleEn: TextStyle = { family: latinBody, weight: 400, italic: bodyItalic, size: 26 * k };
    const extraStyleAr: TextStyle = { family: arBody, weight: 400, size: 29 * k };
    const extras = [...(isAr || bi ? (extraAr.length ? extraAr : isAr ? extraEn : []) : []), ...(!isAr ? extraEn : [])];
    if (extras.length && blocks.length) gaps[gaps.length - 1] = Math.max(gaps[gaps.length - 1], 22 * k);
    for (const line of extras) push(textBlock(line, isArabic(line) ? extraStyleAr : extraStyleEn, cw * 0.92, 2, cx, p.text, 1.3, 0.85), 8);
    if (gaps.length) gaps[gaps.length - 1] = 0;
    return { blocks, gaps };
  };

  // Shrink everything until the stack fits the content box.
  const available = cbottom - ctop;
  let k = 1;
  let nk = 1;
  let layout = build(k, nk);
  const total = (l: typeof layout) => l.blocks.reduce((s, b) => s + b.height, 0) + l.gaps.reduce((s, g) => s + g, 0);
  // Names give way first (down to 72%), then everything shrinks together.
  for (let i = 0; i < 24 && total(layout) > available; i++) {
    if (nk > 0.72) nk *= 0.95;
    else k *= 0.95;
    layout = build(k, nk);
  }
  // Spread leftover space: grow gaps up to 1.8×, then centre vertically.
  let extra = available - total(layout);
  const gapSum = layout.gaps.reduce((s, g) => s + g, 0);
  const growth = gapSum > 0 ? Math.min(0.8, Math.max(0, extra) / gapSum) : 0;
  const gaps = layout.gaps.map((g) => g * (1 + growth));
  extra = available - layout.blocks.reduce((s, b) => s + b.height, 0) - gaps.reduce((s, g) => s + g, 0);
  let y = ctop + Math.max(0, extra) * 0.45;
  let body = "";
  layout.blocks.forEach((b, i) => {
    body += b.render(y);
    y += b.height + gaps[i];
  });

  // ── Footer: guest line + QR + caption + branding ───────────────────────────
  let footer = "";
  const num = (n: number) =>
    footerLang === "ar" ? new Intl.NumberFormat(`ar-u-nu-${design.digits}`).format(n) : String(n);
  const guestText = guest
    ? fmt(phrases.dear, { name: guest.name }) +
      (guest.allowedCount > 1 ? `  ·  ${fmt(phrases.admits, { n: num(guest.allowedCount) })}` : "")
    : "";
  const capStyle: TextStyle =
    footerLang === "ar"
      ? { family: arBody, weight: 400, size: 25 }
      : { family: latinBody, weight: 500, size: 19, uppercase: true, letterSpacing: 0.22 };
  const guestStyle: TextStyle =
    footerLang === "ar" ? { family: arBody, weight: 700, size: 30 } : { family: latinBody, weight: 500, size: 26, letterSpacing: 0.02 };
  const qrColors = { fg: p.text, bg: p.surface };
  const qr = (x: number, yy: number) =>
    qrText ? qrSvgGroup({ text: qrText, size: qrSize, style: design.card.qr.style, fg: qrColors.fg, bg: qrColors.bg, logo: design.card.qr.showLogo }, x, yy) : "";
  const plate = (x: number, yy: number) =>
    `<rect x="${x - 12}" y="${yy - 12}" width="${qrSize + 24}" height="${qrSize + 24}" rx="22" fill="none" stroke="${p.accent}" stroke-width="1.4" opacity="0.7"/>`;

  if (centered || !hasQr) {
    let fy = footerTop;
    if (showGuest) {
      const fitted = fit(guestText, guestStyle, cw + 80, { maxLines: 1 });
      footer += textEl(fitted.lines[0] ?? guestText, W / 2, fy + fitted.style.size, fitted.style, p.text);
      fy += 52;
    }
    if (hasQr) {
      const qx = (W - qrSize) / 2;
      footer += plate(qx, fy + 4) + qr(qx, fy + 4);
      const cap = fit(scanText, capStyle, cw + 80, { maxLines: 1 });
      footer += textEl(cap.lines[0] ?? scanText, W / 2, fy + qrSize + 48, cap.style, p.muted);
    }
  } else {
    // QR to one side, guest details beside it. "start" follows reading direction.
    const rtl = footerLang === "ar";
    const qrOnLeft = (design.card.qr.position === "bottom-start") !== rtl;
    const side = Math.max(orn.sidePad, 110);
    const qx = qrOnLeft ? side : W - side - qrSize;
    const qy = footerTop;
    footer += plate(qx, qy) + qr(qx, qy);
    const tx = qrOnLeft ? qx + qrSize + 44 : qx - 44;
    const anchor = qrOnLeft ? "start" : "end";
    const colW = W - side - qrSize - 44 - side;
    let ty = qy + qrSize / 2 - (showGuest ? 34 : 0);
    if (showGuest && guest) {
      const nameStyle = fit(fmt(phrases.dear, { name: guest.name }), guestStyle, colW, { maxLines: 1 }).style;
      footer += textEl(fmt(phrases.dear, { name: guest.name }), tx, ty, nameStyle, p.text, anchor);
      ty += 40;
      footer += textEl(
        guest.allowedCount > 1 ? fmt(phrases.admits, { n: num(guest.allowedCount) }) : phrases.admitsOne,
        tx,
        ty,
        { ...guestStyle, weight: 400, size: guestStyle.size * 0.85 },
        p.muted,
        anchor,
      );
      ty += 44;
    }
    footer += textEl(scanText, tx, ty, fit(scanText, capStyle, colW, { maxLines: 1 }).style, p.accent, anchor);
  }

  if (design.card.showBranding) {
    footer += textEl("INVTRA", W / 2, H - bottomPad + 8, { family: "Jost", weight: 500, size: 15, letterSpacing: 0.5 }, p.muted, "middle", 0.7);
  }

  // ── Background ─────────────────────────────────────────────────────────────
  let bg = `<rect width="${W}" height="${H}" fill="${p.background}"/>`;
  if (design.background.mode === "image" && input.backgroundImage) {
    bg +=
      `<image href="${escapeXml(input.backgroundImage.href)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` +
      `<rect width="${W}" height="${H}" fill="${p.background}" fill-opacity="${design.background.overlay}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    bg +
    orn.background +
    orn.foreground +
    body +
    footer +
    `</svg>`
  );
}

/**
 * Customer-supplied invitation image with the guest's QR composited on top at the
 * chosen position. Output keeps the image's aspect ratio (long edge ≤ 1600px).
 */
export function buildCustomCardSvg(input: {
  image: CardImage;
  design: InvitationDesign;
  qrText?: string | null;
  qrPlaceholder?: boolean;
  caption?: string;
}): { svg: string; width: number; height: number } {
  const scale = Math.min(1, 1600 / Math.max(input.image.width, input.image.height));
  const W = Math.round(input.image.width * scale);
  const H = Math.round(input.image.height * scale);
  const { x, y, size } = input.design.customQr;
  const q = Math.round(W * size);
  const pad = Math.round(q * 0.08);
  const capH = input.caption && effectiveQrText(input.design, input.qrText, input.qrPlaceholder) ? Math.round(q * 0.16) : 0;
  const plateW = q + pad * 2;
  const plateH = q + pad * 2 + capH;
  const px = Math.min(Math.max(0, x * W - plateW / 2), W - plateW);
  const py = Math.min(Math.max(0, y * H - plateH / 2), H - plateH);
  const text = effectiveQrText(input.design, input.qrText, input.qrPlaceholder);
  let overlay = "";
  if (text) {
    overlay =
      `<rect x="${px}" y="${py}" width="${plateW}" height="${plateH}" rx="${Math.round(q * 0.09)}" fill="#FFFFFF" fill-opacity="0.96"/>` +
      qrSvgGroup({ text, size: q, style: input.design.card.qr.style, fg: "#141210", bg: "#FFFFFF", logo: input.design.card.qr.showLogo, quietZone: 2 }, px + pad, py + pad);
    const caption = input.caption ? input.design.card.qr.caption || input.caption : "";
    if (caption) {
      const st: TextStyle = isArabic(caption)
        ? { family: "IBM Plex Sans Arabic", weight: 500, size: capH * 0.62 }
        : { family: "Jost", weight: 500, size: capH * 0.5, uppercase: true, letterSpacing: 0.12 };
      const fitted = fit(caption, st, q, { maxLines: 1 });
      overlay += textEl(fitted.lines[0] ?? caption, px + plateW / 2, py + pad + q + capH * 0.62, fitted.style, "#3A332C");
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<image href="${escapeXml(input.image.href)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>` +
    overlay +
    `</svg>`;
  return { svg, width: W, height: H };
}

/** Exposed for tests: the text measurement used by the layout engine. */
export const __measure = measure;
