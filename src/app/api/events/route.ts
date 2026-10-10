import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { createEvent } from "@/server/events/service";
import { eventInputSchema } from "@/lib/validation/event";

export const GET = route("events.list", async () => {
  const user = await requireApiUser();
  const events = await db.event.findMany({
    where: { userId: user.id, deletedAt: null, customDraft: false },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, hostNames: true, startsAt: true, timezone: true, themeKey: true, type: true, plan: true },
  });
  return ok({ events });
});

export const POST = route("events.create", async (req: NextRequest) => {
  const user = await requireApiUser();
  await enforceRateLimit(`events.create:${user.id}`, 30, 3600);
  // Optional `themeKey` preselects a design chosen on the marketing site (/designs → "Use this design").
  const { themeKey, ...input } = await parseJson(req, eventInputSchema.extend({ themeKey: z.string().max(40).optional() }));
  const event = await createEvent(user.id, input, themeKey);
  return ok({ event: { id: event.id } }, { status: 201 });
});
