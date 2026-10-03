import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { listEvents } from "@/server/admin/events";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { FilterBar } from "@/components/admin/filter-bar";
import {
  DataTable,
  LinkCell,
  Muted,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/admin/ui";
import { EventStateBadge } from "@/components/admin/event-state";
import { eventDate, guestLimit, num } from "@/components/admin/format";
import { themes as themeNames } from "@/lib/i18n/dictionaries/en/themes";
import { isThemeKey, THEME_KEYS } from "@/lib/themes/registry";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await listEvents(sp);
  const params = currentParams(sp, ["q", "filter", "plan", "theme"]);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Events"
        description="All customer events with their guest responses and sending progress."
      />
      <FilterBar
        values={params}
        fields={[
          {
            type: "search",
            name: "q",
            placeholder: "Search title, hosts or customer",
          },
          {
            type: "select",
            name: "filter",
            label: "Show",
            allLabel: "All active & past",
            options: [
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
              { value: "deactivated", label: "Deactivated" },
              { value: "deleted", label: "Deleted" },
            ],
          },
          {
            type: "select",
            name: "plan",
            label: "Plan",
            options: [
              { value: "BASIC", label: "Standard" },
              { value: "PREMIUM", label: "Premium" },
              { value: "CUSTOM", label: "Custom" },
              { value: "NONE", label: "No plan" },
            ],
          },
          {
            type: "select",
            name: "theme",
            label: "Theme",
            options: THEME_KEYS.map((k) => ({
              value: k,
              label: themeNames[k].name,
            })),
          },
        ]}
      />
      <DataTable
        caption="Events"
        rows={data.rows}
        rowKey={(e) => e.id}
        empty={data.q ? `No events match “${data.q}”.` : "No events."}
        columns={[
          {
            key: "title",
            header: "Event",
            cell: (e) => (
              <LinkCell href={`/admin/events/${e.id}`} sub={e.hostNames}>
                {e.title}
              </LinkCell>
            ),
          },
          {
            key: "customer",
            header: "Customer",
            cell: (e) => (
              <LinkCell
                href={`/admin/customers/${e.user.id}`}
                sub={e.user.email}
              >
                {e.user.name}
              </LinkCell>
            ),
            hideBelow: "md",
          },
          {
            key: "date",
            header: "Date",
            cell: (e) => (
              <span className="whitespace-nowrap">
                {eventDate(e.startsAt, e.timezone)}
              </span>
            ),
            hideBelow: "sm",
          },
          {
            key: "theme",
            header: "Theme",
            cell: (e) =>
              isThemeKey(e.themeKey) ? themeNames[e.themeKey].name : e.themeKey,
            hideBelow: "lg",
          },
          {
            key: "plan",
            header: "Plan",
            cell: (e) =>
              e.plan ? <StatusBadge status={e.plan} /> : <Muted>None</Muted>,
          },
          {
            key: "guests",
            header: "Guests",
            align: "end",
            cell: (e) => (
              <span title={`Limit ${guestLimit(e.guestLimit)}`}>
                {num(e.stats.total)}
              </span>
            ),
          },
          {
            key: "rsvp",
            header: "Acc / Dec / Pend",
            align: "end",
            cell: (e) => (
              <span className="whitespace-nowrap">
                <span className="text-sage">{num(e.stats.accepted)}</span> /{" "}
                <span className="text-rosewood">{num(e.stats.declined)}</span> /{" "}
                <span className="text-ink-faint">{num(e.stats.pending)}</span>
              </span>
            ),
            hideBelow: "md",
          },
          {
            key: "sent",
            header: "Sent",
            align: "end",
            cell: (e) => (
              <span>
                {num(e.stats.sent)}
                {e.stats.failed ? (
                  <span
                    className="ms-1 text-rosewood"
                    title="Failed deliveries"
                  >
                    ({num(e.stats.failed)}✕)
                  </span>
                ) : null}
              </span>
            ),
            hideBelow: "lg",
          },
          {
            key: "state",
            header: "State",
            cell: (e) => <EventStateBadge event={e} />,
          },
        ]}
      />
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        basePath="/admin/events"
        params={params}
      />
    </>
  );
}
