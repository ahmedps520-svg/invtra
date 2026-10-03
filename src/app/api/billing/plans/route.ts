import type { NextRequest } from "next/server";
import { ok, requireApiUser, route } from "@/server/http";
import { findOwnedEvent } from "@/server/events/access";
import { planCatalogue, planCredit } from "@/server/payments/service";

/**
 * Plan catalogue with prices (minor units) in the configured PAYMENT_CURRENCY, plus any
 * offer on sale. With ?event=<id>: `credit` — what that event's current plan counts for
 * towards an upgrade when it was bought with an offer (null = list price).
 */
export const GET = route("billing.plans", async (req: NextRequest) => {
  const user = await requireApiUser();
  const eventId = req.nextUrl.searchParams.get("event");
  const event = eventId ? await findOwnedEvent(user.id, eventId) : null;
  return ok({
    ...planCatalogue(),
    credit: event ? await planCredit(event) : null,
  });
});
