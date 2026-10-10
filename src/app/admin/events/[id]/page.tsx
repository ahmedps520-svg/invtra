import type { Metadata } from "next";
import { planName } from "@/lib/plans";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, PauseCircle, PlayCircle } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { getEventDetail } from "@/server/admin/events";
import { cardPreviewProps } from "@/server/events/preview";
import { AdminAction } from "@/components/admin/actions";
import { GrantPlanButton } from "@/components/admin/grant-plan";
import { EventStateBadge } from "@/components/admin/event-state";
import {
  DataTable,
  KeyValues,
  Mono,
  Muted,
  PageHeader,
  SectionTitle,
  StatTile,
  StatusBadge,
  humanize,
} from "@/components/admin/ui";
import {
  dt,
  guestLimit,
  money,
  num,
  pct,
  rel,
  eventWhen,
} from "@/components/admin/format";
import { CardPreview } from "@/components/invitation/card-preview";
import { themes as themeNames } from "@/lib/i18n/dictionaries/en/themes";
import { isThemeKey } from "@/lib/themes/registry";

export const metadata: Metadata = { title: "Event" };

const LANG: Record<string, string> = {
  EN: "English",
  AR: "Arabic",
  BILINGUAL: "Arabic + English",
};

function activityText(
  kind: string,
  data: Record<string, unknown> | null,
): string {
  const d = data ?? {};
  const name = typeof d.name === "string" ? d.name : "A guest";
  switch (kind) {
    case "plan.purchased":
      return `${planName(String(d.plan ?? "")) || "Plan"} plan ${d.granted ? "granted by INVTRA" : "purchased"}`;
    case "batch.started":
      return `Sending started to ${d.total ?? "?"} guests`;
    case "batch.completed":
      return d.cancelled
        ? `Sending cancelled${d.reason ? ` — ${d.reason}` : ""}`
        : `Sending finished · ${d.sent ?? 0} sent, ${d.failed ?? 0} failed`;
    case "event.created":
      return "Event created";
    case "event.updated":
      return "Details updated";
    case "guests.imported":
      return `Guests imported${d.count ? ` (${d.count})` : ""}`;
    case "guest.message_failed":
      return `Message to ${name} failed${d.reason ? ` (${humanize(String(d.reason))})` : ""}`;
    case "guest.invitation_failed":
      return `Invitation to ${name} failed`;
    default:
      return `${humanize(kind.replace(/^[a-z]+\./, ""))}${typeof d.name === "string" ? ` — ${d.name}` : ""}`;
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const data = await getEventDetail(id);
  if (!data) notFound();
  const { event, stats, messages, views, scans, pendingJobs, auditEntries } =
    data;
  const preview = await cardPreviewProps(event);
  const sentTotal =
    (messages.SENT ?? 0) + (messages.DELIVERED ?? 0) + (messages.READ ?? 0);

  return (
    <>
      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-faint transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Events
      </Link>
      <PageHeader
        eyebrow={humanize(event.type)}
        title={event.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <EventStateBadge event={event} />
            <span>
              by{" "}
              <Link
                href={`/admin/customers/${event.user.id}`}
                className="text-ink underline-offset-4 hover:underline"
              >
                {event.user.name}
              </Link>{" "}
              · {event.user.email}
            </span>
            {event.user.status === "DEACTIVATED" ? (
              <StatusBadge status="DEACTIVATED" label="Account deactivated" />
            ) : null}
          </span>
        }
        actions={
          event.deletedAt ? null : (
            <>
              <GrantPlanButton
                eventId={event.id}
                currentPlan={event.plan}
                currentLimit={event.guestLimit}
                guestCount={stats.total}
              />
              {event.deactivatedAt ? (
                <AdminAction
                  url={`/api/admin/events/${event.id}`}
                  body={{ action: "reactivate" }}
                  label="Reactivate"
                  variant="primary"
                  icon={<PlayCircle className="size-3.5" />}
                  confirm={{
                    title: "Reactivate this event?",
                    description:
                      "Guests can open their invitations and respond again. Sending does not restart automatically.",
                    confirmLabel: "Reactivate",
                    reason: {
                      label: "Note",
                      placeholder: "Optional note for the audit log",
                    },
                  }}
                />
              ) : (
                <AdminAction
                  url={`/api/admin/events/${event.id}`}
                  body={{ action: "deactivate" }}
                  label="Deactivate"
                  variant="danger"
                  icon={<PauseCircle className="size-3.5" />}
                  confirm={{
                    title: "Deactivate this event?",
                    description:
                      "All pending sends are cancelled and every invitation shows as unavailable to guests until it is reactivated.",
                    confirmLabel: "Deactivate event",
                    tone: "danger",
                    reason: {
                      label: "Reason",
                      placeholder: "Shown to staff in the audit log",
                      required: true,
                    },
                  }}
                />
              )}
            </>
          )
        }
      />

      {event.deactivatedAt ? (
        <div className="mb-8 rounded-2xl border border-rosewood/20 bg-rosewood-soft px-5 py-4 text-sm text-rosewood">
          <p className="font-medium">Deactivated {dt(event.deactivatedAt)}</p>
          {event.deactivatedReason ? (
            <p className="mt-1 text-rosewood/90">{event.deactivatedReason}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Guests"
          value={num(stats.total)}
          hint={`Limit ${guestLimit(event.guestLimit)}`}
          href={`/admin/guests?event=${event.id}`}
        />
        <StatTile
          label="Accepted"
          tone="sage"
          value={num(stats.accepted)}
          hint={
            stats.sent
              ? `${pct(stats.accepted, stats.sent)} of messaged · ${num(stats.declined)} declined`
              : "No guests messaged yet"
          }
        />
        <StatTile
          label="Messaged"
          tone="slate"
          value={num(stats.sent)}
          hint={`${num(stats.pending)} awaiting a reply · ${num(stats.failed)} failed`}
          href={`/admin/messages?event=${event.id}`}
        />
        <StatTile
          label="Views & scans"
          tone="bronze"
          value={num(views)}
          hint={`${num(scans)} QR scans`}
          href={`/admin/scans?event=${event.id}`}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-10">
          <section>
            <SectionTitle title="Details" />
            <div className="rounded-2xl border border-line bg-paper px-5 py-3 shadow-soft">
              <KeyValues
                items={[
                  { label: "Hosts", value: event.hostNames },
                  {
                    label: "Starts",
                    value: `${eventWhen(event, true)} (${event.timezone})`,
                  },
                  {
                    label: "Venue",
                    value: (
                      <span>
                        {event.venueName}
                        <span className="block text-ink-faint">
                          {event.address}
                        </span>
                      </span>
                    ),
                  },
                  { label: "Language", value: LANG[event.language] },
                  {
                    label: "Theme",
                    value: isThemeKey(event.themeKey)
                      ? themeNames[event.themeKey].name
                      : event.themeKey,
                  },
                  {
                    label: "Image",
                    value:
                      event.imageMode === "CUSTOM"
                        ? "Customer's own design"
                        : "Generated from theme",
                  },
                  {
                    label: "Plan",
                    value: event.plan ? (
                      <StatusBadge status={event.plan} />
                    ) : (
                      <Muted>No plan yet</Muted>
                    ),
                  },
                  {
                    label: "Template",
                    value: event.messageTemplate ? (
                      `${event.messageTemplate.name} (${event.messageTemplate.metaName} · ${event.messageTemplate.language})`
                    ) : (
                      <Muted>Automatic</Muted>
                    ),
                  },
                  {
                    label: "WhatsApp messages",
                    value: `${num(sentTotal)} sent · ${num(messages.FAILED ?? 0)} failed · ${num(pendingJobs)} jobs pending`,
                  },
                  { label: "Test sends used", value: num(event.testSendsUsed) },
                  {
                    label: "First sent",
                    value: event.firstSentAt ? (
                      dt(event.firstSentAt)
                    ) : (
                      <Muted>Not yet</Muted>
                    ),
                  },
                  { label: "Created", value: dt(event.createdAt) },
                  { label: "Event id", value: <Mono>{event.id}</Mono> },
                ]}
              />
            </div>
          </section>

          <section>
            <SectionTitle
              title="Orders"
              action={
                <Link
                  href={`/admin/payments?q=${encodeURIComponent(event.id)}`}
                  className="text-[13px] text-bronze-700 underline-offset-4 hover:underline"
                >
                  Manage in Payments
                </Link>
              }
            />
            <DataTable
              caption="Orders"
              rows={event.orders}
              rowKey={(o) => o.id}
              empty="No orders for this event."
              columns={[
                {
                  key: "plan",
                  header: "Plan",
                  cell: (o) =>
                    `${planName(o.plan)} · ${guestLimit(o.guestLimit)} guests`,
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
                  hideBelow: "sm",
                },
                {
                  key: "when",
                  header: "Created",
                  cell: (o) => dt(o.createdAt),
                  hideBelow: "md",
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (o) => <StatusBadge status={o.status} />,
                },
              ]}
            />
          </section>

          <section>
            <SectionTitle title="Send batches" />
            <DataTable
              caption="Send batches"
              rows={event.sendBatches}
              rowKey={(b) => b.id}
              empty="Nothing has been sent yet."
              columns={[
                {
                  key: "kind",
                  header: "Batch",
                  cell: (b) => (
                    <span className="text-ink">{humanize(b.kind)}</span>
                  ),
                },
                {
                  key: "progress",
                  header: "Sent / failed / skipped",
                  align: "end",
                  cell: (b) =>
                    `${num(b.sent)} / ${num(b.failed)} / ${num(b.skipped)} of ${num(b.total)}`,
                },
                {
                  key: "when",
                  header: "Started",
                  cell: (b) => dt(b.startedAt ?? b.createdAt),
                  hideBelow: "sm",
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (b) => <StatusBadge status={b.status} />,
                },
              ]}
            />
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-label="Invitation preview">
            <SectionTitle title="Invitation" />
            <div className="overflow-hidden rounded-2xl border border-line bg-paper p-3 shadow-soft">
              <CardPreview
                themeKey={preview.themeKey}
                design={preview.design}
                language={preview.language}
                content={preview.content}
                backgroundImage={preview.backgroundImage}
                customImage={preview.customImage}
                className="rounded-xl"
                title={`Invitation design for ${event.title}`}
              />
            </div>
            <Link
              href={`/admin/guests?event=${event.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-bronze-700 underline-offset-4 hover:underline"
            >
              Guests & invitation links{" "}
              <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          </section>

          <section>
            <SectionTitle title="Activity" />
            <ol className="space-y-3 border-s border-line ps-4 text-[13px]">
              {event.activities.length === 0 ? (
                <li className="text-ink-faint">No activity yet.</li>
              ) : null}
              {event.activities.map((a) => (
                <li key={a.id}>
                  <p className="text-ink-soft">
                    {activityText(
                      a.kind,
                      a.data as Record<string, unknown> | null,
                    )}
                  </p>
                  <p className="text-ink-faint" title={dt(a.createdAt)}>
                    {rel(a.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {auditEntries.length ? (
            <section>
              <SectionTitle title="Admin actions" />
              <ol className="space-y-3 border-s border-line ps-4 text-[13px]">
                {auditEntries.map((a) => {
                  const meta = (a.meta ?? {}) as Record<string, unknown>;
                  return (
                    <li key={a.id}>
                      <p className="text-ink">
                        {humanize(a.action.replace(/^admin\.event\./, ""))}
                      </p>
                      <p className="text-ink-faint">{dt(a.createdAt)}</p>
                      {typeof meta.reason === "string" && meta.reason ? (
                        <p className="text-ink-soft">“{meta.reason}”</p>
                      ) : null}
                      {typeof meta.note === "string" ? (
                        <p className="text-ink-soft">“{meta.note}”</p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <Link
                href={`/admin/audit?target=${event.id}`}
                className="mt-3 inline-block text-[13px] text-bronze-700 underline-offset-4 hover:underline"
              >
                Full audit log
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
