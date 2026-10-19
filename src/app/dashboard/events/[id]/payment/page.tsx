import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { ownerEventOrList } from "@/app/dashboard/_lib/access";
import { bankDetails, formatIban, orderReference } from "@/server/payments/bank";
import { orderGaps, orderInReview, prepareOrder } from "@/server/orders/service";
import { isUnlocked } from "@/server/render/preview";
import { PaymentForm } from "@/components/dashboard/wizard/payment-form";
import { formatMoney } from "@/lib/format";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.orders.payment.title };
}

/** Step 6: submit the order and pay by bank transfer (staff confirm it before anything is delivered). */
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/payment`);
  const event = await ownerEventOrList(user.id, id);
  if (isUnlocked(event)) redirect(`/dashboard/events/${event.id}`);
  const inReview = await orderInReview(event.id);
  if (inReview) redirect(`/dashboard/orders/${inReview.id}`);
  if (orderGaps(event).length) redirect(`/dashboard/events/${event.id}/summary`);

  const { locale } = await getI18n();
  const [order, bank] = await Promise.all([prepareOrder(user, event), bankDetails()]);
  const receipts = await db.orderFile.findMany({ where: { orderId: order.id, kind: "RECEIPT" }, orderBy: { createdAt: "asc" } });
  return (
    <PaymentForm
      orderId={order.id}
      amount={formatMoney(order.amount, order.currency, locale)}
      reference={orderReference(order.id)}
      bank={{ bank: locale === "ar" ? bank.bankAr || bank.bank : bank.bank, name: bank.name, iban: formatIban(bank.iban), account: bank.account || null }}
      receipts={receipts.map((r) => ({ id: r.id, name: r.name, mimeType: r.mimeType }))}
      initialTransferRef={order.transferReference ?? ""}
    />
  );
}
