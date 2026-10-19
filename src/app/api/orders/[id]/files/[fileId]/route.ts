import { db } from "@/server/db";
import { HttpError, notFound, requireApiUser, route } from "@/server/http";
import { audit } from "@/server/log";
import { customerMayDownload, fileResponse } from "@/server/orders/files";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/**
 * Download an order's file. Staff can open any; customers their own receipts, and final files
 * only once the payment has been approved and the order is ready (checked here, on the server).
 */
export const GET = route<Ctx>("orders.files", async (req, ctx) => {
  const user = await requireApiUser();
  const { id, fileId } = await ctx.params;
  const file = await db.orderFile.findFirst({
    where: { id: fileId, orderId: id },
    include: { order: { select: { userId: true, status: true, stage: true } } },
  });
  if (!file) throw notFound("File");
  const admin = user.role === "ADMIN";
  if (!admin) {
    if (file.order.userId !== user.id) throw notFound("File");
    if (!customerMayDownload(file.order, file.kind))
      throw new HttpError(403, "preview_only", "The full-quality file is available after your payment is approved.");
  } else if (file.order.userId !== user.id) {
    await audit(user.id, "admin.order.file_view", "order", id, { fileId, kind: file.kind });
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return fileResponse(file, { inline });
});
