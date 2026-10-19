import type { NextRequest } from "next/server";
import { badRequest, ok, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { addReceipt } from "@/server/orders/service";

type Ctx = { params: Promise<{ id: string }> };

/** Upload a bank-transfer receipt (image or PDF) — evidence for staff, not proof of payment. */
export const POST = route<Ctx>("orders.receipts", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`receipt:${user.id}`, 30, 3600);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("missing_file", "Choose a file to upload.");
  const saved = await addReceipt(user, id, { name: file.name, data: Buffer.from(await file.arrayBuffer()) });
  return ok({ file: { id: saved.id, name: saved.name, mimeType: saved.mimeType, size: saved.size } }, { status: 201 });
});
