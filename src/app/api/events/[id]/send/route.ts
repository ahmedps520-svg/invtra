import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { startInitialBatch } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string }> };

/** Queue invitations for every guest who hasn't been messaged yet. */
export const POST = route<Ctx>("events.send", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`send:${user.id}`, 10, 600);
  const event = await getOwnedEvent(user, id);
  const batch = await startInitialBatch(user.id, event);
  return ok({ batch }, { status: 201 });
});
