import { NextResponse, type NextRequest } from "next/server";
import { loadPublicInvitation } from "@/server/invitations/public";
import { renderTeaser } from "@/server/invitations/render";

/** Link-preview image: the event design without any personal QR code. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const data = await loadPublicInvitation(token);
  if (!data || data.state !== "active") return new NextResponse(null, { status: 404 });
  const { png } = await renderTeaser(data.event);
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
}
