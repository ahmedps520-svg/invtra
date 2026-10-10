import type { Metadata } from "next";
import Link from "next/link";
import { Palette, Plus, Receipt, Trash2, UserPen } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { env } from "@/server/env";
import {
  CUSTOM_STATUSES,
  listCustomDrafts,
  listCustomPackages,
} from "@/server/custom/service";
import { AdminAction } from "@/components/admin/actions";
import { common } from "@/lib/i18n/dictionaries/en/common";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { isUnlimited } from "@/lib/plans";
import { FilterBar } from "@/components/admin/filter-bar";
import { CustomPackageActions } from "@/components/admin/custom-actions";
import {
  DataTable,
  LinkCell,
  Mono,
  Muted,
  PageHeader,
  Pagination,
  StatTile,
  StatusBadge,
  humanize,
} from "@/components/admin/ui";
import {
  dt,
  eventDate,
  money,
  num,
  plural,
  rel,
} from "@/components/admin/format";
import { buttonClasses } from "@/components/ui/button";
import { truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Custom events" };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  CANCELLED: "Withdrawn",
  REFUNDED: "Refunded",
};

export default async function CustomEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [list, drafts] = await Promise.all([
    listCustomPackages(sp),
    listCustomDrafts(),
  ]);
  const params = currentParams(sp, ["q", "status"]);
  const sum = (s: { amounts: { amount: number; currency: string }[] }) =>
    s.amounts.length
      ? s.amounts.map((a) => money(a.amount, a.currency)).join(" · ")
      : money(0, env().PAYMENT_CURRENCY);

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Custom events"
        description="Events you prepare for a host: design the invitation first, then add the host and your own price — any number of guests, or unlimited. The host gets a secure payment link by WhatsApp and email, and a receipt once they pay."
        actions={
          <Link
            href="/admin/custom/new"
            className={buttonClasses("primary", "md")}
          >
            <Plus className="size-4" />
            New custom event
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatTile
          label="Awaiting payment"
          tone="ochre"
          value={num(list.summary.pending.count)}
          hint={sum(list.summary.pending)}
          href="/admin/custom?status=PENDING"
        />
        <StatTile
          label="Paid"
          tone="bronze"
          value={num(list.summary.paid.count)}
          hint={sum(list.summary.paid)}
          href="/admin/custom?status=PAID"
        />
        <StatTile
          label="How it works"
          className="col-span-2 xl:col-span-1"
          value={
            <span className="text-base leading-snug">
              Event → design → host & price → send link
            </span>
          }
          hint="Receipts are numbered INVTRA-YYYY-0001 and emailed automatically."
        />
      </div>

      {drafts.length ? (
        <section className="mt-10" aria-labelledby="drafts-heading">
          <h2
            id="drafts-heading"
            className="mb-1 font-display text-2xl text-ink"
          >
            Drafts
          </h2>
          <p className="mb-4 text-[13.5px] text-ink-faint">
            Being designed — no host or payment link yet.
          </p>
          <DataTable
            caption="Custom event drafts"
            rows={drafts}
            rowKey={(d) => d.id}
            columns={[
              {
                key: "event",
                header: "Event",
                cell: (d) => (
                  <div className="min-w-[200px]">
                    <Link
                      href={`/admin/custom/${d.id}/design`}
                      className="text-ink hover:underline"
                    >
                      {truncate(d.title, 50)}
                    </Link>
                    <p className="text-[12px] text-ink-faint">
                      {common.eventTypes[d.type]} ·{" "}
                      {eventDate(d.startsAt, d.timezone)}
                    </p>
                  </div>
                ),
              },
              {
                key: "edited",
                header: "Last edited",
                cell: (d) => (
                  <span
                    className="whitespace-nowrap text-[13px]"
                    title={dt(d.updatedAt)}
                  >
                    {rel(d.updatedAt)}
                    <span className="text-ink-faint"> · {d.user.name}</span>
                  </span>
                ),
                hideBelow: "sm",
              },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "end",
                cell: (d) => (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Link
                      href={`/admin/custom/${d.id}/design`}
                      className={buttonClasses("outline", "sm")}
                    >
                      <Palette className="size-3.5" />
                      Design
                    </Link>
                    <Link
                      href={`/admin/custom/${d.id}/host`}
                      className={buttonClasses("primary", "sm")}
                    >
                      <UserPen className="size-3.5" />
                      Host & price
                    </Link>
                    <AdminAction
                      url={`/api/admin/custom/events/${d.id}`}
                      method="DELETE"
                      label="Discard"
                      variant="ghost"
                      icon={<Trash2 className="size-3.5" />}
                      successMessage="Draft discarded"
                      confirm={{
                        title: "Discard this draft?",
                        description:
                          "The event and its design are deleted. Nothing was sent to anyone.",
                        confirmLabel: "Discard",
                        tone: "danger",
                      }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      <div className="mt-10">
        <FilterBar
          values={params}
          fields={[
            {
              type: "search",
              name: "q",
              placeholder: "Host, email, event or receipt no.",
            },
            {
              type: "select",
              name: "status",
              label: "Status",
              options: CUSTOM_STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABEL[s] ?? humanize(s),
              })),
            },
          ]}
        />
        <DataTable
          caption="Custom packages"
          rows={list.rows}
          rowKey={(o) => o.id}
          empty={
            <span>
              No custom events yet.{" "}
              <Link
                href="/admin/custom/new"
                className="text-ink underline underline-offset-4"
              >
                Create the first one
              </Link>
              .
            </span>
          }
          columns={[
            {
              key: "host",
              header: "Host / event",
              cell: (o) => (
                <div className="min-w-[200px]">
                  <LinkCell
                    href={`/admin/customers/${o.user.id}`}
                    sub={
                      o.event ? (
                        <Link
                          href={`/admin/custom/${o.event.id}/send`}
                          className="hover:text-ink hover:underline"
                        >
                          {truncate(o.event.title, 40)} ·{" "}
                          {eventDate(o.event.startsAt, o.event.timezone)}
                        </Link>
                      ) : (
                        "Event deleted"
                      )
                    }
                  >
                    {o.user.name}
                  </LinkCell>
                </div>
              ),
            },
            {
              key: "package",
              header: "Package",
              cell: (o) => (
                <div className="min-w-[140px]">
                  <p className="text-ink">
                    {isUnlimited(o.guestLimit)
                      ? "Unlimited guests"
                      : plural(o.guestLimit, "guest")}
                  </p>
                  {o.title ? (
                    <p
                      className="line-clamp-2 max-w-[260px] text-[12px] text-ink-faint"
                      title={o.title}
                    >
                      {truncate(o.title, 100)}
                    </p>
                  ) : null}
                </div>
              ),
              hideBelow: "md",
            },
            {
              key: "amount",
              header: "Price",
              align: "end",
              cell: (o) => (
                <span className="whitespace-nowrap text-ink">
                  {money(o.amount, o.currency)}
                </span>
              ),
            },
            {
              key: "sent",
              header: "Link sent / paid",
              cell: (o) => (
                <div className="whitespace-nowrap text-[13px]">
                  {o.paidAt ? (
                    <>
                      <p className="text-sage">Paid {dt(o.paidAt)}</p>
                      {o.receiptNumber ? (
                        <Link
                          href={`/receipt/${o.id}`}
                          className="inline-flex items-center gap-1 text-ink-faint hover:text-ink hover:underline"
                        >
                          <Receipt className="size-3" />
                          <Mono>{o.receiptNumber}</Mono>
                        </Link>
                      ) : null}
                    </>
                  ) : o.requestSentAt ? (
                    <p title={dt(o.requestSentAt)}>
                      Sent {rel(o.requestSentAt)}
                    </p>
                  ) : (
                    <Muted>Not sent</Muted>
                  )}
                  {o.dueAt && o.status === "PENDING" ? (
                    <p className="text-[12px] text-ink-faint">
                      Due{" "}
                      {eventDate(o.dueAt, o.event?.timezone ?? "Asia/Riyadh")}
                    </p>
                  ) : null}
                </div>
              ),
              hideBelow: "sm",
            },
            {
              key: "status",
              header: "Status",
              cell: (o) => (
                <StatusBadge status={o.status} label={STATUS_LABEL[o.status]} />
              ),
            },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              align: "end",
              cell: (o) => (
                <CustomPackageActions
                  id={o.id}
                  eventId={o.event?.id ?? null}
                  payUrl={o.payUrl}
                  pending={o.status === "PENDING"}
                  hasPhone={Boolean(o.user.phone)}
                />
              ),
            },
          ]}
        />
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          basePath="/admin/custom"
          params={params}
        />
      </div>
    </>
  );
}
