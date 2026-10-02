import { env } from "@/server/env";
import { manualProvider } from "./manual";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider, PaymentProviderName } from "./types";

const PROVIDERS: Record<PaymentProviderName, PaymentProvider> = {
  mock: mockProvider,
  manual: manualProvider,
  stripe: stripeProvider,
};

/** The provider new checkouts use (PAYMENT_PROVIDER). */
export function paymentProvider(): PaymentProvider {
  return PROVIDERS[env().PAYMENT_PROVIDER];
}

/** The provider an existing order was created with (orders outlive config changes). */
export function providerFor(name: string): PaymentProvider | null {
  return (PROVIDERS as Record<string, PaymentProvider | undefined>)[name] ?? null;
}

export type { PaymentProvider, PaymentProviderName } from "./types";
