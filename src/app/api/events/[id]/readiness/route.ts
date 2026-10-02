import { ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { sendReadiness } from "@/server/sending/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("events.readiness", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const r = await sendReadiness(event);
  return ok({ ready: r.ready, checks: r.checks, unsent: r.unsent, guestCount: r.guestCount, template: r.template ? { id: r.template.id, name: r.template.name } : null });
});
