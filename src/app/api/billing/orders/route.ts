import { db } from "@/server/db";
import { ok, requireApiUser, route } from "@/server/http";
import { serializeCustomerOrder } from "@/server/payments/service";
import { manualInstructions } from "@/server/payments/manual";

/** The signed-in customer's own orders, newest first. */
export const GET = route("billing.orders", async () => {
  const user = await requireApiUser();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { event: { select: { title: true } } },
  });
  const instructions = await manualInstructions(user.locale === "ar" ? "ar" : "en");
  return ok({ orders: orders.map((o) => serializeCustomerOrder(o, instructions)) });
});
