import { ok, requireApiAdmin, route } from "@/server/http";
import { removeFinalFile } from "@/server/orders/service";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Remove a final file uploaded by mistake (only before the order is ready). */
export const DELETE = route<Ctx>("admin.orders.files.delete", async (_req, ctx) => {
  const admin = await requireApiAdmin();
  const { id, fileId } = await ctx.params;
  await removeFinalFile(admin.id, id, fileId);
  return ok({ message: "File removed" });
});
