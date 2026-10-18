import { ok, requireApiUser, route } from "@/server/http";
import { getGuestAccess, guestInScope } from "@/server/events/cohosts";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { resendToGuests } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

export const POST = route<Ctx>("guests.resend", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, guestId } = await ctx.params;
  await enforceRateLimit(`resend:${user.id}`, 60, 600);
  const access = await getGuestAccess(user, id);
  const guest = await guestInScope(access, guestId);
  return ok(await resendToGuests(user.id, access.event, [guest.id]));
});
