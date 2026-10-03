import { describe, expect, it } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import { generateInvitationToken, isWellFormedInvitationToken, INVITATION_TOKEN_LENGTH } from "@/server/security/tokens";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { normalizePhone, toWhatsAppId } from "@/lib/phone";
import { signWebhookBody, verifyWebhookSignature } from "@/server/whatsapp/signature";
import { deriveGuestStatus, isDeliveryProgress } from "@/server/guests/status";
import { buttonPayload, parseButtonPayload, renderTemplateBody, sanitizeParam } from "@/lib/whatsapp/templates";
import { failureReason, isRetryable, WhatsAppApiError } from "@/server/whatsapp/errors";
import { contrastRatio, qrSvg, qrTargetUrl, safeQrColors } from "@/lib/qr";
import { buildCardSvg, buildCustomCardSvg } from "@/lib/card/build";
import { THEME_LIST } from "@/lib/themes/registry";
import { SAMPLE_CARD_CONTENT, themeSampleContent } from "@/lib/card/sample";
import { normalizeDesign } from "@/lib/design/schema";
import { renderSvgToPng } from "@/server/render/card";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import { upgradePrice } from "@/lib/plans";

async function decodeQr(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

describe("invitation tokens", () => {
  it("are well-formed, unambiguous and unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const t = generateInvitationToken();
      expect(t).toHaveLength(INVITATION_TOKEN_LENGTH);
      expect(isWellFormedInvitationToken(t)).toBe(true);
      expect(t).not.toMatch(/[01OIL]/);
      seen.add(t);
    }
    expect(seen.size).toBe(5000);
  });
  it("rejects malformed tokens without touching the database", () => {
    expect(isWellFormedInvitationToken("abc")).toBe(false);
    expect(isWellFormedInvitationToken("8f3k92qxht")).toBe(false);
    expect(isWellFormedInvitationToken("8F3K92QXH0")).toBe(false);
  });
});

describe("passwords", () => {
  it("hash with scrypt and verify", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("phone numbers", () => {
  it("normalises international and national formats to E.164", () => {
    expect(normalizePhone("+971 50 123 4567")).toMatchObject({ ok: true, e164: "+971501234567" });
    expect(normalizePhone("00971501234567")).toMatchObject({ ok: true, e164: "+971501234567" });
    expect(normalizePhone("050 123 4567", "AE")).toMatchObject({ ok: true, e164: "+971501234567" });
    expect(normalizePhone("0551234567", "SA")).toMatchObject({ ok: true, e164: "+966551234567" });
  });
  it("rejects invalid numbers", () => {
    expect(normalizePhone("")).toEqual({ ok: false, reason: "empty" });
    expect(normalizePhone("12345")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizePhone("+971 12")).toEqual({ ok: false, reason: "invalid" });
  });
  it("formats WhatsApp ids without +", () => {
    expect(toWhatsAppId("+971501234567")).toBe("971501234567");
  });
});

describe("webhook signatures", () => {
  const secret = "app-secret";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  it("accepts a valid signature", () => {
    expect(verifyWebhookSignature(body, signWebhookBody(body, secret), secret)).toBe(true);
  });
  it("rejects tampered bodies, wrong secrets and missing headers", () => {
    const sig = signWebhookBody(body, secret);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "other")).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, "sha256=abc", secret)).toBe(false);
  });
});

describe("guest status derivation", () => {
  const base = { rsvpStatus: "PENDING", deliveryStatus: "NOT_SENT", invitationSentAt: null, viewCount: 0, scanCount: 0 } as const;
  it("follows the dashboard status ladder", () => {
    expect(deriveGuestStatus(base)).toBe("PENDING");
    expect(deriveGuestStatus({ ...base, deliveryStatus: "QUEUED" })).toBe("PENDING");
    expect(deriveGuestStatus({ ...base, deliveryStatus: "DELIVERED" })).toBe("MESSAGE_SENT");
    expect(deriveGuestStatus({ ...base, deliveryStatus: "FAILED" })).toBe("FAILED");
    expect(deriveGuestStatus({ ...base, rsvpStatus: "ACCEPTED", deliveryStatus: "READ" })).toBe("ACCEPTED");
    expect(deriveGuestStatus({ ...base, rsvpStatus: "ACCEPTED", invitationSentAt: new Date() })).toBe("INVITATION_SENT");
    expect(deriveGuestStatus({ ...base, rsvpStatus: "ACCEPTED", invitationSentAt: new Date(), viewCount: 2 })).toBe("VIEWED");
    expect(deriveGuestStatus({ ...base, rsvpStatus: "ACCEPTED", viewCount: 2, scanCount: 1 })).toBe("QR_SCANNED");
    expect(deriveGuestStatus({ ...base, rsvpStatus: "DECLINED", scanCount: 3 })).toBe("DECLINED");
  });
  it("only moves delivery status forward (out-of-order webhooks)", () => {
    expect(isDeliveryProgress("SENT", "DELIVERED")).toBe(true);
    expect(isDeliveryProgress("READ", "DELIVERED")).toBe(false);
    expect(isDeliveryProgress("READ", "FAILED")).toBe(false);
    expect(isDeliveryProgress("SENT", "FAILED")).toBe(true);
    expect(isDeliveryProgress("FAILED", "SENT")).toBe(false);
  });
});

describe("message templates", () => {
  it("round-trips quick-reply payloads", () => {
    expect(parseButtonPayload(buttonPayload("ACCEPT", "8F3K92QXHT"))).toEqual({ action: "ACCEPT", token: "8F3K92QXHT" });
    expect(parseButtonPayload("INVTRA|MAYBE|8F3K92QXHT")).toBeNull();
    expect(parseButtonPayload("hello")).toBeNull();
    expect(parseButtonPayload(undefined)).toBeNull();
  });
  it("renders numbered placeholders and sanitises values for WhatsApp", () => {
    const body = renderTemplateBody(
      { body: "Dear {{1}}, join {{2}} on {{3}}.", variables: ["guest_name", "host_names", "event_date"] },
      { guest_name: "Khalid\n\nAl   Hashimi", host_names: "Ahmed & Sara", event_date: "Saturday" },
    );
    expect(body).toBe("Dear Khalid Al Hashimi, join Ahmed & Sara on Saturday.");
    expect(sanitizeParam("a\tb     c")).toBe("a b c");
    expect(sanitizeParam("")).toBe("—");
  });
  it("classifies Cloud API errors", () => {
    expect(failureReason(131026)).toBe("not_on_whatsapp");
    expect(failureReason(131047)).toBe("window_closed");
    expect(isRetryable(130429, 400)).toBe(true);
    expect(isRetryable(131026, 400)).toBe(false);
    expect(isRetryable(null, 503)).toBe(true);
    expect(new WhatsAppApiError("x", 132001, 400).systemic).toBe(true);
  });
});

describe("QR codes", () => {
  it("encodes the scan URL in upper case (alphanumeric mode)", () => {
    expect(qrTargetUrl("https://invtra.store/", "8F3K92QXHT")).toBe("HTTPS://INVTRA.STORE/Q/8F3K92QXHT");
  });
  it("always picks dark-on-light, high-contrast colours", () => {
    const c = safeQrColors("#F3EDE2", "#0E0D0C");
    expect(contrastRatio(c.fg, c.bg)).toBeGreaterThanOrEqual(7);
    const d = safeQrColors("#C9A66B", "#FFFFFF");
    expect(contrastRatio(d.fg, d.bg)).toBeGreaterThanOrEqual(7);
  });
  it.each(["rounded", "dots", "classic"] as const)("%s style with centre logo still scans", async (style) => {
    const text = "HTTPS://INVTRA.STORE/Q/8F3K92QXHT";
    const png = renderSvgToPng(qrSvg({ text, size: 360, style, logo: true, fg: "#2B2118", bg: "#FFFBF4" }));
    expect(await decodeQr(png)).toBe(text);
  });
});

describe("invitation cards", () => {
  const qrText = "HTTPS://INVTRA.STORE/Q/8F3K92QXHT";
  it.each(THEME_LIST.flatMap((t) => (["EN", "AR", "BILINGUAL"] as const).map((l) => [t.key, l] as const)))(
    "%s / %s renders and its QR scans",
    async (key, language) => {
      const theme = THEME_LIST.find((t) => t.key === key)!;
      const svg = buildCardSvg({ theme, design: theme.defaults, language, content: themeSampleContent(theme.key), guest: { name: "Khalid", allowedCount: 2 }, qrText });
      expect(svg.startsWith("<svg")).toBe(true);
      const png = renderSvgToPng(svg, 720);
      expect(await decodeQr(png)).toBe(qrText);
    },
  );
  it("escapes customer text (no markup injection)", () => {
    const theme = THEME_LIST[0];
    const svg = buildCardSvg({
      theme,
      design: theme.defaults,
      language: "EN",
      content: { ...SAMPLE_CARD_CONTENT, hostNames: `<script>alert(1)</script> & "Sara"` },
      guest: null,
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
  it("overlays a scannable QR on a customer image", async () => {
    const theme = THEME_LIST[0];
    const img = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: "#6b4f3a" } }).jpeg().toBuffer();
    const { svg } = buildCustomCardSvg({
      image: { href: `data:image/jpeg;base64,${img.toString("base64")}`, width: 1200, height: 1600 },
      design: { ...theme.defaults, customQr: { x: 0.5, y: 0.8, size: 0.25 } },
      qrText,
      caption: "Scan for your invitation",
    });
    expect(await decodeQr(renderSvgToPng(svg))).toBe(qrText);
  });
});

describe("design normalisation", () => {
  it("fills missing fields from the theme and drops invalid ones", () => {
    const t = THEME_LIST[1].defaults;
    const d = normalizeDesign(t, { palette: { accent: "#123456" }, animation: "explode", sections: { music: false } });
    expect(d.palette.accent).toBe("#123456");
    expect(d.palette.background).toBe(t.palette.background);
    expect(d.animation).toBe(t.animation);
    expect(d.sections.music).toBe(false);
  });
});

describe("time zones", () => {
  it("converts event wall-clock time to UTC and back", () => {
    const utc = zonedToUtc("2026-12-12", "19:30", "Asia/Dubai");
    expect(utc.toISOString()).toBe("2026-12-12T15:30:00.000Z");
    expect(utcToZoned(utc, "Asia/Dubai")).toEqual({ date: "2026-12-12", time: "19:30" });
    const london = zonedToUtc("2026-07-01", "18:00", "Europe/London");
    expect(london.toISOString()).toBe("2026-07-01T17:00:00.000Z");
  });
});

describe("plans", () => {
  it("charges the difference when upgrading", () => {
    expect(upgradePrice(null, "BASIC", "SAR")).toBe(49900);
    expect(upgradePrice("BASIC", "PREMIUM", "SAR")).toBe(69900 - 49900);
    expect(upgradePrice("PREMIUM", "BASIC", "USD")).toBeNull();
    expect(upgradePrice(null, "CUSTOM", "USD")).toBeNull();
  });
});

describe("language-specific marketing URLs", async () => {
  const { isLocalizedPath, localePath, splitLocale } = await import("@/lib/i18n/routing");
  it("prefixes marketing pages with /ar and leaves app pages alone", () => {
    expect(localePath("ar", "/")).toBe("/ar");
    expect(localePath("ar", "/designs?occasion=baby")).toBe("/ar/designs?occasion=baby");
    expect(localePath("ar", "/#faq")).toBe("/ar#faq");
    expect(localePath("ar", "/invitations/newborn")).toBe("/ar/invitations/newborn");
    expect(localePath("ar", "/signup?next=/dashboard")).toBe("/signup?next=/dashboard");
    expect(localePath("ar", "https://example.com/")).toBe("https://example.com/");
    expect(localePath("en", "/designs")).toBe("/designs");
  });
  it("splits and recognises localized paths", () => {
    expect(splitLocale("/ar")).toEqual({ locale: "ar", path: "/" });
    expect(splitLocale("/ar/pricing")).toEqual({ locale: "ar", path: "/pricing" });
    expect(splitLocale("/arabic")).toEqual({ locale: null, path: "/arabic" });
    expect(isLocalizedPath("/designs/teddy")).toBe(true);
    expect(isLocalizedPath("/dashboard")).toBe(false);
    expect(isLocalizedPath("/i/ABC")).toBe(false);
  });
});
