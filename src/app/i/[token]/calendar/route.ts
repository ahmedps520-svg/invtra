import { NextResponse, type NextRequest } from "next/server";
import { loadPublicInvitation } from "@/server/invitations/public";
import { invitationUrl } from "@/server/invitations";
import { icsCalendar } from "@/server/invitations/calendar";
import { pageLang } from "@/server/invitations/view-model";
import { eventForGuest, sectionInfo } from "@/server/events/sections";

/** "Add to calendar" (.ics — Apple Calendar, Outlook) for an invited guest, at their section's time and place. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.toUpperCase();
  const data = await loadPublicInvitation(token);
  // No calendar entry until the date is known.
  if (!data || data.state !== "active" || data.guest.rsvpStatus === "DECLINED" || data.event.dateTbd) return new NextResponse(null, { status: 404 });
  const body = icsCalendar(eventForGuest(data.event, data.guest), {
    lang: pageLang(data.event, data.guest),
    url: invitationUrl(token),
    section: sectionInfo(data.event, data.guest),
    uid: data.invitation.id,
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invitation.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
