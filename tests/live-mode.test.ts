import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";
import { OffWhatsAppProvider } from "@/server/whatsapp/off";
import { PermanentJobError } from "@/server/queue/queue";
import { bankSchema, DEFAULT_BANK, formatIban, orderReference, transferText, validIban } from "@/server/payments/bank";
import { paymentRequestWhatsAppUrl } from "@/server/custom/service";

const base = { DATABASE_URL: "postgresql://x@localhost/x", APP_URL: "https://invtra.store", APP_SECRET: "x".repeat(40) };

describe("no test mode on the live site", () => {
  it("turns simulated WhatsApp and payments into own-WhatsApp sending and bank transfers in production", () => {
    const live = parseEnv({ ...base, NODE_ENV: "production", WHATSAPP_PROVIDER: "mock", PAYMENT_PROVIDER: "mock", ALLOW_MOCK_IN_PRODUCTION: "true" });
    expect(live.WHATSAPP_PROVIDER).toBe("off");
    expect(live.PAYMENT_PROVIDER).toBe("manual");
    // Real providers are untouched; development keeps the simulations, as does LOCAL_TEST_MODE.
    expect(parseEnv({ ...base, NODE_ENV: "production", WHATSAPP_PROVIDER: "off", PAYMENT_PROVIDER: "manual" }).PAYMENT_PROVIDER).toBe("manual");
    expect(parseEnv({ ...base, NODE_ENV: "development", WHATSAPP_PROVIDER: "mock", PAYMENT_PROVIDER: "mock" }).WHATSAPP_PROVIDER).toBe("mock");
    expect(parseEnv({ ...base, NODE_ENV: "production", LOCAL_TEST_MODE: "true", PAYMENT_PROVIDER: "mock" }).PAYMENT_PROVIDER).toBe("mock");
  });

  it("never sends a WhatsApp message while it's off (queued jobs fail at once, without retries)", async () => {
    const off = new OffWhatsAppProvider();
    await expect(off.sendText()).rejects.toBeInstanceOf(PermanentJobError);
    await expect(off.sendTemplate()).rejects.toThrow(/own WhatsApp/);
  });
});

describe("bank transfer", () => {
  it("checks the IBAN and shows the account the way customers copy it", () => {
    expect(validIban(DEFAULT_BANK.iban)).toBe(true);
    expect(formatIban(DEFAULT_BANK.iban)).toBe("SA23 8000 0141 6080 1610 2717");
    expect(bankSchema.safeParse({ ...DEFAULT_BANK, iban: "sa23 8000 0141 6080 1610 2717" }).data?.iban).toBe("SA2380000141608016102717");
    expect(bankSchema.safeParse({ ...DEFAULT_BANK, iban: "SA2380000141608016102718" }).success).toBe(false);
    expect(transferText(DEFAULT_BANK, "en")).toContain("SA23 8000 0141 6080 1610 2717");
    expect(transferText(DEFAULT_BANK, "ar")).toContain("مصرف الراجحي");
    expect(orderReference("cmv2k7qbx000a7dq8z47jkb1t")).toBe("INV-Z47JKB1T");
  });

  it("lets staff send the payment link from their own WhatsApp, in the host's language", () => {
    const url = paymentRequestWhatsAppUrl({
      amount: 180000,
      currency: "SAR",
      payToken: "TOKEN123",
      user: { name: "Mama", phone: "+966501234567", locale: "ar" },
      event: { title: "Birthday", titleAr: "عيد ميلاد" },
    })!;
    expect(url.startsWith("https://wa.me/966501234567?text=")).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("مرحبًا Mama");
    expect(text).toContain("عيد ميلاد");
    expect(text).toContain("/pay/TOKEN123");
    expect(paymentRequestWhatsAppUrl({ amount: 1, currency: "SAR", payToken: "T", user: { name: "x", phone: null, locale: "en" }, event: null })).toBeNull();
  });
});
