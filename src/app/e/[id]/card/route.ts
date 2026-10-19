import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { teaserJpeg } from "@/server/invitations/render";
import { isUnlocked, previewResponse, renderProtectedPreview } from "@/server/render/preview";
import { validCardSignature } from "@/server/reminders/unpaid";

/** The event's invitation design (no QR code) for the host's reminder emails — the link is signed. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!validCardSignature(id, req.nextUrl.searchParams.get("s"))) return new NextResponse(null, { status: 404 });
  const event = await db.event.findUnique({ where: { id } });
  if (!event || event.deletedAt) return new NextResponse(null, { status: 404 });
  // Reminders go to hosts who haven't paid: they see the protected preview, not the design itself.
  if (!isUnlocked(event)) return previewResponse(await renderProtectedPreview(event), { cache: "public" });
  return new NextResponse(new Uint8Array(await teaserJpeg(event)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
