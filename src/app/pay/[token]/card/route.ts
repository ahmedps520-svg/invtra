import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { teaserJpeg } from "@/server/invitations/render";
import { isUnlocked, orderUnlocked, previewResponse, renderProtectedPreview } from "@/server/render/preview";

/**
 * The invitation design (no QR code) for a payment link — shown in the payment email and on the
 * payment page. The secret token is the authorisation, like the payment page itself.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const order = await db.order.findUnique({ where: { payToken: token }, include: { event: true } });
  if (!order?.event || order.event.deletedAt) return new NextResponse(null, { status: 404 });
  // Until the package is paid for, the design is shown only as the protected preview.
  if (!orderUnlocked(order) && !isUnlocked(order.event)) return previewResponse(await renderProtectedPreview(order.event), { cache: "public" });
  return new NextResponse(new Uint8Array(await teaserJpeg(order.event)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
