import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { DELIVERY_STATUSES, GUEST_STATUSES, searchGuests } from "@/server/admin/guests";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { failureReason } from "@/server/whatsapp/errors";
import { FilterBar } from "@/components/admin/filter-bar";
import { ContextChip, DataTable, LinkCell, Mono, Muted, PageHeader, Pagination, StatusBadge, humanize } from "@/components/admin/ui";
import { dt, num, rel } from "@/components/admin/format";
import { failureExplanation } from "@/components/admin/failures";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Guests & invitations" };

export default async function GuestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await searchGuests(sp);
  const params = currentParams(sp, ["q", "event", "status", "delivery"]);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Guests & invitations"
        description="Look up any guest across all events by name, phone number (any format) or invitation code."
      />
      {data.event ? (
        <ContextChip label="Event" value={data.event.title} href={`/admin/events/${data.event.id}`} basePath="/admin/guests" params={params} param="event" />
      ) : null}
      <FilterBar
        values={params}
        fields={[
          { type: "search", name: "q", placeholder: "Name, phone or invitation code" },
          { type: "select", name: "status", label: "Status", options: GUEST_STATUSES.map((s) => ({ value: s, label: humanize(s) })) },
          { type: "select", name: "delivery", label: "Delivery", options: DELIVERY_STATUSES.map((s) => ({ value: s, label: humanize(s) })) },
        ]}
      />
      <DataTable
        caption="Guests"
        rows={data.rows}
        rowKey={(g) => g.id}
        empty={data.q ? `No guests match “${data.q}”.` : "No guests."}
        columns={[
          {
            key: "guest",
            header: "Guest",
            cell: (g) => (
              <div className="min-w-0">
                <p className="font-medium text-ink">{g.name}</p>
                <p className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-faint">{formatPhone(g.phone)}</p>
              </div>
            ),
          },
          {
            key: "event",
            header: "Event",
            cell: (g) => (
              <LinkCell href={`/admin/events/${g.event.id}`} sub={g.event.deletedAt ? "Deleted" : g.event.deactivatedAt ? "Deactivated" : undefined}>
                {g.event.title}
              </LinkCell>
            ),
            hideBelow: "md",
          },
          {
            key: "token",
            header: "Invitation",
            cell: (g) =>
              g.invitation ? (
                <span className="inline-flex items-center gap-1.5">
                  <Mono>{g.invitation.token}</Mono>
                  {g.invitation.status === "REVOKED" ? <StatusBadge status="CANCELLED" label="Revoked" /> : null}
                </span>
              ) : (
                <Muted>—</Muted>
              ),
            hideBelow: "lg",
          },
          { key: "status", header: "Status", cell: (g) => <StatusBadge status={g.status} /> },
          {
            key: "delivery",
            header: "Delivery",
            cell: (g) => (
              <div className="min-w-0 max-w-[260px]">
                <StatusBadge status={g.deliveryStatus} />
                {g.deliveryStatus === "FAILED" || g.deliveryError ? (
                  <p className="mt-1 text-[12.5px] leading-snug text-rosewood">
                    {failureExplanation(g.deliveryError ?? failureReason(g.deliveryErrorCode ? Number(g.deliveryErrorCode) : null), g.deliveryErrorCode)}
                  </p>
                ) : null}
              </div>
            ),
            hideBelow: "sm",
          },
          {
            key: "engagement",
            header: "Views / scans",
            align: "end",
            cell: (g) => (
              <span title={g.lastViewedAt ? `Last viewed ${dt(g.lastViewedAt)}` : undefined}>
                {num(g.viewCount)} / {num(g.scanCount)}
              </span>
            ),
            hideBelow: "md",
          },
          { key: "activity", header: "Last activity", cell: (g) => <span title={dt(g.lastActivityAt)} className="whitespace-nowrap">{rel(g.lastActivityAt)}</span>, hideBelow: "lg" },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/guests" params={params} />
    </>
  );
}
