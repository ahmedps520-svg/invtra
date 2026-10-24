import type { EventType } from "@prisma/client";
import { EVENT_TYPES } from "@/lib/events/types";
import { THEME_KEYS, type ThemeKey } from "@/lib/themes/types";

/**
 * Pre-rendered sample invitations for the marketing pages: /samples/<theme>-<lang>[-<occasion>].webp.
 * The same card engine as the real invitations, rasterised once (at build time) instead of
 * shipping 25–120 KB of inline SVG per card. Bump SAMPLE_VERSION when the designs change.
 */
export const SAMPLE_VERSION = "1";

/** Rendered width in pixels (cards are 4:5, so 720 × 900). */
export const SAMPLE_WIDTH = 720;
export const SAMPLE_HEIGHT = 900;

export type SampleLang = "en" | "ar" | "bi";
export const SAMPLE_LANGS: SampleLang[] = ["en", "ar", "bi"];

const OCCASION_SLUGS = Object.fromEntries(EVENT_TYPES.map((t) => [t, t.toLowerCase().replace(/_/g, "-")])) as Record<EventType, string>;

export function sampleLang(language: "EN" | "AR" | "BILINGUAL"): SampleLang {
  return language === "AR" ? "ar" : language === "BILINGUAL" ? "bi" : "en";
}

/** Address of a sample card image. `occasion` swaps the wording for that occasion's sample. */
export function sampleSrc(theme: ThemeKey | string, lang: SampleLang, occasion?: EventType | null): string {
  return `/samples/${theme}-${lang}${occasion ? `-${OCCASION_SLUGS[occasion]}` : ""}.webp?v=${SAMPLE_VERSION}`;
}

export function parseSampleFile(file: string): { theme: ThemeKey; lang: SampleLang; occasion: EventType | null } | null {
  const m = /^([a-z]+)-(en|ar|bi)(?:-([a-z-]+))?\.webp$/.exec(file);
  if (!m || !(THEME_KEYS as readonly string[]).includes(m[1])) return null;
  const occasion = m[3] ? ((Object.keys(OCCASION_SLUGS) as EventType[]).find((t) => OCCASION_SLUGS[t] === m[3]) ?? null) : null;
  if (m[3] && !occasion) return null;
  return { theme: m[1] as ThemeKey, lang: m[2] as SampleLang, occasion };
}

/** A sample guest QR code (ink on paper, INVTRA mark in the middle): /samples/qr-<TOKEN>.svg. */
export const SAMPLE_QR_TOKENS = ["8F3K92QXHT", "N7RW4TKD2M", "Q5HZ8XCB3P"] as const;
export const sampleQrSrc = (token: (typeof SAMPLE_QR_TOKENS)[number] = SAMPLE_QR_TOKENS[0]) => `/samples/qr-${token}.svg?v=${SAMPLE_VERSION}`;

export function sampleFileName(theme: ThemeKey, lang: SampleLang, occasion?: EventType | null): string {
  return `${theme}-${lang}${occasion ? `-${OCCASION_SLUGS[occasion]}` : ""}.webp`;
}
