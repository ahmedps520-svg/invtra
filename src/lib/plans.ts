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
    prices: { USD: 4900, AED: 17900, SAR: 18900, KWD: 15000, QAR: 17900, BHD: 18500, OMR: 19000 },
  },
  PREMIUM: {
    tier: "PREMIUM",
    guestLimit: 500,
    premiumThemes: true,
    contactSales: false,
    prices: { USD: 12900, AED: 47900, SAR: 48900, KWD: 39000, QAR: 47900, BHD: 49000, OMR: 50000 },
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
