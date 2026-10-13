import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser, route } from "@/server/http";
import { getEditableEvent } from "@/server/events/access";
import { storage } from "@/server/storage";
import { statusVideoFilename, statusVideoKey } from "@/server/video/status";

type Ctx = { params: Promise<{ id: string }> };

/** Downloads the video for the event's current design (also what the Share button sends). */
export const GET = route<Ctx>("events.video.file", async (_req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const event = await getEditableEvent(user, (await ctx.params).id);
  const key = statusVideoKey(event);
  const data = event.statusVideoKey === key ? await storage().get(key) : null;
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(data.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(statusVideoFilename(event.title))}`,
      "Cache-Control": "private, no-store",
    },
  });
});
