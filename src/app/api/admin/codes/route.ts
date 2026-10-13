import type { NextRequest } from "next/server";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { createPromoCode, promoInputSchema } from "@/server/admin/promo";

/** Create a discount code. */
export const POST = route("admin.codes.create", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const input = await parseJson(req, promoInputSchema);
  const code = await createPromoCode(admin.id, input);
  return ok({ message: `${code.code} created`, redirectTo: `/admin/codes/${code.id}` }, { status: 201 });
});
