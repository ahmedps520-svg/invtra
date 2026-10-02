import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, clientIp, notFound, ok, parseJson, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { loadPublicInvitation } from "@/server/invitations/public";
import { respond } from "@/server/rsvp";

type Ctx = { params: Promise<{ token: string }> };

/**
 * RSVP from the invitation website. Same rules as the WhatsApp buttons; the entry QR
 * is shown on the page right away for accepted guests.
 */
export const POST = route<Ctx>("invitation.rsvp", async (req: NextRequest, ctx) => {
  const { token } = await ctx.params;
  await enforceRateLimit(`rsvp:${clientIp(req)}`, 20, 600);
  const data = await loadPublicInvitation(token);
  if (!data || data.state !== "active") throw notFound("Invitation");
  if (!data.event.allowWebRsvp) throw badRequest("web_rsvp_disabled", "Please reply using the buttons in your WhatsApp invitation.");
  const body = await parseJson(req, z.object({ response: z.enum(["ACCEPTED", "DECLINED"]), attendingCount: z.number().int().min(1).max(50).optional() }));
  const outcome = await respond({ guestId: data.guest.id, response: body.response, source: "WEB", attendingCount: body.attendingCount });
  if (outcome.kind === "closed") throw badRequest("closed", "This invitation is no longer active.");
  if (outcome.kind === "deadline") throw badRequest("deadline", "RSVPs for this event have closed.");
  return ok({ rsvpStatus: outcome.guest.rsvpStatus, attendingCount: outcome.guest.attendingCount });
});
