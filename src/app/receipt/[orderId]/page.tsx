import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { companyDetails } from "@/server/legal";
import { ensureReceiptNumber } from "@/server/payments/receipts";
import { PAY_COPY } from "@/lib/i18n/pay-copy";
import { Logo } from "@/components/brand/logo";
import { Receipt } from "@/components/billing/receipt";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

/** Receipt for a paid order — its owner or INVTRA staff only. */
export default async function ReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser(`/receipt/${orderId}`);
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      event: { select: { title: true, titleAr: true, timezone: true } },
      payments: { where: { status: { in: ["SUCCEEDED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order || (order.userId !== user.id && user.role !== "ADMIN") || (order.status !== "PAID" && order.status !== "REFUNDED")) notFound();
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const receiptNumber = order.receiptNumber ?? (await ensureReceiptNumber(order.id)) ?? "—";
  const pay = order.payments[0];
  const raw = (pay?.raw ?? {}) as { method?: string | null };
  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-dvh bg-ivory print:bg-white">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 print:max-w-none print:p-0">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link href="/dashboard/billing" aria-label="INVTRA">
            <Logo markClassName="h-8" />
          </Link>
        </div>
        <Receipt
          t={PAY_COPY[locale]}
          ar={ar}
          company={companyDetails()}
          data={{
            receiptNumber,
            paidAt: order.paidAt ?? order.updatedAt,
            plan: order.plan,
            guestLimit: order.guestLimit,
            amount: order.amount,
            currency: order.currency,
            title: order.title,
            customer: { name: order.user.name, email: order.user.email, phone: order.user.phone },
            event: order.event ? { title: order.event.title, titleAr: order.event.titleAr, timezone: order.event.timezone } : null,
            payment: pay ? { provider: pay.provider, reference: pay.providerPaymentId, method: raw.method ?? null } : null,
            refunded: order.status === "REFUNDED",
          }}
        />
      </div>
    </div>
  );
}
