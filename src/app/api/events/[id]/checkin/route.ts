import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, parseQuery, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { doorCheckIn } from "@/server/door/service";
import { checkinDashboard } from "@/server/door/dashboard";

type Ctx = { params: Promise<{ id: string }> };

/** The check-in dashboard's numbers; with ?since= only the guests changed since then. */
export const GET = route<Ctx>("events.checkin", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const { since } = parseQuery(req, z.object({ since: z.string().datetime().optional() }));
  return ok(await checkinDashboard(event, since ? new Date(since) : undefined));
});

/** The host checks a guest in from the dashboard (with how many people arrived), or undoes it. */
export const POST = route<Ctx>("events.checkin.guest", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const input = await parseJson(
    req,
    z.object({ guestId: z.string().min(1).max(40), count: z.number().int().min(1).max(50).optional(), undo: z.boolean().optional() }),
  );
  return ok({ guest: await doorCheckIn(event, input.guestId, { count: input.count, undo: input.undo, byHost: true }) });
});
