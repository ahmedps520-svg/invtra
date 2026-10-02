import { FONT_METRICS, type FontMetrics } from "@/lib/fonts/metrics";
import { nearestWeight } from "@/lib/design/fonts";

/**
 * Deterministic text measurement for SVG layout, shared by the browser preview and
 * the server renderer so both wrap and shrink text identically. Latin widths come
 * from the real font tables; Arabic widths use a calibrated per-font average.
 */

export interface TextStyle {
  family: string;
  weight: number;
  italic?: boolean;
  size: number;
  /** Extra spacing between letters, in em. */
  letterSpacing?: number;
  uppercase?: boolean;
}

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function isArabic(text: string) {
  return ARABIC_RE.test(text);
}

function metricsFor(style: TextStyle): FontMetrics {
  const w = nearestWeight(style.family, style.weight);
  return (
    FONT_METRICS[`${style.family}|${w}|${style.italic ? "italic" : "normal"}`] ??
    FONT_METRICS[`${style.family}|${w}|normal`] ??
    FONT_METRICS["Jost|400|normal"]
  );
}

export function transformText(text: string, style: TextStyle) {
  return style.uppercase && !isArabic(text) ? text.toUpperCase() : text;
}

export function measure(text: string, style: TextStyle): number {
  const m = metricsFor(style);
  const t = transformText(text, style);
  let em = 0;
  let count = 0;
  for (const ch of t) {
    count++;
    const code = ch.codePointAt(0)!;
    if (code >= 32 && code <= 126) em += m.w[code - 32];
    else if (ARABIC_RE.test(ch)) em += m.ar ?? 0.5;
    else if (code >= 0x0660 && code <= 0x0669) em += m.ar ?? 0.5;
    else em += m.avg;
  }
  const spacing = isArabic(t) ? 0 : (style.letterSpacing ?? 0) * Math.max(0, count - 1);
  return (em + spacing) * style.size;
}

export function lineHeight(style: TextStyle, factor = 1.2) {
  return style.size * factor;
}

export function ascent(style: TextStyle) {
  return metricsFor(style).a * style.size;
}

/** Greedy word wrap. Words longer than the line are kept whole (caller shrinks). */
export function wrap(text: string, style: TextStyle, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || measure(candidate, style) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Shrink `style.size` (down to `minSize`) until the text wraps into at most
 * `maxLines` lines that each fit `maxWidth`. Lines are balanced for nicer rags.
 */
export function fit(
  text: string,
  style: TextStyle,
  maxWidth: number,
  opts: { maxLines: number; minSize?: number },
): { lines: string[]; style: TextStyle } {
  const min = opts.minSize ?? style.size * 0.55;
  let s = { ...style };
  for (let i = 0; i < 40; i++) {
    const lines = balance(wrap(text, s, maxWidth), s, maxWidth);
    if (lines.length <= opts.maxLines && lines.every((l) => measure(l, s) <= maxWidth)) return { lines, style: s };
    if (s.size <= min) return { lines: lines.slice(0, opts.maxLines), style: s };
    s = { ...s, size: Math.max(min, s.size * 0.94) };
  }
  return { lines: wrap(text, s, maxWidth).slice(0, opts.maxLines), style: s };
}

/** For 2-line results, move words so both lines are similar in width. */
function balance(lines: string[], style: TextStyle, maxWidth: number): string[] {
  if (lines.length !== 2) return lines;
  const words = lines.join(" ").split(" ");
  let best = lines;
  let bestDiff = Math.abs(measure(lines[0], style) - measure(lines[1], style));
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const wa = measure(a, style);
    const wb = measure(b, style);
    if (wa > maxWidth || wb > maxWidth) continue;
    const diff = Math.abs(wa - wb);
    if (diff < bestDiff) {
      best = [a, b];
      bestDiff = diff;
    }
  }
  return best;
}

export function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
