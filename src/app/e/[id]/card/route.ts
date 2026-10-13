import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { teaserJpeg } from "@/server/invitations/render";
import { validCardSignature } from "@/server/reminders/unpaid";

/** The event's invitation design (no QR code) for the host's reminder emails — the link is signed. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!validCardSignature(id, req.nextUrl.searchParams.get("s"))) return new NextResponse(null, { status: 404 });
  const event = await db.event.findUnique({ where: { id } });
  if (!event || event.deletedAt) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(await teaserJpeg(event)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
