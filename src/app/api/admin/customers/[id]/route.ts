import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { deactivateCustomer, reactivateCustomer } from "@/server/admin/customers";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deactivate"), reason: z.string().trim().min(3, "Give a reason").max(500), alsoEvents: z.boolean().default(false) }),
  z.object({ action: z.literal("reactivate"), reason: z.string().trim().max(500).default(""), alsoEvents: z.boolean().default(false) }),
]);

/** Deactivate / reactivate a customer account. */
export const POST = route<Ctx>("admin.customers.action", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  const input = await parseJson(req, schema);
  if (input.action === "deactivate") {
    const r = await deactivateCustomer(admin.id, id, input);
    return ok({
      message: `Account deactivated · ${r.sessions} session${r.sessions === 1 ? "" : "s"} signed out${input.alsoEvents ? ` · ${r.events} event${r.events === 1 ? "" : "s"} deactivated` : ""}`,
    });
  }
  const r = await reactivateCustomer(admin.id, id, input);
  return ok({ message: `Account reactivated${input.alsoEvents ? ` · ${r.events} event${r.events === 1 ? "" : "s"} reactivated` : ""}` });
});
