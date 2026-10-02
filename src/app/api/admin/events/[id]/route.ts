import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { deactivateEvent, grantEventPlan, reactivateEvent } from "@/server/admin/events";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deactivate"), reason: z.string().trim().min(3, "Give a reason").max(500) }),
  z.object({ action: z.literal("reactivate"), reason: z.string().trim().max(500).default("") }),
  z.object({
    action: z.literal("grant_plan"),
    plan: z.enum(["BASIC", "PREMIUM", "CUSTOM"]),
    guestLimit: z.coerce.number().int().min(1, "At least 1").max(100_000, "At most 100,000"),
    note: z.string().trim().min(3, "Add a note (e.g. the reason or deal reference)").max(500),
  }),
]);

/** Deactivate / reactivate an event, or grant it a plan. */
export const POST = route<Ctx>("admin.events.action", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  const input = await parseJson(req, schema);
  switch (input.action) {
    case "deactivate": {
      const r = await deactivateEvent(admin.id, id, input.reason);
      return ok({ message: `Event deactivated · ${r.jobs} pending job${r.jobs === 1 ? "" : "s"} cancelled` });
    }
    case "reactivate":
      await reactivateEvent(admin.id, id, input.reason);
      return ok({ message: "Event reactivated" });
    case "grant_plan": {
      const r = await grantEventPlan(admin.id, id, input);
      return ok({ message: `${input.plan.charAt(0) + input.plan.slice(1).toLowerCase()} plan granted · up to ${r.event.guestLimit} guests` });
    }
  }
});
