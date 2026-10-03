import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { markManualSent } from "@/server/sending/manual";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

/** The host opened WhatsApp to send this guest's invitation from their own phone. */
export const POST = route<Ctx>("guests.manual_sent", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, guestId } = await ctx.params;
  await enforceRateLimit(`manual-send:${user.id}`, 600, 600);
  const event = await getOwnedEvent(user, id);
  return ok(await markManualSent(event, guestId));
});
