import { NextResponse, type NextRequest } from "next/server";
import { loadPublicInvitation } from "@/server/invitations/public";
import { renderPersonalInvitation } from "@/server/invitations/render";
import { clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";

/** The guest's personalised invitation image (with entry QR) — only once they've accepted. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!(await rateLimit(`img:${clientIp(req)}`, 30, 600)).ok) return new NextResponse(null, { status: 429 });
  const data = await loadPublicInvitation(token);
  if (!data || data.state !== "active" || data.guest.rsvpStatus !== "ACCEPTED") return new NextResponse(null, { status: 404 });
  const { png } = await renderPersonalInvitation(data.event, data.guest, data.invitation);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
      ...(req.nextUrl.searchParams.get("download") ? { "Content-Disposition": 'attachment; filename="invitation.png"' } : {}),
    },
  });
}
