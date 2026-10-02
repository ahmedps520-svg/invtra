import type { PaymentProvider } from "./types";

/**
 * Development provider: sends the customer to INVTRA's own TEST MODE checkout page
 * (/billing/mock-checkout/[orderId]) where "Pay" marks the order paid through the
 * same `applyPaidOrder` path a real provider's webhook uses.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(order) {
    return { redirectUrl: `/billing/mock-checkout/${order.id}`, providerRef: `mock_${order.id}` };
  },
};
