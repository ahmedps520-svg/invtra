import { env } from "@/server/env";
import type { PaymentProvider } from "./types";

export const DEFAULT_MANUAL_INSTRUCTIONS =
  "Please transfer the amount shown to INVTRA's bank account and include your order reference in the transfer description. " +
  "Email contact@invtra.store for our bank details. Your plan is activated as soon as our team confirms the payment.";

/** Payment instructions shown to customers for manual (bank transfer) orders. */
export function manualInstructions(): string {
  return env().PAYMENT_MANUAL_INSTRUCTIONS?.trim() || DEFAULT_MANUAL_INSTRUCTIONS;
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
