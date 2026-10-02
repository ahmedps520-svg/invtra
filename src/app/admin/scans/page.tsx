import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { getScanOverview } from "@/server/admin/scans";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { ContextChip, DataTable, LinkCell, Mono, Muted, PageHeader, Pagination, SectionTitle, StatTile } from "@/components/admin/ui";
import { dt, num, pct, rel } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "QR scans & views" };

export default async function ScansPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await getScanOverview(sp);
  const params = currentParams(sp, ["event"]);
  const t = data.totals;

  return (
    <>
      <PageHeader eyebrow="Monitoring" title="QR scans & views" description="How guests open their invitations and how entry QR codes are scanned at the door." />
      {data.event ? <ContextChip label="Event" value={data.event.title} href={`/admin/events/${data.event.id}`} basePath="/admin/scans" params={params} param="event" /> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="QR scans" tone="bronze" value={num(t.scans)} hint={`+${num(t.scans7d)} in the last 7 days`}>
          {num(t.hostScans)} by hosts at the door · {num(t.guestScans)} by guests
        </StatTile>
        <StatTile label="Invitations scanned" value={num(t.scannedInvitations)} hint="distinct QR codes" />
        <StatTile label="Invitation views" tone="slate" value={num(t.views)} hint={`+${num(t.views7d)} in the last 7 days`}>
          {num(data.viewsBySource.LINK ?? 0)} via link · {num(data.viewsBySource.QR ?? 0)} via QR
        </StatTile>
        <StatTile label="Devices" value={pct(data.viewsByDevice.mobile ?? 0, t.views)} hint="of views on mobile">
          {num(t.viewedInvitations)} invitations opened at least once
        </StatTile>
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <SectionTitle title="Recent scans" />
          <DataTable
            caption="Recent QR scans"
            rows={data.recent.rows}
            rowKey={(s) => s.id}
            empty="No QR codes have been scanned yet."
            columns={[
              { key: "when", header: "Time", cell: (s) => <div className="whitespace-nowrap"><p className="text-ink">{dt(s.createdAt)}</p><p className="text-[12px] text-ink-faint">{rel(s.createdAt)}</p></div> },
              {
                key: "guest",
                header: "Guest",
                cell: (s) => (
                  <div>
                    <p className="text-ink">{s.invitation.guest.name}</p>
                    <Mono className="text-ink-faint">{s.invitation.token}</Mono>
                  </div>
                ),
              },
              { key: "event", header: "Event", cell: (s) => <LinkCell href={`/admin/events/${s.event.id}`}>{s.event.title}</LinkCell>, hideBelow: "md" },
              {
                key: "by",
                header: "Scanned by",
                cell: (s) => (s.byHost ? <Badge tone="sage">Host · check-in</Badge> : <Badge>Guest / other</Badge>),
              },
            ]}
          />
          <Pagination page={data.recent.page} pageSize={data.recent.pageSize} total={data.recent.total} basePath="/admin/scans" params={params} />
        </section>

        <aside className="space-y-10">
          <section>
            <SectionTitle title="Most scanned" description="Invitations scanned most often — repeated scans can mean a shared code." />
            <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
              {data.topScanned.length === 0 ? <li className="px-4 py-8 text-center text-sm text-ink-faint">No scans yet.</li> : null}
              {data.topScanned.map((s) => (
                <li key={s.invitationId} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-9 shrink-0 font-display text-2xl leading-none text-bronze-700 lining-nums">{num(s.count)}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    {s.invitation ? (
                      <>
                        <p className="truncate text-ink">{s.invitation.guest.name}</p>
                        <p className="truncate text-[12.5px] text-ink-faint">
                          <Mono>{s.invitation.token}</Mono> · {s.invitation.event.title}
                        </p>
                      </>
                    ) : (
                      <Muted>Deleted invitation</Muted>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {data.topViewedEvents.length ? (
            <section>
              <SectionTitle title="Most viewed events" />
              <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
                {data.topViewedEvents.map((e) => (
                  <li key={e.eventId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    {e.event ? <LinkCell href={`/admin/scans?event=${e.eventId}`}>{e.event.title}</LinkCell> : <Muted>Deleted event</Muted>}
                    <span className="shrink-0 tabular-nums text-ink-soft">{num(e.count)} views</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
