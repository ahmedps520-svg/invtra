import { NextResponse } from "next/server";
import { requireApiUser, route } from "@/server/http";
import { getGuestAccess } from "@/server/events/cohosts";
import { exportGuestsCsv } from "@/server/guests/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("guests.export", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const { event, scope } = await getGuestAccess(user, id);
  const csv = await exportGuestsCsv(event.id, scope);
  const name = `${event.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-guests.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
