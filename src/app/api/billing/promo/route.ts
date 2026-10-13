import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseQuery, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { findOwnedEvent } from "@/server/events/access";
import { paymentCurrency, planCredit, SELF_SERVE_PLANS } from "@/server/payments/service";
import { codeAppliesTo, discountFor, usableCode, wrongPlan } from "@/server/payments/promo";
import { upgradePrice } from "@/lib/plans";

/**
 * Check a discount code and price each plan with it — for this event's upgrade when
 * ?event= is given. Rate limited, so codes can't be guessed.
 */
export const GET = route("billing.promo", async (req: NextRequest) => {
  const user = await requireApiUser();
  await enforceRateLimit(`promo:${user.id}`, 30, 600);
  const q = parseQuery(req, z.object({ code: z.string().trim().min(1).max(40), event: z.string().max(40).optional() }));
  const currency = paymentCurrency();
  const code = await usableCode(q.code, user.id, currency);
  const event = q.event ? await findOwnedEvent(user.id, q.event) : null;
  const credit = event ? await planCredit(event) : null;
  const prices: Record<string, { base: number; discount: number; amount: number } | null> = {};
  for (const tier of SELF_SERVE_PLANS) {
    const base = upgradePrice(event?.plan ?? null, tier, currency, credit);
    if (base === null || base <= 0 || !codeAppliesTo(code, tier)) {
      prices[tier] = null;
      continue;
    }
    const discount = discountFor(code, base, currency);
    prices[tier] = { base, discount, amount: base - discount };
  }
  if (!Object.values(prices).some((p) => p && p.discount > 0)) throw wrongPlan(code);
  return ok({
    code: code.code,
    percentOff: code.percentOff,
    amountOff: code.amountOff,
    currency,
    prices,
  });
});
