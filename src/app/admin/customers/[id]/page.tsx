import type { Metadata } from "next";
import { planName } from "@/lib/plans";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, RotateCcw, Sparkles } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth/guards";
import { getCustomer } from "@/server/admin/customers";
import { AdminAction } from "@/components/admin/actions";
import {
  DataTable,
  KeyValues,
  LinkCell,
  Mono,
  Muted,
  PageHeader,
  SectionTitle,
  StatusBadge,
  humanize,
} from "@/components/admin/ui";
import {
  dt,
  guestLimit,
  money,
  num,
  rel,
  eventWhen,
} from "@/components/admin/format";
import { EventStateBadge } from "@/components/admin/event-state";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const data = await getCustomer(id);
  if (!data) notFound();
  const { user, stats, auditEntries } = data;
  const self = user.id === admin.id;
  const paid = user.orders.filter((o) => o.status === "PAID");
  const revenue = Object.entries(
    paid.reduce<Record<string, number>>(
      (acc, o) => ({ ...acc, [o.currency]: (acc[o.currency] ?? 0) + o.amount }),
      {},
    ),
  );

  return (
    <>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-faint transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Customers
      </Link>
      <PageHeader
        eyebrow={user.role === "ADMIN" ? "Admin account" : "Customer"}
        title={user.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {user.email}
            <StatusBadge status={user.status} />
          </span>
        }
        actions={
          user.status === "ACTIVE" ? (
            <>
              <Link
                href={`/admin/custom/new?email=${encodeURIComponent(user.email)}`}
                className={buttonClasses("outline", "sm")}
              >
                <Sparkles className="size-3.5" />
                Custom event
              </Link>
              <AdminAction
                url={`/api/admin/customers/${user.id}`}
                body={{ action: "deactivate" }}
                label="Deactivate account"
                variant="danger"
                icon={<Ban className="size-3.5" />}
                disabled={self}
                title={
                  self ? "You can't deactivate your own account" : undefined
                }
                confirm={{
                  title: "Deactivate this account?",
                  description: `${user.name} will be signed out everywhere and won't be able to sign in until the account is reactivated.`,
                  confirmLabel: "Deactivate",
                  tone: "danger",
                  reason: {
                    label: "Reason",
                    placeholder: "Visible to staff in the audit log",
                    required: true,
                  },
                  checkbox: {
                    field: "alsoEvents",
                    label: "Also deactivate their events",
                    description:
                      "Stops all sending and shows their invitations as unavailable to guests.",
                  },
                }}
              />
            </>
          ) : (
            <AdminAction
              url={`/api/admin/customers/${user.id}`}
              body={{ action: "reactivate" }}
              label="Reactivate account"
              variant="primary"
              icon={<RotateCcw className="size-3.5" />}
              confirm={{
                title: "Reactivate this account?",
                description: `${user.name} will be able to sign in again.`,
                confirmLabel: "Reactivate",
                reason: {
                  label: "Note",
                  placeholder: "Optional note for the audit log",
                },
                checkbox: {
                  field: "alsoEvents",
                  defaultChecked: true,
                  label: "Also reactivate events deactivated with the account",
                  description:
                    "Events an admin deactivated separately stay deactivated.",
                },
              }}
            />
          )
        }
      />

      {user.status === "DEACTIVATED" ? (
        <div className="mb-8 rounded-2xl border border-rosewood/20 bg-rosewood-soft px-5 py-4 text-sm text-rosewood">
          <p className="font-medium">
            Deactivated {user.deactivatedAt ? dt(user.deactivatedAt) : ""}
          </p>
          {user.deactivationNote ? (
            <p className="mt-1 text-rosewood/90">{user.deactivationNote}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-8">
          <section className="rounded-2xl border border-line bg-paper px-5 py-3 shadow-soft">
            <KeyValues
              items={[
                { label: "Role", value: humanize(user.role) },
                { label: "Phone", value: user.phone ?? <Muted>—</Muted> },
                {
                  label: "Language",
                  value: user.locale === "ar" ? "Arabic" : "English",
                },
                { label: "Joined", value: dt(user.createdAt) },
                {
                  label: "Last sign-in",
                  value: user.lastLoginAt ? (
                    <span title={dt(user.lastLoginAt)}>
                      {rel(user.lastLoginAt)}
                    </span>
                  ) : (
                    <Muted>Never</Muted>
                  ),
                },
                { label: "Active sessions", value: num(user._count.sessions) },
                { label: "Paid orders", value: num(paid.length) },
                {
                  label: "Lifetime value",
                  value: revenue.length ? (
                    revenue.map(([c, a]) => money(a, c)).join(" · ")
                  ) : (
                    <Muted>—</Muted>
                  ),
                },
                { label: "Account id", value: <Mono>{user.id}</Mono> },
              ]}
            />
          </section>
          <section>
            <SectionTitle title="Audit trail" />
            <ol className="space-y-3 border-s border-line ps-4 text-[13px]">
              {auditEntries.length === 0 ? (
                <li className="text-ink-faint">
                  No admin actions on this account.
                </li>
              ) : null}
              {auditEntries.map((a) => (
                <li key={a.id}>
                  <p className="text-ink">
                    {humanize(a.action.replace(/^admin\.user\./, ""))}
                  </p>
                  <p className="text-ink-faint">{dt(a.createdAt)}</p>
                  {typeof (a.meta as Record<string, unknown> | null)?.reason ===
                    "string" && (a.meta as Record<string, string>).reason ? (
                    <p className="mt-0.5 text-ink-soft">
                      “{(a.meta as Record<string, string>).reason}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>

        <div className="min-w-0 space-y-10">
          <section>
            <SectionTitle
              title="Events"
              description={`${num(user.events.length)} in total`}
            />
            <DataTable
              caption="Events"
              rows={user.events}
              rowKey={(e) => e.id}
              empty="This customer hasn't created an event yet."
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
                  key: "date",
                  header: "Date",
                  cell: (e) => eventWhen(e),
                  hideBelow: "sm",
                },
                {
                  key: "plan",
                  header: "Plan",
                  cell: (e) =>
                    e.plan ? (
                      <StatusBadge status={e.plan} />
                    ) : (
                      <Muted>None</Muted>
                    ),
                },
                {
                  key: "guests",
                  header: "Guests",
                  align: "end",
                  cell: (e) => {
                    const s = stats.get(e.id);
                    return s ? (
                      <span className="whitespace-nowrap">
                        {num(s.total)}{" "}
                        <span className="text-ink-faint">
                          · {num(s.accepted)} accepted
                        </span>
                      </span>
                    ) : (
                      "0"
                    );
                  },
                  hideBelow: "md",
                },
                {
                  key: "state",
                  header: "State",
                  cell: (e) => <EventStateBadge event={e} />,
                },
              ]}
            />
          </section>

          <section>
            <SectionTitle
              title="Orders"
              description={`${num(user.orders.length)} in total`}
            />
            <DataTable
              caption="Orders"
              rows={user.orders}
              rowKey={(o) => o.id}
              empty="No orders."
              columns={[
                {
                  key: "plan",
                  header: "Order",
                  cell: (o) => (
                    <div>
                      <p className="text-ink">
                        {planName(o.plan)} · {guestLimit(o.guestLimit)} guests
                      </p>
                      <p className="text-[12.5px] text-ink-faint">
                        {o.event ? o.event.title : "Event deleted"}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "end",
                  cell: (o) => money(o.amount, o.currency),
                },
                {
                  key: "provider",
                  header: "Provider",
                  cell: (o) => humanize(o.provider),
                  hideBelow: "md",
                },
                {
                  key: "date",
                  header: "Created",
                  cell: (o) => dt(o.createdAt),
                  hideBelow: "sm",
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (o) => (
                    <Link href={`/admin/payments?q=${o.id}`}>
                      <StatusBadge status={o.status} />
                    </Link>
                  ),
                },
              ]}
            />
          </section>
        </div>
      </div>
    </>
  );
}
