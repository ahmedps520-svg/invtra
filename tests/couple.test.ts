/**
 * The couple's names printed side by side around a decorative "و" / "&" (in place of the ornament),
 * the hosts' names stepping down when they appear, and the names-size setting.
 */
import { describe, expect, it } from "vitest";
import { buildCardSvg, type CardContent } from "@/lib/card/build";
import { coupleFor, designSchema, normalizeDesign, type InvitationDesign } from "@/lib/design/schema";
import { getTheme } from "@/lib/themes/registry";
import { renderSvgToPng } from "@/server/render/card";

const theme = getTheme("redoute");
const content: CardContent = {
  eventType: "WEDDING",
  title: "Wedding",
  titleAr: "حفل زفاف",
  hostNames: "Khadija & Fatima",
  hostNamesAr: "خديجه خماش و فاطمه مصنف و احلام باكثير",
  date: { en: "Friday, 8 January 2027", ar: "الجمعة، ٨ يناير ٢٠٢٧" },
  time: { en: "9:00 PM", ar: "٩:٠٠ م" },
  venueName: "Al Raqia Hall 1",
  venueNameAr: "قاعة الراقيه ١",
  address: "",
};
const withCouple = (couple: Partial<InvitationDesign["couple"]>, names: Partial<InvitationDesign["names"]> = {}): InvitationDesign => ({
  ...theme.defaults,
  couple: { ...theme.defaults.couple, ...couple },
  names: { ...theme.defaults.names, ...names },
  card: { ...theme.defaults.card, qr: { ...theme.defaults.card.qr, enabled: false } },
});
const card = (design: InvitationDesign, language: "EN" | "AR" | "BILINGUAL" = "AR") => buildCardSvg({ theme, design, language, content, guest: null });
/** Font size of the first <text> showing this string. */
const sizeOf = (svg: string, text: string) => Number(new RegExp(`font-size="([\\d.]+)"[^>]*>${text}<`).exec(svg)?.[1]);

describe("the couple's names", () => {
  it("are optional: older designs read as empty and keep the ornament", () => {
    const old = { ...theme.defaults } as Record<string, unknown>;
    delete old.couple;
    const d = normalizeDesign(theme.defaults, old);
    expect(d.couple).toEqual({ first: "", second: "", firstAr: "", secondAr: "", joinFont: null, joinFontAr: null });
    expect(d.names.size).toBeNull();
    expect(coupleFor(d, "ar")).toBeNull();
  });

  it("need both names, and fall back to the other language's names", () => {
    expect(coupleFor(withCouple({ firstAr: "عبدالله" }), "ar")).toBeNull();
    expect(coupleFor(withCouple({ firstAr: "عبدالله", secondAr: "نورة" }), "ar")).toEqual(["عبدالله", "نورة"]);
    expect(coupleFor(withCouple({ first: "Abdullah", second: "Noura" }), "ar")).toEqual(["Abdullah", "Noura"]);
  });

  it("are printed around a decorative و with the ornament below, and the hosts' names step down", () => {
    const plain = card(withCouple({}));
    const svg = card(withCouple({ firstAr: "عبدالله", secondAr: "نورة" }));
    expect(svg).toContain(">عبدالله<");
    expect(svg).toContain(">نورة<");
    expect(svg).toMatch(/font-family="'Alkalami'"[^>]*>و</);
    // The ornament is still drawn, after (below) the couple's names.
    const ar = svg.indexOf(">نورة<");
    const divider = svg.indexOf("<g transform=\"translate(", ar);
    expect(ar).toBeGreaterThan(0);
    expect(divider).toBeGreaterThan(ar);
    // The hosts' line is set smaller than on the same card without the couple.
    const host = "احلام باكثير";
    expect(sizeOf(svg, `[^<]*${host}`)).toBeLessThan(sizeOf(plain, `[^<]*${host}`) * 0.75);
  });

  it("put the first name first in reading order: on the right in Arabic, on the left in English", () => {
    const xOf = (svg: string, text: string) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${text}<`).exec(svg)?.[1]);
    const ar = card(withCouple({ firstAr: "عبدالله", secondAr: "نورة" }));
    expect(xOf(ar, "عبدالله")).toBeGreaterThan(xOf(ar, "نورة"));
    const en = card(withCouple({ first: "Abdullah", second: "Noura" }), "EN");
    expect(xOf(en, "Abdullah")).toBeLessThan(xOf(en, "Noura"));
  });

  it("keep the و's tail clear of the ornament below", () => {
    const svg = card(withCouple({ firstAr: "عبدالله", secondAr: "نورة" }));
    const join = /<text x="[\d.]+" y="([\d.]+)" font-family="'Alkalami'" font-size="([\d.]+)"[^>]*>و</.exec(svg);
    expect(join).toBeTruthy();
    const [baseline, size] = [Number(join![1]), Number(join![2])];
    const divider = Number(/<g transform="translate\([\d.]+ ([\d.]+)\)/.exec(svg.slice(join!.index))?.[1]);
    // Alkalami's و drops about 0.43 of its size below the baseline; the divider is about 24 high.
    expect(divider - 12).toBeGreaterThan(baseline + size * 0.43 + 10);
  });

  it("keep each host's name whole when the hosts' names wrap", () => {
    const svg = card(withCouple({ firstAr: "احمد", secondAr: "ابرار" }));
    expect(svg).toContain(">خديجه خماش و فاطمه مصنف<");
    expect(svg).toContain(">و احلام باكثير<");
  });

  it("use the chosen typeface for the و", () => {
    expect(card(withCouple({ firstAr: "عبدالله", secondAr: "نورة", joinFontAr: "ruwudu" }))).toMatch(/font-family="'Ruwudu'"[^>]*>و</);
  });

  it("render on the server (no QR) without errors", () => {
    const png = renderSvgToPng(card(withCouple({ firstAr: "عبدالرحمن بن محمد", secondAr: "نورة بنت سالم" })), 540);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });
});

describe("names size", () => {
  it("scales the names and is kept within bounds", () => {
    const host = "احلام باكثير";
    const full = sizeOf(card(withCouple({})), `[^<]*${host}`);
    const half = sizeOf(card(withCouple({}, { size: 0.5 })), `[^<]*${host}`);
    expect(half).toBeLessThan(full * 0.6);
    expect(designSchema.shape.names.safeParse({ font: null, fontAr: null, color: null, size: 3 }).success).toBe(false);
  });
});
