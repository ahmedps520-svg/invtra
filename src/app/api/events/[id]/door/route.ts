import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { doorClosesAt, doorUrl, setDoorLink } from "@/server/door/service";

type Ctx = { params: Promise<{ id: string }> };

/** The host creates, replaces or turns off the door check-in link for their staff. */
export const POST = route<Ctx>("events.door", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const { action } = await parseJson(req, z.object({ action: z.enum(["create", "regenerate", "disable"]) }));
  const token = await setDoorLink(event, action);
  return ok({ url: token ? doorUrl(token) : null, closesAt: doorClosesAt(event).toISOString() });
});
