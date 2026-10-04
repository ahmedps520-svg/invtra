import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";

type Ctx = { params: Promise<{ id: string }> };

/** Put several guests in the men's or women's section at once (or clear it). */
export const POST = route<Ctx>("guests.section", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const { ids, section } = await parseJson(req, z.object({ ids: z.array(z.string()).min(1).max(5000), section: z.enum(["MEN", "WOMEN"]).nullable() }));
  const r = await db.guest.updateMany({ where: { eventId: event.id, id: { in: ids } }, data: { section } });
  return ok({ updated: r.count });
});
