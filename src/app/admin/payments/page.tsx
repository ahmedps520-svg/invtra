import type { Metadata } from "next";
import { planName } from "@/lib/plans";
import Link from "next/link";
import { Ban, CheckCircle2, Undo2 } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { env } from "@/server/env";
import { listOrders, listPayments, ORDER_STATUSES, PAYMENT_PROVIDERS, PAYMENT_STATUSES, paymentSummary } from "@/server/admin/payments";
import { currentParams, type SearchParams, str } from "@/server/admin/params";
import { AdminAction } from "@/components/admin/actions";
import { FilterBar } from "@/components/admin/filter-bar";
import { DataTable, LinkCell, Mono, Muted, PageHeader, Pagination, StatTile, StatusBadge, humanize } from "@/components/admin/ui";
import { dt, money, num, plural } from "@/components/admin/format";
import { cn, truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments & orders" };

const PROVIDER_LABEL: Record<string, string> = { mock: "Mock (test)", manual: "Manual", stripe: "Stripe", tap: "Tap Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view = str(sp, "view") === "payments" ? "payments" : "orders";
  const [summary, orders, payments] = await Promise.all([
    paymentSummary(),
    view === "orders" ? listOrders(sp) : null,
    view === "payments" ? listPayments(sp) : null,
  ]);
  const params = currentParams(sp, view === "orders" ? ["q", "status", "provider", "view"] : ["q", "pstatus", "provider", "view"]);
  const pendingTotal = Object.values(summary.pending).reduce((a, b) => a + b, 0);
  const tab = (v: "orders" | "payments") => (v === "orders" ? "/admin/payments" : "/admin/payments?view=payments");

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Payments & orders"
        description={`Checkout provider: ${PROVIDER_LABEL[env().PAYMENT_PROVIDER]} · prices in ${env().PAYMENT_CURRENCY}. Manual payments are confirmed here.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Revenue"
          tone="bronze"
          value={summary.paid.length ? money(summary.paid[0].amount, summary.paid[0].currency) : money(0, env().PAYMENT_CURRENCY)}
          hint={summary.paid.length > 1 ? summary.paid.slice(1).map((r) => money(r.amount, r.currency)).join(" · ") : plural(summary.paid.reduce((s, r) => s + r.count, 0), "paid order")}
        />
        <StatTile
          label="Awaiting payment"
          tone={summary.pending.manual ? "ochre" : "default"}
          value={num(pendingTotal)}
          hint={summary.pending.manual ? `${plural(summary.pending.manual, "manual order")} to confirm` : "No manual payments to confirm"}
          href="/admin/payments?status=PENDING"
        />
        <StatTile
          label="Refunded"
          tone="slate"
          value={num(summary.refunded.reduce((s, r) => s + r.count, 0))}
          hint={summary.refunded.length ? summary.refunded.map((r) => money(r.amount, r.currency)).join(" · ") : "No refunds"}
          href="/admin/payments?status=REFUNDED"
        />
        <StatTile label="Granted plans" value={num(summary.comps)} hint="Complimentary plans given by staff" />
      </div>

      <nav aria-label="View" className="mb-5 mt-10 flex gap-6 border-b border-line">
        {(["orders", "payments"] as const).map((v) => (
          <Link
            key={v}
            href={tab(v)}
            aria-current={view === v ? "page" : undefined}
            className={cn("-mb-px border-b-2 pb-3 text-sm font-medium transition", view === v ? "border-bronze-600 text-ink" : "border-transparent text-ink-faint hover:text-ink-soft")}
          >
            {v === "orders" ? "Orders" : "Payment attempts"}
          </Link>
        ))}
      </nav>

      {orders ? (
        <>
          <FilterBar
            values={params}
            fields={[
              { type: "search", name: "q", placeholder: "Order id, event, customer email" },
              { type: "select", name: "status", label: "Status", options: ORDER_STATUSES.map((s) => ({ value: s, label: humanize(s) })) },
              { type: "select", name: "provider", label: "Provider", options: PAYMENT_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABEL[p] })) },
            ]}
          />
          <DataTable
            caption="Orders"
            rows={orders.rows}
            rowKey={(o) => o.id}
            empty="No orders match these filters."
            columns={[
              {
                key: "order",
                header: "Order",
                cell: (o) => (
                  <div className="min-w-[180px]">
                    <p className="text-ink">
                      {planName(o.plan)} <span className="text-ink-faint">· {num(o.guestLimit)} guests</span>
                    </p>
                    <Mono className="text-ink-faint">{o.id}</Mono>
                    {o.note ? <p className="mt-0.5 line-clamp-2 max-w-[280px] text-[12px] text-ink-faint" title={o.note}>{truncate(o.note, 120)}</p> : null}
                  </div>
                ),
              },
              {
                key: "customer",
                header: "Customer / event",
                cell: (o) => (
                  <div className="min-w-0">
                    <LinkCell href={`/admin/customers/${o.user.id}`} sub={o.event ? <Link href={`/admin/events/${o.event.id}`} className="hover:text-ink hover:underline">{truncate(o.event.title, 40)}</Link> : "Event deleted"}>
                      {o.user.name}
                    </LinkCell>
                  </div>
                ),
                hideBelow: "md",
              },
              { key: "amount", header: "Amount", align: "end", cell: (o) => <span className="whitespace-nowrap text-ink">{money(o.amount, o.currency)}</span> },
              { key: "provider", header: "Provider", cell: (o) => PROVIDER_LABEL[o.provider] ?? o.provider, hideBelow: "lg" },
              {
                key: "date",
                header: "Created / paid",
                cell: (o) => (
                  <div className="whitespace-nowrap">
                    <p>{dt(o.createdAt)}</p>
                    {o.paidAt ? <p className="text-[12px] text-sage">Paid {dt(o.paidAt)}</p> : null}
                  </div>
                ),
                hideBelow: "sm",
              },
              { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "end",
                cell: (o) => (
                  <div className="flex justify-end gap-1.5">
                    {o.status === "PENDING" || o.status === "FAILED" || o.status === "CANCELLED" ? (
                      <AdminAction
                        url={`/api/admin/orders/${o.id}`}
                        body={{ action: "mark_paid" }}
                        label="Mark paid"
                        variant={o.provider === "manual" && o.status === "PENDING" ? "primary" : "outline"}
                        icon={<CheckCircle2 className="size-3.5" />}
                        confirm={{
                          title: "Mark this order paid?",
                          description: (
                            <>
                              Confirms {money(o.amount, o.currency)} was received and activates the {planName(o.plan)} plan on the event.
                              {o.provider !== "manual" ? ` This is a ${PROVIDER_LABEL[o.provider]} order — only do this if the payment was confirmed outside INVTRA.` : ""}
                            </>
                          ),
                          confirmLabel: "Mark paid",
                          reason: { label: "Payment reference", placeholder: "e.g. bank transfer ref. FT26275ABC", required: true },
                        }}
                      />
                    ) : null}
                    {o.status === "PAID" ? (
                      <AdminAction
                        url={`/api/admin/orders/${o.id}`}
                        body={{ action: "refund" }}
                        label={o.amount === 0 ? "Revoke" : "Refund"}
                        icon={<Undo2 className="size-3.5" />}
                        confirm={
                          o.amount === 0
                            ? {
                                title: "Revoke this granted plan?",
                                description: "Closes the complimentary order. With the option below the event falls back to the best plan from its other paid orders, or none.",
                                confirmLabel: "Revoke",
                                tone: "danger",
                                reason: { label: "Reason", placeholder: "Why is the grant revoked?", required: true },
                                checkbox: { field: "revokePlan", defaultChecked: true, label: "Also remove the plan from the event" },
                              }
                            : {
                                title: "Mark this order refunded?",
                                description: `Records that ${money(o.amount, o.currency)} was returned. Issue the refund itself in ${o.provider === "stripe" ? "the Stripe dashboard" : o.provider === "tap" ? "the Tap dashboard" : "your bank"} first.`,
                                confirmLabel: "Mark refunded",
                                tone: "danger",
                                reason: { label: "Reason", placeholder: "Why was this refunded?", required: true },
                                checkbox: { field: "revokePlan", label: "Also remove the plan from the event", description: "The event keeps the best plan from its other paid orders, or none." },
                              }
                        }
                      />
                    ) : null}
                    {o.status === "PENDING" || o.status === "FAILED" ? (
                      <AdminAction
                        url={`/api/admin/orders/${o.id}`}
                        body={{ action: "cancel" }}
                        label="Cancel"
                        variant="ghost"
                        icon={<Ban className="size-3.5" />}
                        confirm={{
                          title: "Cancel this order?",
                          description: "The customer can no longer pay it and must start a new checkout.",
                          confirmLabel: "Cancel order",
                          tone: "danger",
                          reason: { label: "Note", placeholder: "Optional note" },
                        }}
                      />
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination page={orders.page} pageSize={orders.pageSize} total={orders.total} basePath="/admin/payments" params={params} />
        </>
      ) : null}

      {payments ? (
        <>
          <FilterBar
            values={params}
            fields={[
              { type: "search", name: "q", placeholder: "Order id or provider payment id" },
              { type: "select", name: "pstatus", label: "Status", options: PAYMENT_STATUSES.map((s) => ({ value: s, label: humanize(s) })) },
              { type: "select", name: "provider", label: "Provider", options: PAYMENT_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABEL[p] })) },
            ]}
          />
          <DataTable
            caption="Payment attempts"
            rows={payments.rows}
            rowKey={(p) => p.id}
            empty="No payments match these filters."
            columns={[
              { key: "when", header: "Time", cell: (p) => <span className="whitespace-nowrap">{dt(p.createdAt)}</span> },
              {
                key: "order",
                header: "Order",
                cell: (p) => (
                  <div className="min-w-0">
                    <Link href={`/admin/payments?q=${p.order.id}`} className="text-ink underline-offset-4 hover:underline">
                      {planName(p.order.plan)} · {p.order.user.name}
                    </Link>
                    <p className="text-[12.5px] text-ink-faint">{p.order.event?.title ?? "Event deleted"}</p>
                  </div>
                ),
              },
              { key: "amount", header: "Amount", align: "end", cell: (p) => money(p.amount, p.currency) },
              { key: "provider", header: "Provider", cell: (p) => PROVIDER_LABEL[p.provider] ?? p.provider, hideBelow: "sm" },
              { key: "ref", header: "Provider reference", cell: (p) => (p.providerPaymentId ? <Mono>{p.providerPaymentId}</Mono> : <Muted>—</Muted>), hideBelow: "lg" },
              { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
            ]}
          />
          <Pagination page={payments.page} pageSize={payments.pageSize} total={payments.total} basePath="/admin/payments" params={params} />
        </>
      ) : null}
    </>
  );
}
