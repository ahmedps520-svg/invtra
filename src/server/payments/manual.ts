import { env } from "@/server/env";
import { bankDetails, transferText } from "./bank";
import type { PaymentProvider } from "./types";

/** Payment instructions shown to customers for manual (bank transfer) orders. */
export async function manualInstructions(lang: "en" | "ar" = "en"): Promise<string> {
  return env().PAYMENT_MANUAL_INSTRUCTIONS?.trim() || transferText(await bankDetails(), lang);
}

/**
 * Manual payments (bank transfer, invoice...). The order stays PENDING; the billing
 * page shows the instructions and an INVTRA admin marks it paid from /admin/payments.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",
  async createCheckout(order) {
    return { redirectUrl: `/dashboard/billing?order=${encodeURIComponent(order.id)}` };
  },
};
