import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { notFound, ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { defaultCountryFor, deleteGuests, editGuest } from "@/server/guests/service";
import { ensureInvitation, invitationUrl } from "@/server/invitations";
import { guestInputSchema } from "@/lib/validation/guest";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

async function load(ctx: Ctx) {
  const user = await requireApiUser();
  const { id, guestId } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id } });
  if (!guest) throw notFound("Guest");
  return { user, event, guest };
}

/** Guest detail incl. message history, RSVP history, views and scans. */
export const GET = route<Ctx>("guests.get", async (_req, ctx) => {
  const { guest } = await load(ctx);
  const invitation = await ensureInvitation(guest);
  const [messages, rsvps, scans] = await Promise.all([
    db.whatsAppMessage.findMany({ where: { guestId: guest.id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, direction: true, purpose: true, status: true, type: true, errorCode: true, errorMessage: true, createdAt: true, sentAt: true, deliveredAt: true, readAt: true, failedAt: true } }),
    db.rsvp.findMany({ where: { guestId: guest.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.qRScan.findMany({ where: { guestId: guest.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return ok({ guest, invitationUrl: invitationUrl(invitation.token), messages, rsvps, scans });
});

export const PATCH = route<Ctx>("guests.update", async (req: NextRequest, ctx) => {
  const { event, guest } = await load(ctx);
  const input = await parseJson(req, guestInputSchema);
  return ok({ guest: await editGuest(guest, input, defaultCountryFor(event.timezone)) });
});

export const DELETE = route<Ctx>("guests.delete", async (_req, ctx) => {
  const { event, guest } = await load(ctx);
  await deleteGuests(event.id, [guest.id]);
  return ok();
});
