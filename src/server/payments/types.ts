import type { Order } from "@prisma/client";

/**
 * Provider-agnostic payment interface.
 *
 * Amounts are always minor units of `order.currency` exactly as stored on the order
 * (cents for USD/AED/SAR/QAR, fils/baisa — three decimals — for KWD/BHD/OMR).
 */

export type PaymentProviderName = "mock" | "manual" | "stripe";

export interface CheckoutUrls {
  successUrl: string;
  cancelUrl: string;
}

/** Optional context that improves the hosted checkout page (never required). */
export interface CheckoutContext {
  customerEmail?: string;
  /** Line-item name, e.g. "INVTRA Premium — The Wedding of Ahmed & Sara". */
  description?: string;
}

export interface CheckoutResult {
  /** Where the customer's browser goes next (absolute URL or same-origin path). */
  redirectUrl: string;
  /** Provider-side reference stored on Order.providerRef (e.g. Stripe Checkout Session id). */
  providerRef?: string;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  createCheckout(order: Order, urls: CheckoutUrls, ctx?: CheckoutContext): Promise<CheckoutResult>;
  /** Best effort: invalidate a previously created hosted checkout so it can no longer be paid. */
  expireCheckout?(providerRef: string): Promise<void>;
}

/** Details of a successful payment, recorded on the Payment row. */
export interface PaidDetails {
  provider: PaymentProviderName | string;
  providerPaymentId?: string | null;
  /** Defaults to the order amount / currency. */
  amount?: number;
  currency?: string;
  raw?: unknown;
  /** Admin who recorded the payment (manual), for the audit trail. */
  actorId?: string | null;
  note?: string | null;
}
