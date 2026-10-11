import type { Order, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { sendEmail } from "@/server/email";
import { renderEmail, renderEmailText } from "@/server/email-template";
import { receiptEmail } from "@/server/emails";
import { formatDate, formatMoney } from "@/lib/format";
import { isUnlimited } from "@/lib/plans";

/**
 * Receipts: every paid order gets a sequential number (INVTRA-2026-0001…), a printable
 * page (/pay/<token> for payment links, /receipt/<orderId> for signed-in customers) and
 * an email; custom packages also get a WhatsApp receipt (queue job "payment.receipt").
 */

/** Next receipt number for the year, e.g. INVTRA-2026-0007 (gap-free, inside the payment transaction). */
export async function nextReceiptNumber(tx: Prisma.TransactionClient, paidAt: Date): Promise<string> {
  const year = paidAt.getUTCFullYear();
  const [row] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "ReceiptCounter" ("year", "last") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last" = "ReceiptCounter"."last" + 1
    RETURNING "last"`;
  return `INVTRA-${year}-${String(row.last).padStart(4, "0")}`;
}

/** Receipt number for a paid order, assigning one to older orders that predate numbering. */
export async function ensureReceiptNumber(orderId: string): Promise<string | null> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "PAID") return null;
    if (order.receiptNumber) return order.receiptNumber;
    const n = await nextReceiptNumber(tx, order.paidAt ?? new Date());
    await tx.order.update({ where: { id: orderId }, data: { receiptNumber: n } });
    return n;
  });
}

export function receiptUrl(order: Pick<Order, "id" | "payToken">) {
  return order.payToken ? appUrl(`/pay/${order.payToken}`) : appUrl(`/receipt/${order.id}`);
}

/** Email the receipt (all paid orders) — WhatsApp receipts go through the queue for custom packages. */
export async function sendReceiptEmail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { name: true, email: true, locale: true } }, event: { select: { title: true, titleAr: true, timezone: true } } },
  });
  if (!order || order.status !== "PAID") return;
  const eventName = (ar: boolean) => (ar ? order.event?.titleAr || order.event?.title : order.event?.title) ?? "INVTRA";
  const number = order.receiptNumber ?? (await ensureReceiptNumber(order.id));
  const ar = order.user.locale === "ar";
  const amount = formatMoney(order.amount, order.currency, ar ? "ar" : "en");
  const link = receiptUrl(order);
  const when = formatDate(order.paidAt ?? new Date(), { locale: ar ? "ar" : "en", timeZone: order.event?.timezone ?? "Asia/Riyadh", style: "long" });
  const mail = receiptEmail({
    name: order.user.name,
    locale: order.user.locale,
    number: number ?? "",
    amount,
    paidOn: when,
    event: eventName(ar),
    link,
    eventId: order.eventId,
  });
  await sendEmail({ to: order.user.email, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail) });
}

/** "Unlimited guests" / "Up to 500 guests" (English or Arabic). */
export function guestsLabel(limit: number, ar: boolean) {
  if (isUnlimited(limit)) return ar ? "عدد غير محدود من الضيوف" : "Unlimited guests";
  return ar ? `حتى ${limit.toLocaleString("ar")} ضيف` : `Up to ${limit.toLocaleString("en")} guests`;
}
