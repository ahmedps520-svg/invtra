import { db } from "@/server/db";
import { ok, requireApiUser, route } from "@/server/http";
import { serializeCustomerOrder } from "@/server/payments/service";

/** The signed-in customer's own orders, newest first. */
export const GET = route("billing.orders", async () => {
  const user = await requireApiUser();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { event: { select: { title: true } } },
  });
  return ok({ orders: orders.map(serializeCustomerOrder) });
});
