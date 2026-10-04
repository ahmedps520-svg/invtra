import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { defaultCountryFor, importGuests } from "@/server/guests/service";

type Ctx = { params: Promise<{ id: string }> };

const rowSchema = z.object({
  name: z.string(),
  phone: z.string(),
  groupName: z.string().nullable().optional(),
  allowedCount: z.number().int().optional(),
  section: z.enum(["MEN", "WOMEN"]).nullable().optional(),
});

export const POST = route<Ctx>("guests.import", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const { rows, country } = await parseJson(req, z.object({ rows: z.array(rowSchema).max(5000), country: z.string().length(2).optional() }));
  const result = await importGuests(
    event.id,
    rows.map((r) => ({ name: r.name, phone: r.phone, groupName: r.groupName ?? null, allowedCount: r.allowedCount ?? 1, section: r.section ?? null, locale: null, notes: null })),
    country ?? defaultCountryFor(event.timezone),
  );
  return ok(result, { status: 201 });
});
