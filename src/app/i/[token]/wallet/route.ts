import { NextResponse, type NextRequest } from "next/server";
import { loadPublicInvitation } from "@/server/invitations/public";
import { buildWalletPass, passLastModified } from "@/server/apple/wallet";
import { clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";

/** "Add to Apple Wallet": the guest's entry pass (only once they've accepted). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.toUpperCase();
  if (!(await rateLimit(`wallet-pass:${clientIp(req)}`, 60, 600)).ok) return new NextResponse(null, { status: 429 });
  const data = await loadPublicInvitation(token);
  if (!data || data.state !== "active" || data.guest.rsvpStatus !== "ACCEPTED") return new NextResponse(null, { status: 404 });
  const pass = await buildWalletPass({ ...data.invitation, guest: data.guest, event: data.event });
  if (!pass) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(pass), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": 'attachment; filename="invitation.pkpass"',
      "Last-Modified": passLastModified(data.invitation).toUTCString(),
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
