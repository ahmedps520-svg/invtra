import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { badRequest, notFound, ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { recordActivity } from "@/server/activity";
import { updateGuest } from "@/server/guests/status";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

/**
 * The host records an answer on the guest's behalf (e.g. they replied by phone).
 * No WhatsApp message is sent; the host can use Resend to deliver the invitation.
 */
export const POST = route<Ctx>("guests.rsvp", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id, guestId } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id } });
  if (!guest) throw notFound("Guest");
  const body = await parseJson(req, z.object({ response: z.enum(["ACCEPTED", "DECLINED", "PENDING"]), attendingCount: z.number().int().min(0).max(50).optional() }));
  if (body.attendingCount !== undefined && body.attendingCount > guest.allowedCount) throw badRequest("too_many", "More than the guest's allowance.");
  const attending = body.response === "ACCEPTED" ? (body.attendingCount ?? guest.allowedCount) : body.response === "DECLINED" ? 0 : null;
  await updateGuest(db, guest.id, {
    rsvpStatus: body.response,
    rsvpAt: body.response === "PENDING" ? null : new Date(),
    rsvpSource: body.response === "PENDING" ? null : "HOST",
    attendingCount: attending,
    lastActivityAt: new Date(),
  });
  if (body.response !== "PENDING") {
    await db.rsvp.create({ data: { eventId: event.id, guestId: guest.id, response: body.response, source: "HOST", attendingCount: attending } });
    if (body.response !== guest.rsvpStatus) {
      await recordActivity(db, event.id, body.response === "ACCEPTED" ? "guest.accepted" : "guest.declined", { name: guest.name, source: "HOST" }, guest.id);
    }
  }
  return ok();
});
