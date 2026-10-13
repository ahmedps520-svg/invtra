import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { deletePromoCode, promoUpdateSchema, updatePromoCode } from "@/server/admin/promo";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.union([
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("delete") }),
  promoUpdateSchema.extend({ action: z.literal("update") }),
]);

/** Switch a code on or off, change its note / limit / end date, or delete it (unused codes only). */
export const POST = route<Ctx>("admin.codes.action", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  const input = await parseJson(req, schema);
  if (input.action === "delete") {
    await deletePromoCode(admin.id, id);
    return ok({ message: "Code deleted", redirectTo: "/admin/codes" });
  }
  if (input.action === "activate" || input.action === "deactivate") {
    const c = await updatePromoCode(admin.id, id, { active: input.action === "activate" });
    return ok({ message: `${c.code} ${c.active ? "switched on" : "switched off"}` });
  }
  const { action, ...patch } = input;
  void action;
  const c = await updatePromoCode(admin.id, id, patch);
  return ok({ message: `${c.code} saved` });
});
