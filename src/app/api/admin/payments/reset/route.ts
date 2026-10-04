import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { RESET_PHRASE, resetPaymentHistory } from "@/server/admin/tax";

/** Delete all payment history (test payments before going live). Needs the exact phrase. */
export const POST = route("admin.payments.reset", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const { confirm } = await parseJson(req, z.object({ confirm: z.string().max(100) }));
  if (confirm.trim() !== RESET_PHRASE) throw badRequest("confirm", `Type ${RESET_PHRASE} exactly to confirm.`);
  const r = await resetPaymentHistory(admin.id);
  return ok({ message: `Deleted ${r.orders} orders and ${r.payments} payment attempts — receipts start again at 0001.` });
});
