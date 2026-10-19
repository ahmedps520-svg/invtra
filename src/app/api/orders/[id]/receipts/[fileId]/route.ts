import { ok, requireApiUser, route } from "@/server/http";
import { removeReceipt } from "@/server/orders/service";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export const DELETE = route<Ctx>("orders.receipts.delete", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id, fileId } = await ctx.params;
  await removeReceipt(user, id, fileId);
  return ok();
});
