import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { forbidden, notFound, ok, parseJson, requireApiUser, route } from "@/server/http";
import { recordActivity } from "@/server/activity";
import { isWellFormedInvitationToken } from "@/server/security/tokens";
import { walletChanged } from "@/server/apple/push";

type Ctx = { params: Promise<{ token: string }> };

/** Door check-in from the invitation page (host only). */
export const POST = route<Ctx>("invitation.check-in", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { token } = await ctx.params;
  if (!isWellFormedInvitationToken(token)) throw notFound("Invitation");
  const inv = await db.invitation.findUnique({ where: { token }, include: { guest: true, event: true } });
  if (!inv) throw notFound("Invitation");
  if (inv.event.userId !== user.id && user.role !== "ADMIN") throw forbidden();
  const { count, undo } = await parseJson(req, z.object({ count: z.number().int().min(1).max(50).optional(), undo: z.boolean().optional() }));
  const g = await db.guest.update({
    where: { id: inv.guestId },
    data: undo ? { checkedInAt: null, checkedInCount: null } : { checkedInAt: new Date(), checkedInCount: count ?? inv.guest.attendingCount ?? inv.guest.allowedCount },
  });
  if (!undo) await recordActivity(db, inv.eventId, "guest.checked_in", { name: g.name, count: g.checkedInCount }, g.id);
  await walletChanged({ guestIds: [g.id] });
  return ok({ checkedInAt: g.checkedInAt, checkedInCount: g.checkedInCount });
});
