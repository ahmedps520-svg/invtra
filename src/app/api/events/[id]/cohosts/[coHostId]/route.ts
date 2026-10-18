import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { coHostUpdateSchema, coHostViews, removeCoHost, resendInvite, updateCoHost } from "@/server/events/cohosts";

type Ctx = { params: Promise<{ id: string; coHostId: string }> };

async function load(ctx: Ctx) {
  const user = await requireApiUser();
  const { id, coHostId } = await ctx.params;
  return { user, event: await getOwnedEvent(user, id), coHostId };
}

/** Rename a co-host's list or change its limit. */
export const PATCH = route<Ctx>("cohosts.update", async (req: NextRequest, ctx) => {
  const { event, coHostId } = await load(ctx);
  await updateCoHost(event, coHostId, await parseJson(req, coHostUpdateSchema));
  return ok({ coHosts: await coHostViews(event.id) });
});

/** Email the invitation again. */
export const POST = route<Ctx>("cohosts.resend", async (req: NextRequest, ctx) => {
  const { user, event, coHostId } = await load(ctx);
  await parseJson(req, z.object({ action: z.literal("resend") }));
  await enforceRateLimit(`cohost-invite:${user.id}`, 20, 3600);
  await resendInvite(user, event, coHostId);
  return ok({ coHosts: await coHostViews(event.id) });
});

/** Remove a co-host; their guests move to the owner's list. */
export const DELETE = route<Ctx>("cohosts.remove", async (_req: NextRequest, ctx) => {
  const { user, event, coHostId } = await load(ctx);
  const { moved } = await removeCoHost(user, event, coHostId);
  return ok({ moved, coHosts: await coHostViews(event.id) });
});
