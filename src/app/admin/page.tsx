import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw, XCircle } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { getOverview } from "@/server/admin/overview";
import { ActivityChart } from "@/components/admin/activity-chart";
import { AdminAction } from "@/components/admin/actions";
import { DataTable, Muted, PageHeader, SectionTitle, StatTile, StatusBadge } from "@/components/admin/ui";
import { dt, duration, money, num, pct, plural, rel } from "@/components/admin/format";
import { truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  await requireAdmin();
  const o = await getOverview();
  const q = o.queue;
  const backlog = q.oldestPendingMs !== null && q.oldestPendingMs > 5 * 60_000;

  return (
    <>
      <PageHeader eyebrow="INVTRA staff" title="Overview" description="Usage, delivery, revenue and system health at a glance." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Customers" value={num(o.customers.total)} hint={`+${num(o.customers.new7d)} in the last 7 days`} href="/admin/customers" />
        <StatTile label="Events" value={num(o.events.total)} hint={`${num(o.events.upcoming)} upcoming · ${num(o.events.deactivated)} deactivated`} href="/admin/events" />
        <StatTile label="Guests" value={num(o.guests)} hint={`${num(o.rsvp.messaged)} messaged`} href="/admin/guests" />
        <StatTile
          label="Revenue"
          tone="bronze"
          value={o.revenue.length ? money(o.revenue[0].amount, o.revenue[0].currency) : money(0, "USD")}
          hint={
            o.revenue.length > 1
              ? o.revenue.slice(1).map((r) => money(r.amount, r.currency)).join(" · ")
              : plural(o.revenue.reduce((s, r) => s + r.orders, 0), "paid order")
          }
          href="/admin/payments"
        >
          {o.revenue30d.length ? `Last 30 days: ${o.revenue30d.map((r) => money(r.amount, r.currency)).join(" · ")}` : "No payments in the last 30 days"}
          {o.pendingOrders ? <span className="block text-ink-faint">{plural(o.pendingOrders, "order")} awaiting payment</span> : null}
        </StatTile>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Messages sent" tone="slate" value={num(o.messages.sent24h)} hint="last 24 hours" href="/admin/messages">
          <span className="tabular-nums">{num(o.messages.sent7d)}</span> in 7 days · <span className="tabular-nums">{num(o.messages.sent30d)}</span> in 30 days
        </StatTile>
        <StatTile label="Accepted" tone="sage" value={pct(o.rsvp.accepted, o.rsvp.messaged)} hint={`${num(o.rsvp.accepted)} of ${num(o.rsvp.messaged)} messaged guests`}>
          Declined {pct(o.rsvp.declined, o.rsvp.messaged)} · No answer {pct(o.rsvp.noResponse, o.rsvp.messaged)}
        </StatTile>
        <StatTile
          label="Failed messages"
          tone={o.messages.failed7d ? "rosewood" : "default"}
          value={num(o.messages.failed7d)}
          hint="last 7 days"
          href="/admin/messages?status=FAILED"
        />
        <StatTile label="Views & scans" tone="bronze" value={num(o.engagement.views)} hint="invitation page views" href="/admin/scans">
          <span className="tabular-nums">{num(o.engagement.scans)}</span> QR scans · +{num(o.engagement.views7d)} views, +{num(o.engagement.scans7d)} scans this week
        </StatTile>
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-paper p-5 shadow-soft sm:p-6" aria-labelledby="activity-title">
        <SectionTitle title={<span id="activity-title">Last 14 days</span>} description="WhatsApp messages sent and invitations accepted per day (UTC)." />
        <ActivityChart days={o.chart} />
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="queue-title">
          <SectionTitle
            title={<span id="queue-title">Queue health</span>}
            description={
              q.oldestPendingMs === null
                ? "No jobs are waiting."
                : `Oldest runnable job has waited ${duration(q.oldestPendingMs)} (${q.oldestPendingType}).`
            }
          />
          <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center shadow-soft sm:grid-cols-6">
            {(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const).map((s) => (
              <div key={s} className="bg-paper px-2 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">{s.toLowerCase()}</p>
                <p className={`mt-1 font-display text-2xl lining-nums tabular-nums ${s === "FAILED" && q.counts.FAILED ? "text-rosewood" : s === "PENDING" && backlog ? "text-ochre" : "text-ink"}`}>
                  {num(q.counts[s])}
                </p>
              </div>
            ))}
            <div className="bg-paper px-2 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">oldest wait</p>
              <p className={`mt-1 font-display text-2xl lining-nums ${backlog ? "text-ochre" : "text-ink"}`}>{q.oldestPendingMs === null ? "—" : duration(q.oldestPendingMs)}</p>
            </div>
          </div>
          <DataTable
            caption="Recently failed jobs"
            rows={q.failed}
            rowKey={(j) => j.id}
            empty="No failed jobs. The queue is healthy."
            columns={[
              {
                key: "job",
                header: "Failed job",
                cell: (j) => (
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{j.type}</p>
                    <p className="mt-0.5 line-clamp-2 break-words text-[12.5px] text-ink-faint" title={j.lastError ?? undefined}>
                      {j.lastError ? truncate(j.lastError, 160) : "No error recorded"}
                    </p>
                  </div>
                ),
              },
              { key: "when", header: "Failed", cell: (j) => <span className="whitespace-nowrap" title={dt(j.completedAt ?? j.updatedAt)}>{rel(j.completedAt ?? j.updatedAt)}</span>, hideBelow: "sm" },
              { key: "attempts", header: "Tries", align: "end", cell: (j) => `${j.attempts}/${j.maxAttempts}`, hideBelow: "sm" },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "end",
                cell: (j) => (
                  <div className="flex justify-end gap-1.5">
                    <AdminAction url={`/api/admin/jobs/${j.id}`} body={{ action: "retry" }} label="Retry" icon={<RotateCcw className="size-3.5" />} successMessage="Job queued to run again" />
                    <AdminAction
                      url={`/api/admin/jobs/${j.id}`}
                      body={{ action: "dismiss" }}
                      label="Dismiss"
                      variant="ghost"
                      icon={<XCircle className="size-3.5" />}
                      successMessage="Job dismissed"
                      title="Mark as cancelled without running it again"
                    />
                  </div>
                ),
              },
            ]}
          />
        </section>

        <section aria-labelledby="errors-title">
          <SectionTitle
            title={<span id="errors-title">Recent errors</span>}
            description={o.errors.unresolved ? `${num(o.errors.unresolved)} unresolved` : "Nothing unresolved."}
            action={
              <Link href="/admin/errors" className="text-[13px] text-bronze-700 underline-offset-4 hover:underline">
                View all
              </Link>
            }
          />
          <DataTable
            caption="Latest unresolved errors"
            rows={o.errors.latest}
            rowKey={(e) => e.id}
            empty="No unresolved errors."
            columns={[
              {
                key: "msg",
                header: "Error",
                cell: (e) => (
                  <Link href={`/admin/errors?source=${encodeURIComponent(e.source)}`} className="block min-w-0">
                    <p className="flex items-center gap-2 text-[12px] text-ink-faint">
                      <StatusBadge status={e.level === "warn" ? "PAUSED" : "FAILED"} label={e.level} />
                      <span className="truncate">{e.source}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 break-words text-ink">{e.message}</p>
                  </Link>
                ),
              },
              { key: "when", header: "When", align: "end", cell: (e) => <Muted><span title={dt(e.createdAt)}>{rel(e.createdAt)}</span></Muted> },
            ]}
          />
        </section>
      </div>
    </>
  );
}
