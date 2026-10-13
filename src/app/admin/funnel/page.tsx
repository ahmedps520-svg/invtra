import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/guards";
import { FUNNEL_RANGES, formatWeek, funnel, funnelSources, type FunnelRange } from "@/server/admin/funnel";
import type { SearchParams } from "@/server/admin/params";
import { FilterBar } from "@/components/admin/filter-bar";
import { DataTable, Muted, PageHeader, SectionTitle, StatTile } from "@/components/admin/ui";
import { FunnelSteps, WeeklyChart } from "@/components/admin/funnel-view";
import { money, num, pct } from "@/components/admin/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Funnel" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function FunnelPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const weeks = (FUNNEL_RANGES as readonly number[]).includes(Number(one(sp.weeks))) ? (Number(one(sp.weeks)) as FunnelRange) : 12;
  const source = one(sp.source) || null;
  const [data, sources] = await Promise.all([funnel(weeks, source), funnelSources()]);
  const t = data.total;
  const who = source ? (sources.find((s) => s.value === source)?.label ?? source) : null;
  const href = (w: number) => `/admin/funnel?weeks=${w}${source ? `&source=${encodeURIComponent(source)}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Funnel"
        description="What happens to the people who sign up: who verifies, creates an event, adds guests, pays and sends — and where the ones who pay come from. Weeks start on Sunday, Riyadh time."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div role="radiogroup" aria-label="Period" className="inline-flex rounded-xl border border-line bg-paper p-1 shadow-soft">
          {FUNNEL_RANGES.map((w) => (
            <Link
              key={w}
              href={href(w)}
              role="radio"
              aria-checked={weeks === w}
              className={cn("rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors", weeks === w ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink")}
            >
              {w} weeks
            </Link>
          ))}
        </div>
        <FilterBar
          className="mb-0"
          values={{ weeks: String(weeks), source: source ?? "" }}
          fields={[{ type: "select", name: "source", label: "Source", allLabel: "All sources", options: sources.map((s) => ({ value: s.value, label: `${s.label} (${num(s.count)})` })) }]}
        />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Sign-ups" value={num(t.signedUp)} hint={`Since ${formatWeek(data.from)}`} tone="slate" />
        <StatTile label="Paid" value={num(t.paid)} hint={t.signedUp ? `${pct(t.paid, t.signedUp)} of sign-ups` : "No sign-ups yet"} tone="sage" />
        <StatTile
          label="Revenue"
          value={money(data.revenue.period, data.currency)}
          hint={`${num(data.revenue.orders)} paid orders${who ? ` · ${who}` : ", all customers"}`}
          tone="bronze"
        />
        <StatTile
          label="Average order"
          value={data.revenue.average !== null ? money(data.revenue.average, data.currency) : "—"}
          hint={data.revenue.payers ? `${num(data.revenue.payers)} paying customers` : undefined}
          tone="ochre"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6">
          <SectionTitle title="From sign-up to sent" description="Everyone who signed up in the period, and how far they got." />
          {t.signedUp ? <FunnelSteps total={t} continued={data.continued} /> : <p className="py-10 text-center text-[13.5px] text-ink-faint">Nobody signed up in this period.</p>}
        </section>
        <section className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6">
          <SectionTitle title="Week by week" description="Sign-ups each week, and how many of them have paid so far." />
          <WeeklyChart weekly={data.weekly} currency={data.currency} />
        </section>
      </div>

      <section className="mt-10">
        <SectionTitle title="Where they came from" description="First source seen before signing up: a discount code's link, an invitation's “create your invitation” link, an ad (utm_source), or direct." />
        <DataTable
          caption="Sign-ups by source"
          rows={data.sources}
          rowKey={(r) => r.source ?? "direct"}
          empty="No sign-ups in this period."
          columns={[
            {
              key: "source",
              header: "Source",
              cell: (r) =>
                r.codeId ? (
                  <Link href={`/admin/codes/${r.codeId}`} className="font-medium text-ink hover:underline">
                    {r.label}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{r.label}</span>
                ),
            },
            { key: "signups", header: "Sign-ups", align: "end", cell: (r) => <span className="tabular-nums">{num(r.signedUp)}</span> },
            { key: "event", header: "Created an event", align: "end", cell: (r) => <Rate part={r.createdEvent} whole={r.signedUp} />, hideBelow: "md" },
            { key: "paid", header: "Paid", align: "end", cell: (r) => <Rate part={r.paid} whole={r.signedUp} /> },
            { key: "revenue", header: "Revenue", align: "end", cell: (r) => (r.revenue ? money(r.revenue, data.currency) : <Muted>—</Muted>), hideBelow: "sm" },
          ]}
        />
      </section>

      <section className="mt-10">
        <SectionTitle title="Weekly detail" description="Each week's sign-ups and how far they've got so far — later weeks have had less time." />
        <DataTable
          caption="Weekly funnel"
          rows={[...data.weekly].reverse()}
          rowKey={(w) => w.week}
          empty="No weeks in this period."
          columns={[
            { key: "week", header: "Week of", cell: (w) => formatWeek(w.week) },
            { key: "signups", header: "Sign-ups", align: "end", cell: (w) => <span className="tabular-nums">{num(w.signedUp)}</span> },
            { key: "verified", header: "Verified", align: "end", cell: (w) => <Rate part={w.verified} whole={w.signedUp} />, hideBelow: "lg" },
            { key: "event", header: "Event", align: "end", cell: (w) => <Rate part={w.createdEvent} whole={w.signedUp} />, hideBelow: "md" },
            { key: "guests", header: "Guests", align: "end", cell: (w) => <Rate part={w.addedGuests} whole={w.signedUp} />, hideBelow: "lg" },
            { key: "paid", header: "Paid", align: "end", cell: (w) => <Rate part={w.paid} whole={w.signedUp} /> },
            { key: "sent", header: "Sent", align: "end", cell: (w) => <Rate part={w.sent} whole={w.signedUp} />, hideBelow: "md" },
            { key: "revenue", header: "Revenue", align: "end", cell: (w) => (w.revenue ? money(w.revenue, data.currency) : <Muted>—</Muted>), hideBelow: "sm" },
          ]}
        />
      </section>
    </>
  );
}

/** "12 · 40%" — a count and its share, aligned in columns. */
function Rate({ part, whole }: { part: number; whole: number }) {
  if (!whole) return <Muted>—</Muted>;
  return (
    <span className="tabular-nums">
      {num(part)} <span className="text-ink-faint">· {pct(part, whole)}</span>
    </span>
  );
}
