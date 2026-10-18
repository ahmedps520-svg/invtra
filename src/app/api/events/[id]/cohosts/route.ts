import type { NextRequest } from "next/server";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { coHostInputSchema, coHostViews, inviteCoHost } from "@/server/events/cohosts";

type Ctx = { params: Promise<{ id: string }> };

/** The event's co-hosts and how many guests each has added (owner only). */
export const GET = route<Ctx>("cohosts.list", async (_req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const event = await getOwnedEvent(user, (await ctx.params).id);
  return ok({ coHosts: await coHostViews(event.id) });
});

/** Invite someone to keep their own guest list; they're emailed a link. */
export const POST = route<Ctx>("cohosts.invite", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const event = await getOwnedEvent(user, (await ctx.params).id);
  await enforceRateLimit(`cohost-invite:${user.id}`, 20, 3600);
  const input = await parseJson(req, coHostInputSchema);
  await inviteCoHost(user, event, input);
  return ok({ coHosts: await coHostViews(event.id) }, { status: 201 });
});
