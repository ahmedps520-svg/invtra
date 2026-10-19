import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { bankDetails, formatIban, orderReference } from "@/server/payments/bank";
import { customerMayDownload } from "@/server/orders/files";
import { OrderDetail } from "@/components/dashboard/orders/order-detail";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { hasGuests, stagePath } from "@/lib/products";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dict } = await getI18n();
  return { title: dict.dashboard.orders.page.title.replace("{reference}", orderReference(id)) };
}

function size(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The customer's order: status, what staff need from them, how to pay, and their files once approved. */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const justSubmitted = (await searchParams).submitted === "1";
  const user = await requireUser(`/dashboard/orders/${id}`);
  const order = await db.order.findFirst({
    where: { id, userId: user.id },
    include: {
      event: { select: { id: true, title: true, titleAr: true } },
      files: { orderBy: { createdAt: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  const { dict, locale } = await getI18n();
  const ar = locale === "ar";
  const first = (stage: string) => order.history.find((h) => h.to === stage && h.from !== h.to)?.createdAt ?? null;
  const path = stagePath(order.product, order.designSource).map((stage) => {
    const at = first(stage);
    return { stage, at: at ? formatDateTime(at, { locale, timeZone: "Asia/Riyadh" }) : null };
  });
  const downloadable = customerMayDownload(order, "FINAL");
  const finals = order.files.filter((f) => f.kind === "FINAL");
  const awaiting = order.status === "PENDING" && ["DRAFT", "SUBMITTED", "PENDING_VERIFICATION"].includes(order.stage);
  const bank = awaiting ? await bankDetails() : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={order.event ? `/dashboard/events/${order.event.id}` : "/dashboard/billing"}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" />
        {dict.dashboard.orders.page.back}
      </Link>
      <OrderDetail
        justSubmitted={justSubmitted}
        order={{
          id: order.id,
          reference: orderReference(order.id),
          stage: order.stage,
          placed: formatDate(order.submittedAt ?? order.createdAt, { locale, timeZone: "Asia/Riyadh", style: "long" }),
          amount: formatMoney(order.amount, order.currency, locale),
          productName: order.product ? dict.dashboard.orders.products[order.product] : order.plan ? dict.common.plans[order.plan] : "",
          eventId: order.event?.id ?? null,
          eventTitle: order.event ? (ar && order.event.titleAr) || order.event.title : null,
          path,
          rejectionReason: order.stage === "REJECTED" ? order.rejectionReason : null,
          infoRequest: order.stage === "INFO_REQUIRED" ? order.infoRequest : null,
          transferReference: order.transferReference,
          receipts: order.files.filter((f) => f.kind === "RECEIPT").map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
          files: downloadable && finals.length ? finals.map((f) => ({ id: f.id, name: f.name, size: size(f.size) })) : null,
          receiptUrl: order.status === "PAID" || order.status === "REFUNDED" ? `/receipt/${order.id}` : null,
          receiptNumber: order.receiptNumber,
          guests: order.product ? hasGuests(order.product) : false,
          bank: bank ? { bank: ar ? bank.bankAr || bank.bank : bank.bank, name: bank.name, iban: formatIban(bank.iban), account: bank.account || null } : null,
        }}
      />
    </div>
  );
}
