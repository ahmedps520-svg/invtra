import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { notFound, ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { audit } from "@/server/log";
import { discardCustomDraft, updateCustomEvent } from "@/server/custom/service";
import { customEventInputSchema, withDateRules } from "@/lib/validation/event";

type Ctx = { params: Promise<{ eventId: string }> };

/** Admin: edit a custom event's details (anything but the occasion and date can be left out). */
export const PATCH = route<Ctx>("admin.custom.details", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { eventId } = await ctx.params;
  const event = await db.event.findFirst({ where: { id: eventId, custom: true, deletedAt: null } });
  if (!event) throw notFound("Event");
  const input = await parseJson(req, withDateRules(customEventInputSchema));
  const result = await updateCustomEvent(event, input);
  await audit(admin.id, "admin.custom.details", "event", event.id);
  return ok({ event: { id: result.event.id }, cardChanged: result.cardChanged, staleAccepted: 0 });
});

/** Admin: discard a draft that never got a host. */
export const DELETE = route<Ctx>("admin.custom.discard", async (_req, ctx) => {
  const admin = await requireApiAdmin();
  const { eventId } = await ctx.params;
  await discardCustomDraft(admin.id, eventId);
  return ok({ message: "Draft discarded" });
});
