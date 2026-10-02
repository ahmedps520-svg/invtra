import { ok, requireApiUser, route } from "@/server/http";
import { planCatalogue } from "@/server/payments/service";

/** Plan catalogue with prices (minor units) in the configured PAYMENT_CURRENCY. */
export const GET = route("billing.plans", async () => {
  await requireApiUser();
  return ok(planCatalogue());
});
