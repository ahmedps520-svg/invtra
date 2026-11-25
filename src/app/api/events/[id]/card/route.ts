import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { db } from "@/server/db";
import { HttpError, requireApiUser, route } from "@/server/http";
import { isUnlocked } from "@/server/render/preview";
import { getEditableEvent } from "@/server/events/access";
import { buildEventCardSvg, renderPersonalInvitation } from "@/server/invitations/render";
import { ensureInvitation } from "@/server/invitations";
import { renderSvgToPng } from "@/server/render/card";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Server-rendered invitation image for the host: a sample (?sample=1) or a specific
 * guest's personalised card (?guestId=…). Add &download=1 to download. For the sample:
 * &blank=1 leaves out the guest's lines and QR (the design on its own), &scale=2 doubles the
 * resolution (2160 px wide) and &format=jpg gives a JPEG.
 */
export const GET = route<Ctx>("events.card", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getEditableEvent(user, id);
  // The full-quality card is only for paid-for events (staff can always check it).
  if (!isUnlocked(event) && user.role !== "ADMIN")
    throw new HttpError(403, "preview_only", "The full-quality file is available after your payment is approved.");
  const guestId = req.nextUrl.searchParams.get("guestId");
  const q = req.nextUrl.searchParams;
  let png: Buffer;
  let filename = "invitation-sample.png";
  if (guestId) {
    const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id } });
    if (!guest) return new NextResponse(null, { status: 404 });
    const invitation = await ensureInvitation(guest);
    png = (await renderPersonalInvitation(event, guest, invitation)).png;
    filename = `invitation-${guest.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
  } else {
    const blank = q.get("blank") === "1";
    const svg = await buildEventCardSvg(
      event,
      blank
        ? { guest: null, qrText: null, qrPlaceholder: false }
        : { guest: { name: event.language === "AR" ? "ضيف تجريبي" : "Sample Guest", allowedCount: 2 }, qrPlaceholder: true },
    );
    const scale = q.get("scale") === "2" ? 2 : 1;
    png = renderSvgToPng(svg, scale === 2 ? 2160 : undefined);
    filename = `invitation-${blank ? "design" : "sample"}${scale === 2 ? "@2x" : ""}.png`;
  }
  let body: Buffer = png;
  let type = "image/png";
  if (q.get("format") === "jpg") {
    body = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    type = "image/jpeg";
    filename = filename.replace(/\.png$/, ".jpg");
  }
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      ...(q.get("download") ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } : {}),
    },
  });
});
