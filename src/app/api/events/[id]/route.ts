import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { deleteEvent, eventToInput, updateEvent } from "@/server/events/service";
import { staleAcceptedCount } from "@/server/sending/service";
import { eventInputSchema } from "@/lib/validation/event";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("events.get", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id, { scheduleItems: { orderBy: { sortOrder: "asc" } } });
  return ok({ event, input: eventToInput(event) });
});

export const PATCH = route<Ctx>("events.update", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const input = await parseJson(req, eventInputSchema);
  const result = await updateEvent(event, input);
  return ok({ event: { id: result.event.id }, cardChanged: result.cardChanged, staleAccepted: await staleAcceptedCount(result.event) });
});

export const DELETE = route<Ctx>("events.delete", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  await deleteEvent(event.id);
  await db.auditLog.create({ data: { actorId: user.id, action: "event.delete", targetType: "event", targetId: event.id } });
  return ok();
});
