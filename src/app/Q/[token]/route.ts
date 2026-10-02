import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { recordScan } from "@/server/invitations/public";
import { BOT_UA } from "@/server/invitations/public";

/**
 * Target of every guest's QR code (upper-case so the QR stays small and robust).
 * Records the scan, then opens the guest's invitation page. When the event's host is
 * signed in on the scanning phone, the page opens in door check-in mode.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.toUpperCase();
  const ua = req.headers.get("user-agent");
  const limited = !(await rateLimit(`scan:${clientIp(req)}`, 120, 600)).ok;
  let checkin = false;
  if (!limited && !(ua && BOT_UA.test(ua))) {
    const user = await getSessionUser();
    const inv = await recordScanForViewer(token, user?.id ?? null, user?.role === "ADMIN");
    checkin = inv?.byHost ?? false;
  }
  const url = new URL(`/i/${token}`, req.url);
  url.searchParams.set("via", "qr");
  if (checkin) url.searchParams.set("checkin", "1");
  return NextResponse.redirect(url, 302);
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
