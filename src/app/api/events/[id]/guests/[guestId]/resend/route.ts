import { db } from "@/server/db";
import { notFound, ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { resendToGuests } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

export const POST = route<Ctx>("guests.resend", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, guestId } = await ctx.params;
  await enforceRateLimit(`resend:${user.id}`, 60, 600);
  const event = await getOwnedEvent(user, id);
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id } });
  if (!guest) throw notFound("Guest");
  return ok(await resendToGuests(user.id, event, [guest.id]));
});
