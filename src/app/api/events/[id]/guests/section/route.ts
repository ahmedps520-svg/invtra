import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getGuestAccess, idsInScope } from "@/server/events/cohosts";
import { walletChanged } from "@/server/apple/push";

type Ctx = { params: Promise<{ id: string }> };

/** Put several guests in the men's or women's section at once (or clear it). */
export const POST = route<Ctx>("guests.section", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const access = await getGuestAccess(user, id);
  const parsed = await parseJson(req, z.object({ ids: z.array(z.string()).min(1).max(5000), section: z.enum(["MEN", "WOMEN"]).nullable() }));
  const ids = await idsInScope(access, parsed.ids);
  const r = await db.guest.updateMany({ where: { eventId: access.event.id, id: { in: ids } }, data: { section: parsed.section } });
  await walletChanged({ guestIds: ids });
  return ok({ updated: r.count });
});
