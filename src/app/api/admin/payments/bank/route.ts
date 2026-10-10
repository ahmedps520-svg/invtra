import type { NextRequest } from "next/server";
import { ok, requireApiAdmin, route } from "@/server/http";
import { audit } from "@/server/log";
import { saveBankDetails } from "@/server/payments/bank";

/** Admin: the bank account customers transfer to (shown on payment links and the billing page). */
export const POST = route("admin.payments.bank", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const saved = await saveBankDetails(await req.json().catch(() => null));
  await audit(admin.id, "admin.payments.bank", "settings", "payments.bank", { bank: saved.bank, iban: `…${saved.iban.slice(-4)}` });
  return ok({ message: "Bank details saved" });
});
