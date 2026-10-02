import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { checkoutUrls, planLabel } from "@/server/payments/service";
import { loadMockOrder, mockCheckoutEnabled } from "@/server/payments/mock-checkout";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney, formatNumber } from "@/lib/format";
import { MockCheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false, follow: false } };

export default async function MockCheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser(`/billing/mock-checkout/${encodeURIComponent(orderId)}`);
  if (!mockCheckoutEnabled()) notFound();
  const order = await loadMockOrder(user.id, orderId).catch(() => null);
  if (!order) notFound();

  const urls = order.eventId ? checkoutUrls(order.eventId) : null;
  const upgrade = order.event?.plan && order.event.plan !== order.plan && order.status === "PENDING";

  return (
    <div dir="ltr" lang="en" className="min-h-dvh bg-ivory">
      <div className="border-b border-ochre/30 bg-ochre-soft">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-4 py-2 text-center text-[12px] font-medium uppercase tracking-[0.2em] text-ochre">
          <FlaskConical className="size-3.5" aria-hidden="true" />
          Test mode — no real payment is taken
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Logo />
          <Badge tone="ochre" dot>
            TEST MODE
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section aria-labelledby="summary" className="rounded-2xl border border-line bg-paper p-6 shadow-soft sm:p-8">
            <p className="eyebrow">Order summary</p>
            <h1 id="summary" className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
              INVTRA {planLabel(order.plan)}
            </h1>
            {order.event ? <p className="mt-2 text-sm text-ink-soft">{order.event.title}</p> : null}

            <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-faint">Plan</dt>
                <dd className="text-ink">
                  {planLabel(order.plan)}
                  {upgrade ? <span className="ms-2 text-ink-faint">(upgrade from {planLabel(order.event!.plan!)})</span> : null}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-faint">Guests</dt>
                <dd className="tabular-nums text-ink">Up to {formatNumber(order.guestLimit, "en")}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-faint">Order</dt>
                <dd className="truncate text-[13px] tracking-wide text-ink-soft">{order.id}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-faint">Billed to</dt>
                <dd className="truncate text-ink">{order.user.email}</dd>
              </div>
            </dl>

            <div className="mt-6 flex items-baseline justify-between gap-4">
              <span className="text-sm text-ink-soft">Total due</span>
              <span className="font-display text-4xl text-ink lining-nums">{formatMoney(order.amount, order.currency, "en")}</span>
            </div>
            <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-ink-faint">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-bronze-600" aria-hidden="true" />
              This page simulates the payment provider for development. In production customers are sent to the secure hosted checkout.
            </p>
          </section>

          <section aria-label="Payment" className="rounded-2xl border border-line bg-paper p-6 shadow-soft sm:p-8">
            {order.status === "PENDING" ? (
              <MockCheckoutForm orderId={order.id} defaultName={order.user.name} amountLabel={formatMoney(order.amount, order.currency, "en")} />
            ) : (
              <div className="flex h-full flex-col items-start justify-center py-6">
                <Badge tone={order.status === "PAID" ? "sage" : "neutral"}>{order.status}</Badge>
                <h2 className="mt-4 font-display text-3xl text-ink">
                  {order.status === "PAID" ? "This order has been paid." : "This order is no longer open."}
                </h2>
                <p className="mt-2 text-sm text-ink-faint">
                  {order.status === "PAID" ? "Your plan is active on the event." : "Start a new checkout from your event to choose a plan."}
                </p>
                <Link
                  href={(order.status === "PAID" ? urls?.successUrl : urls?.cancelUrl) ?? "/dashboard"}
                  className={buttonClasses("primary", "md", "mt-8")}
                >
                  Back to your event
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
