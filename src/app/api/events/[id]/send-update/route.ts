import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { sendUpdateToAccepted } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string }> };

/** Re-send the regenerated invitation to accepted guests after the event changed. */
export const POST = route<Ctx>("events.send-update", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`send-update:${user.id}`, 5, 3600);
  const event = await getOwnedEvent(user, id);
  return ok(await sendUpdateToAccepted(user.id, event), { status: 201 });
});
