import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, RotateCcw } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { canRetry, listMessages, MESSAGE_DIRECTIONS, MESSAGE_PROVIDERS, MESSAGE_PURPOSES, MESSAGE_STATUSES } from "@/server/admin/messages";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { AdminAction } from "@/components/admin/actions";
import { FilterBar } from "@/components/admin/filter-bar";
import { ContextChip, DataTable, LinkCell, Muted, PageHeader, Pagination, StatusBadge, humanize } from "@/components/admin/ui";
import { dt, num, rel } from "@/components/admin/format";
import { failureExplanation } from "@/components/admin/failures";
import { formatPhone } from "@/lib/phone";
import { cn, truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "WhatsApp messages" };

const PURPOSE_LABEL: Record<string, string> = {
  INVITATION_REQUEST: "Invitation request",
  INVITATION_DELIVERY: "Invitation delivery",
  DECLINE_ACK: "Decline reply",
  UPDATE: "Update",
  REPLY: "Guest reply",
  OTHER: "Other",
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await listMessages(sp);
  const params = currentParams(sp, ["q", "status", "purpose", "direction", "provider", "from", "to", "event"]);
  const statusHref = (s?: string) => {
    const p = new URLSearchParams(params);
    p.delete("page");
    if (s) p.set("status", s);
    else p.delete("status");
    return p.size ? `/admin/messages?${p}` : "/admin/messages";
  };
  const allCount = Object.values(data.counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHeader eyebrow="WhatsApp" title="Messages" description="Every message INVTRA sent or received through the WhatsApp Business Platform, with delivery receipts and failures." />
      {data.event ? <ContextChip label="Event" value={data.event.title} href={`/admin/events/${data.event.id}`} basePath="/admin/messages" params={params} param="event" /> : null}

      <nav aria-label="Status" className="scrollbar-none mb-5 flex gap-2 overflow-x-auto">
        {[undefined, ...MESSAGE_STATUSES].map((s) => {
          const active = (params.status ?? undefined) === s;
          const count = s ? data.counts[s] ?? 0 : allCount;
          return (
            <Link
              key={s ?? "all"}
              href={statusHref(s)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition",
                active ? "border-ink bg-ink text-ivory" : "border-line bg-paper text-ink-soft hover:border-bronze-300 hover:text-ink",
                s === "FAILED" && !active && count ? "text-rosewood" : "",
              )}
            >
              {s ? humanize(s) : "All"}
              <span className={cn("tabular-nums text-[12px]", active ? "text-ivory/70" : "text-ink-faint")}>{num(count)}</span>
            </Link>
          );
        })}
      </nav>

      <FilterBar
        values={params}
        fields={[
          { type: "search", name: "q", placeholder: "Phone, guest name or wamid" },
          { type: "select", name: "purpose", label: "Purpose", options: MESSAGE_PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABEL[p] })) },
          { type: "select", name: "direction", label: "Direction", options: MESSAGE_DIRECTIONS.map((d) => ({ value: d, label: humanize(d) })) },
          { type: "select", name: "provider", label: "Provider", options: MESSAGE_PROVIDERS.map((p) => ({ value: p, label: p === "cloud" ? "Cloud API" : "Mock" })) },
          { type: "date", name: "from", label: "From" },
          { type: "date", name: "to", label: "To" },
        ]}
      />

      <DataTable
        caption="WhatsApp messages"
        rows={data.rows}
        rowKey={(m) => m.id}
        empty="No messages match these filters."
        columns={[
          {
            key: "when",
            header: "Time",
            cell: (m) => (
              <div className="whitespace-nowrap">
                <p className="text-ink">{dt(m.createdAt)}</p>
                <p className="text-[12px] text-ink-faint">{rel(m.createdAt)}</p>
              </div>
            ),
          },
          {
            key: "message",
            header: "Message",
            cell: (m) => {
              const body = (m.content as { body?: string } | null)?.body;
              return (
                <div className="min-w-[220px] max-w-[360px]">
                  <p className="flex items-center gap-1.5 text-ink">
                    {m.direction === "INBOUND" ? (
                      <ArrowDownLeft className="size-3.5 text-bronze-600" aria-label="Inbound" />
                    ) : (
                      <ArrowUpRight className="size-3.5 text-ink-faint" aria-label="Outbound" />
                    )}
                    {PURPOSE_LABEL[m.purpose]}
                    <span className="text-[12px] text-ink-faint">· {m.type}</span>
                  </p>
                  {body ? <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-faint">{truncate(body, 180)}</p> : null}
                </div>
              );
            },
          },
          {
            key: "guest",
            header: "Guest",
            cell: (m) => (
              <div className="min-w-0">
                <p className="text-ink">{m.guest?.name ?? <Muted>Unknown</Muted>}</p>
                <p className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-faint">{formatPhone(m.phone)}</p>
              </div>
            ),
            hideBelow: "sm",
          },
          {
            key: "event",
            header: "Event",
            cell: (m) => (m.event ? <LinkCell href={`/admin/events/${m.event.id}`}>{truncate(m.event.title, 40)}</LinkCell> : <Muted>—</Muted>),
            hideBelow: "lg",
          },
          {
            key: "status",
            header: "Status",
            cell: (m) => (
              <div className="min-w-0 max-w-[280px]">
                <StatusBadge status={m.status} />
                {m.status === "FAILED" ? (
                  <p className="mt-1 text-[12.5px] leading-snug text-rosewood">
                    {failureExplanation(m.errorCode)}
                    {m.errorMessage ? <span className="mt-0.5 block text-ink-faint">{truncate(m.errorMessage, 140)}</span> : null}
                  </p>
                ) : m.readAt ? (
                  <p className="mt-1 text-[12px] text-ink-faint">Read {rel(m.readAt)}</p>
                ) : m.deliveredAt ? (
                  <p className="mt-1 text-[12px] text-ink-faint">Delivered {rel(m.deliveredAt)}</p>
                ) : null}
              </div>
            ),
          },
          { key: "provider", header: "Provider", cell: (m) => (m.provider === "cloud" ? "Cloud API" : humanize(m.provider)), hideBelow: "lg" },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "end",
            cell: (m) =>
              canRetry(m) ? (
                <AdminAction
                  url={`/api/admin/messages/${m.id}/retry`}
                  label="Retry"
                  icon={<RotateCcw className="size-3.5" />}
                  confirm={{
                    title: "Retry this invitation request?",
                    description: `Queues the Accept / Decline message to ${m.guest?.name ?? "the guest"} again. Fix the cause first if the number is invalid or not on WhatsApp.`,
                    confirmLabel: "Queue again",
                  }}
                />
              ) : null,
          },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/messages" params={params} />
    </>
  );
}
