import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getGuestAccess, idsInScope } from "@/server/events/cohosts";
import { deleteGuests } from "@/server/guests/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("guests.bulk-delete", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const access = await getGuestAccess(user, id);
  const { ids } = await parseJson(req, z.object({ ids: z.array(z.string()).min(1).max(5000) }));
  return ok({ deleted: await deleteGuests(access.event.id, await idsInScope(access, ids)) });
});
