/**
 * Marketing pages: the quiz's plan rule, sample-card addresses, deep links into the wizard, and copy
 * that stays true when hosts send from their own WhatsApp (no promises of INVTRA's WhatsApp
 * Business number, Accept buttons in the chat or free test sends).
 */
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { ownWhatsAppCopy } from "@/lib/i18n/sending-mode";
import { THEME_KEYS } from "@/lib/themes/types";
import { ACTIVE_THEME_LIST, OCCASION_DESIGN, RETIRED_THEME_KEYS, THEME_LIST, getTheme, isRetired } from "@/lib/themes/registry";
import { OCCASION_PAGES, INVITATIONS_HUB } from "@/lib/seo/occasion-pages";
import { hubCopy, occasionCopy } from "@/lib/seo/occasion-sending";
import { OCCASION_WORDING } from "@/lib/seo/occasion-wording";
import { SHOWCASE_LIST, THEME_STYLE, homepageDesigns, quizDesigns } from "@/lib/marketing/design-styles";
import { matchDesigns, planFor, type QuizDesign } from "@/lib/marketing/quiz";
import { SAMPLE_LANGS, parseSampleFile, sampleFileName, sampleSrc } from "@/lib/marketing/samples";
import { startHref } from "@/lib/marketing/links";
import { STUDIO_DESIGN, withDigits } from "@/lib/marketing/demo-copy";
import { sampleCardWebp } from "@/server/seo/sample-card";

/** Claims that only hold with INVTRA's own WhatsApp Business number. */
const CLOUD_CLAIMS = [
  /WhatsApp Business Platform/i,
  /Business account/i,
  /(tap|reply|replies|respond)[^.]*\bin WhatsApp\b/i,
  /test sends?/i,
  /منصة واتساب للأعمال/,
  /واتساب للأعمال/,
  /في واتساب(?! والمتصفح)/,
  /عبر واتساب،/,
  /رسائل تجريبية/,
];

describe("quiz plan rule", () => {
  it("follows guests first: 100 Standard, 500 Premium, more Custom", () => {
    expect(planFor(50, { premium: false })).toEqual({ tier: "BASIC", reason: "basic" });
    expect(planFor(100, { premium: false }).tier).toBe("BASIC");
    expect(planFor(101, { premium: false })).toEqual({ tier: "PREMIUM", reason: "premiumGuests" });
    expect(planFor(500, { premium: true }).tier).toBe("PREMIUM");
    expect(planFor(501, { premium: false })).toEqual({ tier: "CUSTOM", reason: "custom" });
  });

  it("needs Premium for a Premium design even with a small list", () => {
    expect(planFor(40, { premium: true })).toEqual({ tier: "PREMIUM", reason: "premiumDesign" });
  });

  it("recommends designs made for the occasion", () => {
    const designs: QuizDesign[] = THEME_LIST.map((t) => ({ key: t.key, name: t.key, premium: t.premium, occasions: t.occasions, style: THEME_STYLE[t.key], language: t.recommendedLanguage }));
    const picks = matchDesigns(designs, { occasion: "NEWBORN", guests: 50, language: "AR", style: "playful" });
    expect(picks).toHaveLength(3);
    for (const p of picks) expect(p.occasions).toContain("NEWBORN");
    expect(matchDesigns(designs, { occasion: "RAMADAN", guests: 50, language: "AR", style: "heritage" })[0].key).toBe("lantern");
  });

  it("gives every design a style", () => {
    for (const k of THEME_KEYS) expect(THEME_STYLE[k]).toBeTruthy();
  });
});

describe("sample cards", () => {
  it("round-trips file names and rejects anything else", () => {
    for (const theme of THEME_KEYS) for (const lang of SAMPLE_LANGS) expect(parseSampleFile(sampleFileName(theme, lang))).toEqual({ theme, lang, occasion: null });
    expect(parseSampleFile("royal-ar-baby-shower.webp")).toEqual({ theme: "royal", lang: "ar", occasion: "BABY_SHOWER" });
    expect(parseSampleFile("nope-en.webp")).toBeNull();
    expect(parseSampleFile("royal-fr.webp")).toBeNull();
    expect(parseSampleFile("royal-en-party.webp")).toBeNull();
    expect(parseSampleFile("../royal-en.webp")).toBeNull();
    expect(sampleSrc("teddy", "bi", "NEWBORN")).toMatch(/^\/samples\/teddy-bi-newborn\.webp\?v=\d+$/);
  });

  it("renders a real design as WebP", async () => {
    const webp = await sampleCardWebp("royal", "ar", "WEDDING");
    expect(webp.subarray(0, 4).toString()).toBe("RIFF");
    expect(webp.subarray(8, 12).toString()).toBe("WEBP");
    expect(webp.length).toBeLessThan(80_000);
  });
});

describe("links into the wizard", () => {
  it("preselects the design and occasion, through sign-up when signed out", () => {
    expect(startHref(true, { theme: "royal", occasion: "WEDDING" })).toBe("/dashboard/events/new?theme=royal&occasion=WEDDING&product=INVITATION");
    const out = startHref(false, { theme: "teddy", occasion: "NEWBORN" });
    expect(out.startsWith("/signup?next=")).toBe(true);
    expect(decodeURIComponent(out.slice("/signup?next=".length))).toBe("/dashboard/events/new?theme=teddy&occasion=NEWBORN&product=INVITATION");
    expect(startHref(true)).toBe("/dashboard/events/new");
  });
});

describe("numerals", () => {
  it("switches between Arabic-Indic and Latin digits", () => {
    expect(withDigits("12 December 2026", "arab")).toBe("١٢ December ٢٠٢٦");
    expect(withDigits("السبت ١٢ ديسمبر ٢٠٢٦", "latn")).toBe("السبت 12 ديسمبر 2026");
  });
});

describe("copy when hosts send from their own WhatsApp", () => {
  it("rewrites every occasion-page sentence that assumes INVTRA's WhatsApp number", () => {
    for (const page of OCCASION_PAGES) {
      for (const locale of ["en", "ar"] as const) {
        const c = occasionCopy(page, locale, "own");
        const text = [c.intro, ...c.points.map((p) => p.body), ...c.faq.map((f) => f.a)].join("\n");
        for (const claim of CLOUD_CLAIMS) expect(text, `${page.slug}/${locale}: ${claim}`).not.toMatch(claim);
        // …and leaves the INVTRA-number version untouched.
        expect(occasionCopy(page, locale, "cloud")).toBe(page[locale]);
      }
    }
  });

  it("rewrites the occasions hub", () => {
    for (const locale of ["en", "ar"] as const) {
      const text = hubCopy(locale, "own")
        .reasons.map((r) => r.body)
        .join("\n");
      for (const claim of CLOUD_CLAIMS) expect(text, `${locale}: ${claim}`).not.toMatch(claim);
      expect(hubCopy(locale, "cloud")).toBe(INVITATIONS_HUB[locale]);
    }
  });

  it("offers a free preview instead of free test sends", () => {
    for (const locale of ["en", "ar"] as const) {
      const m = ownWhatsAppCopy(getDictionary(locale), locale).marketing;
      const text = [m.cta.body, m.pricing.testSends, m.how.steps[3].body, ...m.faq.items.map((f) => f.a), ...m.legal.terms.sections.flatMap((s) => s.body)].join("\n");
      expect(text).not.toMatch(/test sends?|رسائل تجريبية/i);
    }
  });

  it("has wording ideas for every occasion page in both languages", () => {
    for (const page of OCCASION_PAGES) {
      expect(OCCASION_WORDING[page.slug]?.en.length, page.slug).toBeGreaterThanOrEqual(3);
      expect(OCCASION_WORDING[page.slug]?.ar.length, page.slug).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("retired designs", () => {
  const retired = new Set<string>(RETIRED_THEME_KEYS);

  it("are the flat designs without artwork, and every other design is painted", () => {
    for (const t of THEME_LIST) expect(retired.has(t.key), t.key).toBe(!t.card.art);
    expect(ACTIVE_THEME_LIST.length).toBe(THEME_LIST.length - RETIRED_THEME_KEYS.length);
  });

  it("are never listed: catalogue, homepage, quiz, occasion pages, share images, the hero and the footer", () => {
    for (const t of [...SHOWCASE_LIST, ...homepageDesigns(), ...quizDesigns()]) expect(retired.has(t.key), t.key).toBe(false);
    for (const p of OCCASION_PAGES) expect(retired.has(p.theme), p.slug).toBe(false);
    for (const k of Object.values(STUDIO_DESIGN)) expect(retired.has(k), k).toBe(false);
  });

  it("are never given to a new event; each occasion starts on a painted design made for it", () => {
    for (const [occasion, key] of Object.entries(OCCASION_DESIGN)) {
      expect(retired.has(key), occasion).toBe(false);
      expect(getTheme(key).key, occasion).toBe(key);
      expect(getTheme(key).occasions, occasion).toContain(occasion);
    }
    expect(retired.has(getTheme("not-a-design").key)).toBe(false);
  });

  it("still render, for invitations already made with them", () => {
    expect(getTheme("royal").key).toBe("royal");
    expect(isRetired("royal")).toBe(true);
    expect(isRetired("peony")).toBe(false);
  });
});
