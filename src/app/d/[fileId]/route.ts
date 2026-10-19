import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/http";
import { customerMayDownload, fileResponse, validDownloadSignature } from "@/server/orders/files";

type Ctx = { params: Promise<{ fileId: string }> };

/**
 * Download link from the delivery email: signed and expiring, so it works without signing in.
 * The order is still checked — a refunded order's link stops working. An expired link goes to
 * the order page (sign-in required).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { fileId } = await ctx.params;
  try {
    await enforceRateLimit(`dl:${clientIp(req)}`, 60, 600);
  } catch {
    return new NextResponse("Too many requests", { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const file = await db.orderFile.findUnique({ where: { id: fileId }, include: { order: { select: { id: true, status: true, stage: true } } } });
  const check = file ? validDownloadSignature(fileId, sp.get("exp"), sp.get("s")) : "invalid";
  if (!file || check === "invalid" || file.kind !== "FINAL") return new NextResponse("Not found", { status: 404 });
  if (check === "expired" || !customerMayDownload(file.order, file.kind)) {
    return NextResponse.redirect(appUrl(`/dashboard/orders/${file.order.id}`));
  }
  return fileResponse(file);
}
