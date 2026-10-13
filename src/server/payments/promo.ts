import type { PlanTier, PromoCode } from "@prisma/client";
import { db } from "@/server/db";
import { HttpError } from "@/server/http";
import { currencyDigits } from "@/lib/format";

/**
 * Discount codes. Staff create them in Admin → Discount codes (e.g. TIKTOK10, or one per
 * influencer); customers enter one at checkout, or arrive with it in a link (?code=…), and see
 * which orders and sign-ups each code brought in. Codes apply to the self-serve plans, never
 * together with a limited-time offer.
 */

export const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,29}$/;

/** "  tiktok 10 " → "TIKTOK10". */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * What a code takes off a price. Percentages are rounded to whole riyals (or the currency's
 * main unit) so prices stay tidy; nothing goes below zero (a 100% code makes it free).
 */
export function discountFor(code: Pick<PromoCode, "percentOff" | "amountOff" | "currency">, base: number, currency: string): number {
  if (base <= 0) return 0;
  if (code.percentOff) {
    const unit = 10 ** currencyDigits(currency);
    return Math.min(base, Math.round((base * code.percentOff) / 100 / unit) * unit);
  }
  if (code.amountOff && code.currency === currency) return Math.min(base, code.amountOff);
  return 0;
}

const fail = (code: string, message: string, fields?: Record<string, string>) => new HttpError(400, code, message, fields);

export type CodeState = "active" | "scheduled" | "ended" | "off" | "used_up";

export function codeState(code: Pick<PromoCode, "active" | "startsAt" | "endsAt" | "maxUses">, paidUses: number, now = new Date()): CodeState {
  if (!code.active) return "off";
  if (code.endsAt && now >= code.endsAt) return "ended";
  if (code.maxUses !== null && paidUses >= code.maxUses) return "used_up";
  if (code.startsAt && now < code.startsAt) return "scheduled";
  return "active";
}

/**
 * A code this customer can use right now, or a clear reason why not. Limits count paid orders
 * (so abandoned checkouts don't use a code up).
 */
export async function usableCode(input: string, userId: string, currency: string, now = new Date()): Promise<PromoCode> {
  const value = normalizeCode(input);
  const code = CODE_RE.test(value) ? await db.promoCode.findUnique({ where: { code: value } }) : null;
  if (!code || (code.amountOff && code.currency !== currency)) throw fail("promo_not_found", "This code doesn't exist.");
  const [uses, mine] = await Promise.all([
    code.maxUses !== null ? db.order.count({ where: { promoCodeId: code.id, status: "PAID" } }) : 0,
    code.onePerCustomer ? db.order.count({ where: { promoCodeId: code.id, status: "PAID", userId } }) : 0,
  ]);
  const state = codeState(code, uses, now);
  if (state === "off" || state === "ended") throw fail("promo_expired", "This code has expired.");
  if (state === "scheduled") throw fail("promo_not_started", "This code isn't active yet.");
  if (state === "used_up") throw fail("promo_used_up", "This code has been fully used.");
  if (mine > 0) throw fail("promo_already_used", "You've already used this code.");
  return code;
}

export const codeAppliesTo = (code: Pick<PromoCode, "plans">, plan: PlanTier) => code.plans.length === 0 || code.plans.includes(plan);

export function wrongPlan(code: Pick<PromoCode, "plans">) {
  return fail("promo_wrong_plan", "This code is for a different plan.", { plans: code.plans.join(",") });
}

/** "10% off" / "50 SAR off" for staff screens. */
export function describeDiscount(code: Pick<PromoCode, "percentOff" | "amountOff" | "currency">): string {
  if (code.percentOff) return code.percentOff === 100 ? "Free" : `${code.percentOff}% off`;
  const digits = currencyDigits(code.currency ?? "SAR");
  return `${((code.amountOff ?? 0) / 10 ** digits).toLocaleString("en", { maximumFractionDigits: digits })} ${code.currency} off`;
}
