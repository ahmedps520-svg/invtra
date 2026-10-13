import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { listPromoCodes } from "@/server/admin/promo";
import { paymentCurrency } from "@/server/payments/service";
import { describeDiscount } from "@/server/payments/promo";
import { DataTable, LinkCell, Muted, PageHeader, StatTile } from "@/components/admin/ui";
import { PromoCodeForm } from "@/components/admin/promo-form";
import { CodeStateBadge, planScope } from "@/components/admin/promo-ui";
import { day, money, num } from "@/components/admin/format";

export const metadata: Metadata = { title: "Discount codes" };

export default async function CodesPage() {
  await requireAdmin();
  const codes = await listPromoCodes();
  const currency = paymentCurrency();
  const total = codes.reduce(
    (t, c) => ({ paid: t.paid + c.stats.paid, revenue: t.revenue + c.stats.revenue, discount: t.discount + c.stats.discount, signups: t.signups + c.stats.signups }),
    { paid: 0, revenue: 0, discount: 0, signups: 0 },
  );
  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Discount codes"
        description="Codes for ads, influencers and partners. Each one has a link that applies it at checkout, and you can see the sign-ups and paid orders it brought in."
        actions={<PromoCodeForm currency={currency} />}
      />
      {codes.length ? (
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Paid orders with a code" value={num(total.paid)} tone="sage" />
          <StatTile label="Revenue from them" value={money(total.revenue, currency)} tone="bronze" />
          <StatTile label="Discount given" value={money(total.discount, currency)} tone="ochre" />
          <StatTile label="Sign-ups from code links" value={num(total.signups)} tone="slate" />
        </div>
      ) : null}
      <DataTable
        caption="Discount codes"
        rows={codes}
        rowKey={(c) => c.id}
        empty="No codes yet. Create one for your next ad or influencer."
        columns={[
          {
            key: "code",
            header: "Code",
            cell: (c) => (
              <LinkCell href={`/admin/codes/${c.id}`} sub={c.note ?? undefined}>
                <span className="font-mono tracking-[0.06em]">{c.code}</span>
              </LinkCell>
            ),
          },
          { key: "discount", header: "Discount", cell: (c) => <span>{describeDiscount(c)}</span> },
          { key: "plans", header: "Works for", cell: (c) => planScope(c.plans), hideBelow: "lg" },
          {
            key: "uses",
            header: "Paid orders",
            align: "end",
            cell: (c) => (
              <span className="tabular-nums">
                {num(c.stats.paid)}
                {c.maxUses !== null ? <span className="text-ink-faint"> / {num(c.maxUses)}</span> : null}
              </span>
            ),
          },
          { key: "revenue", header: "Revenue", align: "end", cell: (c) => (c.stats.revenue ? money(c.stats.revenue, currency) : <Muted>—</Muted>), hideBelow: "md" },
          {
            key: "signups",
            header: "Sign-ups",
            align: "end",
            cell: (c) => (
              <span className="tabular-nums" title="Accounts created after opening the code's link">
                {num(c.stats.signups)}
              </span>
            ),
            hideBelow: "md",
          },
          { key: "ends", header: "Ends", cell: (c) => (c.endsAt ? day(new Date(c.endsAt.getTime() - 1)) : <Muted>No end</Muted>), hideBelow: "lg" },
          { key: "state", header: "Status", cell: (c) => <CodeStateBadge state={c.stats.state} /> },
        ]}
      />
    </>
  );
}
