import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { applyPaidOrder, cancelOrder, markOrderRefunded } from "@/server/payments/service";
import { paging, type SearchParams, oneOf, str } from "./params";

export const ORDER_STATUSES: OrderStatus[] = ["PENDING", "PAID", "CANCELLED", "REFUNDED", "FAILED"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"];
export const PAYMENT_PROVIDERS = ["mock", "manual", "stripe"] as const;

function searchWhere(q: string): Prisma.OrderWhereInput | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { id: q },
      { eventId: q },
      { userId: q },
      { providerRef: q },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { event: { title: { contains: q, mode: "insensitive" } } },
    ],
  };
}

export async function listOrders(sp: SearchParams) {
  const q = str(sp, "q");
  const status = oneOf(sp, "status", ORDER_STATUSES);
  const provider = oneOf(sp, "provider", PAYMENT_PROVIDERS);
  const { page, pageSize, skip, take } = paging(sp);
  const where: Prisma.OrderWhereInput = { ...(status ? { status } : {}), ...(provider ? { provider } : {}), ...(searchWhere(q) ?? {}) };
  const [total, rows] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, title: true, plan: true } },
        _count: { select: { payments: true } },
      },
    }),
  ]);
  return { total, page, pageSize, rows };
}

export async function listPayments(sp: SearchParams) {
  const q = str(sp, "q");
  const status = oneOf(sp, "pstatus", PAYMENT_STATUSES);
  const provider = oneOf(sp, "provider", PAYMENT_PROVIDERS);
  const { page, pageSize, skip, take } = paging(sp);
  const where: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(provider ? { provider } : {}),
    ...(q ? { OR: [{ orderId: q }, { providerPaymentId: q }, { order: searchWhere(q) }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { order: { select: { id: true, plan: true, status: true, user: { select: { id: true, name: true, email: true } }, event: { select: { id: true, title: true } } } } },
    }),
  ]);
  return { total, page, pageSize, rows };
}

export async function paymentSummary() {
  const [paid, refunded, pending] = await Promise.all([
    db.order.groupBy({ by: ["currency"], where: { status: "PAID", amount: { gt: 0 } }, _sum: { amount: true }, _count: { _all: true } }),
    db.order.groupBy({ by: ["currency"], where: { status: "REFUNDED" }, _sum: { amount: true }, _count: { _all: true } }),
    db.order.groupBy({ by: ["provider"], where: { status: "PENDING" }, _count: { _all: true } }),
  ]);
  const comps = await db.order.count({ where: { status: "PAID", amount: 0 } });
  return {
    paid: paid.map((r) => ({ currency: r.currency, amount: r._sum.amount ?? 0, count: r._count._all })),
    refunded: refunded.map((r) => ({ currency: r.currency, amount: r._sum.amount ?? 0, count: r._count._all })),
    pending: Object.fromEntries(pending.map((r) => [r.provider, r._count._all])) as Record<string, number>,
    comps,
  };
}

/** Record a payment received outside INVTRA (bank transfer, invoice) and activate the plan. */
export async function adminMarkPaid(actorId: string, orderId: string, note: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  if (order.status === "PAID") throw badRequest("already_paid", "This order is already paid.");
  const r = await applyPaidOrder(orderId, { provider: "manual", providerPaymentId: null, actorId, note: `Marked paid by admin: ${note}`, raw: { markedBy: actorId, reference: note } });
  await audit(actorId, "admin.order.mark_paid", "order", orderId, { note, previousStatus: order.status, amount: order.amount, currency: order.currency, eventId: order.eventId });
  return r;
}

export async function adminRefund(actorId: string, orderId: string, note: string, revokePlan: boolean) {
  const r = await markOrderRefunded(orderId, { note: `Refunded (admin): ${note}`, revokePlan });
  if (!r.changed) throw badRequest("already_refunded", "This order is already refunded.");
  await audit(actorId, "admin.order.refund", "order", orderId, { note, revokePlan, plan: r.plan ?? null, amount: r.order.amount, currency: r.order.currency });
  return r;
}

export async function adminCancel(actorId: string, orderId: string, note: string) {
  const r = await cancelOrder(orderId, { note: note ? `Cancelled (admin): ${note}` : "Cancelled by admin" });
  if (!r.changed) throw badRequest("already_cancelled", "This order is already cancelled.");
  await audit(actorId, "admin.order.cancel", "order", orderId, { note });
  return r;
}
