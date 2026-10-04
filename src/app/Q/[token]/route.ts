import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { recordScan } from "@/server/invitations/public";
import { BOT_UA } from "@/server/invitations/public";
import { appUrl } from "@/server/env";
import { DOOR_COOKIE, findDoorEvent } from "@/server/door/service";

/**
 * Target of every guest's QR code (upper-case so the QR stays small and robust).
 * Records the scan, then opens the guest's invitation page. When the event's host is
 * signed in on the scanning phone, the page opens in door check-in mode; on a phone that
 * opened the event's door link (staff), it opens the door check-in view for this guest.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.toUpperCase();
  const ua = req.headers.get("user-agent");
  const limited = !(await rateLimit(`scan:${clientIp(req)}`, 120, 600)).ok;
  const door = limited ? null : await doorFor(req.cookies.get(DOOR_COOKIE)?.value, token);
  if (door) {
    // The door view looks the guest up (and counts the scan) itself.
    const url = new URL(appUrl(`/door/${door}`));
    url.searchParams.set("g", token);
    return NextResponse.redirect(url, 302);
  }
  let checkin = false;
  if (!limited && !(ua && BOT_UA.test(ua))) {
    const user = await getSessionUser();
    const inv = await recordScanForViewer(token, user?.id ?? null, user?.role === "ADMIN");
    checkin = inv?.byHost ?? false;
  }
  // Build the target from the public address: behind Render's proxy req.url is the internal
  // origin (https://localhost:10000), which a guest's phone cannot open.
  const url = new URL(appUrl(`/i/${encodeURIComponent(token)}`));
  url.searchParams.set("via", "qr");
  if (checkin) url.searchParams.set("checkin", "1");
  return NextResponse.redirect(url, 302);
}

/** The staff member's door link, when it belongs to this invitation's event. */
async function doorFor(doorToken: string | undefined, token: string): Promise<string | null> {
  const event = await findDoorEvent(doorToken);
  if (!event) return null;
  const { db } = await import("@/server/db");
  const inv = await db.invitation.findUnique({ where: { token }, select: { eventId: true } });
  return inv?.eventId === event.id ? event.doorToken : null;
}

async function recordScanForViewer(token: string, userId: string | null, isAdmin: boolean) {
  const { db } = await import("@/server/db");
  const owner = userId
    ? await db.invitation.findUnique({ where: { token }, select: { event: { select: { userId: true } } } })
    : null;
  const byHost = Boolean(owner && (owner.event.userId === userId || isAdmin));
  const inv = await recordScan(token, byHost);
  return inv ? { byHost } : null;
}
