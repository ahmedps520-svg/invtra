import type { PlanTier } from "@prisma/client";

/** Plan catalogue. Prices are in minor units per currency (KWD/BHD/OMR use 3 decimals). */

export type Currency = "USD" | "AED" | "SAR" | "KWD" | "QAR" | "BHD" | "OMR";

export interface PlanDefinition {
  tier: PlanTier;
  guestLimit: number | null; // null = set per order (Custom)
  premiumThemes: boolean;
  contactSales: boolean;
  prices: Record<Currency, number> | null;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  BASIC: {
    tier: "BASIC",
    guestLimit: 100,
    premiumThemes: false,
    contactSales: false,
    // 499 SAR (the site's currency); other currencies are rounded equivalents.
    prices: { SAR: 49900, USD: 13500, AED: 48900, QAR: 48900, KWD: 41000, BHD: 50000, OMR: 51000 },
  },
  PREMIUM: {
    tier: "PREMIUM",
    guestLimit: 500,
    premiumThemes: true,
    contactSales: false,
    // 699 SAR.
    prices: { SAR: 69900, USD: 18900, AED: 68900, QAR: 68900, KWD: 57000, BHD: 70000, OMR: 72000 },
  },
  CUSTOM: {
    tier: "CUSTOM",
    guestLimit: null,
    premiumThemes: true,
    contactSales: true,
    prices: null,
  },
};

export const PLAN_ORDER: PlanTier[] = ["BASIC", "PREMIUM", "CUSTOM"];

/** Free test sends per event (to the host's own number) before buying a plan. */
export const TEST_SEND_LIMIT = 3;

/** Hard cap on guests per event regardless of plan (Custom orders can raise it). */
export const MAX_GUESTS_PER_EVENT = 5000;

export function planPrice(tier: PlanTier, currency: Currency): number | null {
  return PLANS[tier].prices?.[currency] ?? null;
}

/**
 * Price to move an event from its current plan to `target`. Upgrading from Basic to
 * Premium charges the difference.
 */
export function upgradePrice(current: PlanTier | null, target: PlanTier, currency: Currency): number | null {
  const t = planPrice(target, currency);
  if (t === null) return null;
  if (!current) return t;
  if (PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(target)) return null;
  const c = planPrice(current, currency) ?? 0;
  return Math.max(0, t - c);
}

export function planAllowsTheme(tier: PlanTier | null, themePremium: boolean): boolean {
  if (!themePremium) return true;
  return tier ? PLANS[tier].premiumThemes : false;
}
