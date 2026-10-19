import { z } from "zod";
import type { DesignSource, Event, PlanTier, Product } from "@prisma/client";
import { getSetting, setSetting } from "@/server/settings";
import { badRequest } from "@/server/http";
import { env } from "@/server/env";
import { PLANS, type Currency } from "@/lib/plans";
import { getTheme } from "@/lib/themes/registry";
import { readFeatures, type PackageTier } from "@/lib/products";

/**
 * Prices for what the wizard sells. Digital invitations use the plan prices (Standard / Premium);
 * the custom design, its guest allowance and Photo only are set by staff in Admin → Payments.
 * Amounts are minor units of the site's currency.
 */

const KEY = "products.prices";

const money = z.coerce.number().int().min(0).max(100_000_000);

export const productPricesSchema = z.object({
  /** Custom event design: one-off design by INVTRA's designers plus the digital invitation. */
  customDesign: money,
  /** Guests the custom event design covers. */
  customDesignGuests: z.coerce.number().int().min(1).max(100_000),
  /** Photo only: the finished invitation image from one of INVTRA's designs. */
  photoOnly: money,
  /** Added when the customer asks INVTRA to design it (digital invitation or photo only). */
  designRequest: money,
});

export type ProductPrices = z.infer<typeof productPricesSchema>;

/** Until changed in Admin → Payments (SAR: 999, 149 and 300 riyals). */
const DEFAULTS: Record<Currency, Omit<ProductPrices, "customDesignGuests">> = {
  SAR: { customDesign: 99900, photoOnly: 14900, designRequest: 30000 },
  USD: { customDesign: 26900, photoOnly: 3900, designRequest: 7900 },
  AED: { customDesign: 97900, photoOnly: 14500, designRequest: 29500 },
  QAR: { customDesign: 97900, photoOnly: 14500, designRequest: 29500 },
  KWD: { customDesign: 82000, photoOnly: 12000, designRequest: 25000 },
  BHD: { customDesign: 100000, photoOnly: 15000, designRequest: 30000 },
  OMR: { customDesign: 103000, photoOnly: 15000, designRequest: 31000 },
};

export function defaultProductPrices(currency: Currency): ProductPrices {
  return { ...DEFAULTS[currency], customDesignGuests: 500 };
}

export async function productPrices(): Promise<ProductPrices> {
  const currency = env().PAYMENT_CURRENCY;
  const raw = await getSetting(KEY);
  if (raw) {
    try {
      const stored = JSON.parse(raw) as { currency?: string };
      const parsed = productPricesSchema.safeParse(stored);
      if (parsed.success && stored.currency === currency) return parsed.data;
    } catch {
      /* fall back to the defaults */
    }
  }
  return defaultProductPrices(currency);
}

export async function saveProductPrices(input: unknown): Promise<ProductPrices> {
  const parsed = productPricesSchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), "Enter an amount"]));
    throw badRequest("invalid_prices", "Check the prices.", fields);
  }
  await setSetting(KEY, JSON.stringify({ ...parsed.data, currency: env().PAYMENT_CURRENCY }));
  return parsed.data;
}

// ── Quotes ──────────────────────────────────────────────────────────────────

export type LineKey = "plan_basic" | "plan_premium" | "custom_design" | "photo_only" | "design_request" | "discount";
export type OrderLine = { key: LineKey; amount: number };

export interface Quote {
  product: Product;
  designSource: DesignSource;
  /** The plan the order gives the event (null for Photo only). */
  plan: PlanTier | null;
  guestLimit: number;
  lines: OrderLine[];
  /** Before any discount code. */
  subtotal: number;
  currency: Currency;
}

/** The package tier a digital invitation needs: Premium when the chosen design is a premium one. */
export function requiredTier(event: Pick<Event, "themeKey" | "designSource">, chosen: PackageTier): PackageTier {
  return event.designSource === "TEMPLATE" && getTheme(event.themeKey).premium ? "PREMIUM" : chosen;
}

/** What the event's order costs, from its product, design and features. */
export async function quoteFor(event: Pick<Event, "product" | "designSource" | "themeKey" | "features">): Promise<Quote> {
  const currency = env().PAYMENT_CURRENCY;
  const prices = await productPrices();
  const lines: OrderLine[] = [];
  let plan: PlanTier | null = null;
  let guestLimit = 0;

  switch (event.product) {
    case "INVITATION": {
      const tier = requiredTier(event, readFeatures(event.features).tier);
      plan = tier;
      guestLimit = PLANS[tier].guestLimit ?? 0;
      lines.push({ key: tier === "PREMIUM" ? "plan_premium" : "plan_basic", amount: PLANS[tier].prices?.[currency] ?? 0 });
      if (event.designSource === "REQUEST") lines.push({ key: "design_request", amount: prices.designRequest });
      break;
    }
    case "CUSTOM_DESIGN":
      plan = "CUSTOM";
      guestLimit = prices.customDesignGuests;
      lines.push({ key: "custom_design", amount: prices.customDesign });
      break;
    case "PHOTO_ONLY":
      lines.push({ key: "photo_only", amount: prices.photoOnly });
      if (event.designSource === "REQUEST") lines.push({ key: "design_request", amount: prices.designRequest });
      break;
  }
  const designSource = event.product === "CUSTOM_DESIGN" ? "REQUEST" : event.designSource;
  return { product: event.product, designSource, plan, guestLimit, lines, subtotal: lines.reduce((s, l) => s + l.amount, 0), currency };
}

/** "From …" prices for the product cards (step 1). */
export async function startingPrices(): Promise<{ currency: Currency; prices: Record<Product, number> }> {
  const currency = env().PAYMENT_CURRENCY;
  const p = await productPrices();
  return { currency, prices: { INVITATION: PLANS.BASIC.prices?.[currency] ?? 0, CUSTOM_DESIGN: p.customDesign, PHOTO_ONLY: p.photoOnly } };
}
