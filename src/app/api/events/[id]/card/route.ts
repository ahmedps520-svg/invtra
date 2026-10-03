import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireApiUser, route } from "@/server/http";
import { getEditableEvent } from "@/server/events/access";
import { buildEventCardSvg, renderPersonalInvitation } from "@/server/invitations/render";
import { ensureInvitation } from "@/server/invitations";
import { renderSvgToPng } from "@/server/render/card";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Server-rendered invitation image for the host: a sample (?sample=1) or a specific
 * guest's personalised card (?guestId=…). Add &download=1 to download.
 */
export const GET = route<Ctx>("events.card", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getEditableEvent(user, id);
  const guestId = req.nextUrl.searchParams.get("guestId");
  let png: Buffer;
  let filename = "invitation-sample.png";
  if (guestId) {
    const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id } });
    if (!guest) return new NextResponse(null, { status: 404 });
    const invitation = await ensureInvitation(guest);
    png = (await renderPersonalInvitation(event, guest, invitation)).png;
    filename = `invitation-${guest.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
  } else {
    const svg = await buildEventCardSvg(event, {
      guest: { name: event.language === "AR" ? "ضيف تجريبي" : "Sample Guest", allowedCount: 2 },
      qrPlaceholder: true,
    });
    png = renderSvgToPng(svg);
  }
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      ...(req.nextUrl.searchParams.get("download") ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } : {}),
    },
  });
});
