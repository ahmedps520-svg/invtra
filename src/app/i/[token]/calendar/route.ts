import { NextResponse, type NextRequest } from "next/server";
import { loadPublicInvitation } from "@/server/invitations/public";
import { invitationUrl } from "@/server/invitations";

function ics(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** "Add to calendar" (.ics) for accepted guests. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const data = await loadPublicInvitation(token);
  if (!data || data.state !== "active" || data.guest.rsvpStatus !== "ACCEPTED") return new NextResponse(null, { status: 404 });
  const e = data.event;
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 4 * 3600_000);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//INVTRA//Invitation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.invitation.id}@invtra.store`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(e.startsAt)}`,
    `DTEND:${ics(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(`${e.venueName}, ${e.address}`)}`,
    `DESCRIPTION:${esc(`Your invitation: ${invitationUrl(token)}`)}`,
    `URL:${invitationUrl(token)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="invitation.ics"', "Cache-Control": "private, no-store" },
  });
}
