import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { db } from "@/server/db";
import { renderTeaser } from "@/server/invitations/render";

/**
 * The invitation design (no QR code) for a payment link — shown in the payment email and on the
 * payment page. The secret token is the authorisation, like the payment page itself.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const order = await db.order.findUnique({ where: { payToken: token }, include: { event: true } });
  if (!order?.event || order.event.deletedAt) return new NextResponse(null, { status: 404 });
  const { png } = await renderTeaser(order.event);
  const jpg = await sharp(png).resize({ width: 640 }).flatten({ background: "#fffdfa" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new NextResponse(new Uint8Array(jpg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
