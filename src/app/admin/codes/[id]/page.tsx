import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Power, Trash2 } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { getPromoCode } from "@/server/admin/promo";
import { describeDiscount } from "@/server/payments/promo";
import { appUrl } from "@/server/env";
import { AdminAction } from "@/components/admin/actions";
import { CopyLink, PromoEditForm } from "@/components/admin/promo-form";
import { CodeStateBadge, planScope } from "@/components/admin/promo-ui";
import { DataTable, KeyValues, LinkCell, Mono, Muted, PageHeader, SectionTitle, StatTile, StatusBadge } from "@/components/admin/ui";
import { day, dt, money, num, pct } from "@/components/admin/format";
import { planName } from "@/lib/plans";

export const metadata: Metadata = { title: "Discount code" };

/** "2026-10-31" (Riyadh) for an end-of-day instant. */
function riyadhDay(endsAt: Date | null) {
  if (!endsAt) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date(endsAt.getTime() - 1));
}

export default async function CodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getPromoCode(id);
  if (!data) notFound();
  const { code, stats, orders, signups } = data;
  const link = appUrl(`/?code=${encodeURIComponent(code.code)}`);
  const currency = code.currency ?? orders[0]?.currency ?? "SAR";
  const signupsPaid = signups.filter((u) => u._count.orders > 0).length;

  return (
    <>
      <Link href="/admin/codes" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-faint transition hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Discount codes
      </Link>
      <PageHeader
        eyebrow="Discount code"
        title={<span className="font-mono tracking-[0.04em]">{code.code}</span>}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {describeDiscount(code)} · {planScope(code.plans)}
            <CodeStateBadge state={stats.state} />
          </span>
        }
        actions={
          <>
            <CopyLink url={link} />
            <AdminAction
              url={`/api/admin/codes/${code.id}`}
              body={{ action: code.active ? "deactivate" : "activate" }}
              label={code.active ? "Switch off" : "Switch on"}
              icon={<Power className="size-3.5" />}
              variant={code.active ? "outline" : "primary"}
              confirm={
                code.active
                  ? { title: `Switch off ${code.code}?`, description: "Customers can't use it any more. Orders already placed with it stay as they are.", confirmLabel: "Switch off", tone: "danger" }
                  : undefined
              }
            />
            {orders.length === 0 ? (
              <AdminAction
                url={`/api/admin/codes/${code.id}`}
                body={{ action: "delete" }}
                label="Delete"
                icon={<Trash2 className="size-3.5" />}
                variant="danger"
                confirm={{ title: `Delete ${code.code}?`, description: "Nobody has used it yet, so it can be removed completely.", confirmLabel: "Delete", tone: "danger" }}
              />
            ) : null}
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Paid orders" value={num(stats.paid)} hint={code.maxUses !== null ? `of ${num(code.maxUses)} allowed` : stats.pending ? `${num(stats.pending)} awaiting payment` : undefined} tone="sage" />
        <StatTile label="Revenue" value={money(stats.revenue, currency)} hint="What customers paid" tone="bronze" />
        <StatTile label="Discount given" value={money(stats.discount, currency)} tone="ochre" />
        <StatTile label="Sign-ups from the link" value={num(signups.length)} hint={signups.length ? `${pct(signupsPaid, signups.length)} of them have paid` : "Nobody yet"} tone="slate" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <section className="rounded-2xl border border-line bg-paper px-5 py-3 shadow-soft">
            <KeyValues
              items={[
                { label: "Discount", value: describeDiscount(code) },
                { label: "Works for", value: planScope(code.plans) },
                { label: "Per customer", value: code.onePerCustomer ? "Once" : "No limit" },
                { label: "Starts", value: code.startsAt ? dt(code.startsAt) : <Muted>Straight away</Muted> },
                { label: "Ends", value: code.endsAt ? dt(code.endsAt) : <Muted>No end date</Muted> },
                { label: "Share link", value: <Mono className="break-all">{link}</Mono> },
                { label: "Created", value: dt(code.createdAt) },
                ...(code.note ? [{ label: "Note", value: code.note }] : []),
              ]}
            />
          </section>
          <PromoEditForm id={code.id} note={code.note ?? ""} maxUses={code.maxUses} endsOn={riyadhDay(code.endsAt)} />
        </aside>

        <div className="min-w-0 space-y-10">
          <section>
            <SectionTitle title="Orders" description="Every order placed with this code, newest first." />
            <DataTable
              caption="Orders with this code"
              rows={orders}
              rowKey={(o) => o.id}
              empty="No orders with this code yet."
              columns={[
                { key: "date", header: "Date", cell: (o) => day(o.paidAt ?? o.createdAt) },
                { key: "customer", header: "Customer", cell: (o) => <LinkCell href={`/admin/customers/${o.user.id}`} sub={o.user.email}>{o.user.name}</LinkCell> },
                {
                  key: "event",
                  header: "Event",
                  cell: (o) => (o.event ? <Link href={`/admin/events/${o.event.id}`} className="hover:underline">{o.event.title}</Link> : <Muted>Deleted</Muted>),
                  hideBelow: "md",
                },
                { key: "plan", header: "Plan", cell: (o) => planName(o.plan), hideBelow: "sm" },
                { key: "paid", header: "Paid", align: "end", cell: (o) => money(o.amount, o.currency) },
                { key: "discount", header: "Discount", align: "end", cell: (o) => <span className="text-sage">−{money(o.discount, o.currency)}</span>, hideBelow: "sm" },
                { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
              ]}
            />
          </section>
          <section>
            <SectionTitle title="Sign-ups from the link" description="Accounts created by people who first arrived through this code's link." />
            <DataTable
              caption="Sign-ups from this code's link"
              rows={signups}
              rowKey={(u) => u.id}
              empty="Nobody has signed up through the link yet."
              columns={[
                { key: "name", header: "Customer", cell: (u) => <LinkCell href={`/admin/customers/${u.id}`} sub={u.email}>{u.name}</LinkCell> },
                { key: "joined", header: "Joined", cell: (u) => day(u.createdAt) },
                {
                  key: "paid",
                  header: "Paid orders",
                  align: "end",
                  cell: (u) => (u._count.orders ? <StatusBadge status="PAID" label={num(u._count.orders)} /> : <Muted>—</Muted>),
                },
              ]}
            />
          </section>
        </div>
      </div>
    </>
  );
}
