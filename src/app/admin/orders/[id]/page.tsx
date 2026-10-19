import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, MessageSquareWarning, Send, ShieldAlert, Truck, XCircle } from "lucide-react";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { cardPreviewProps } from "@/server/events/preview";
import { orderReference } from "@/server/payments/bank";
import { mediaUrl } from "@/server/storage";
import { AdminAction } from "@/components/admin/actions";
import { FinalFileUpload } from "@/components/admin/order-files";
import { DataTable, KeyValues, Muted, PageHeader, SectionTitle, StatusBadge, humanize } from "@/components/admin/ui";
import { dt, money } from "@/components/admin/format";
import { CardPreview } from "@/components/invitation/card-preview";
import { eventWhen } from "@/components/admin/format";
import { planName } from "@/lib/plans";
import { needsProduction, productName, readFeatures, VERIFIABLE_STAGES } from "@/lib/products";
import type { OrderLine } from "@/server/orders/pricing";

export const metadata: Metadata = { title: "Order" };

const LINE_LABEL: Record<string, string> = {
  plan_basic: "Standard package (100 guests)",
  plan_premium: "Premium package (500 guests)",
  custom_design: "Custom event design",
  photo_only: "Invitation image",
  design_request: "Custom design request",
  discount: "Discount",
};

function size(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * One order, for payment verification and production: what the customer ordered and paid,
 * their receipt (evidence only — check the bank), and the actions for each stage.
 */
export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, whatsappUpdatesAt: true, locale: true } },
      event: true,
      files: { orderBy: { createdAt: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
      deliveries: true,
      promoCode: { select: { code: true } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  const event = order.event;
  const ref = orderReference(order.id);
  const actorIds = [
    ...new Set(
      order.history
        .map((h) => h.actorId)
        .concat(order.decidedById)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const actors = new Map((await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } })).map((u) => [u.id, u]));
  const references = event ? await db.upload.findMany({ where: { eventId: event.id, kind: "REFERENCE" }, orderBy: { createdAt: "asc" } }) : [];
  const referenceUrls = await Promise.all(references.map((r) => mediaUrl(r.key)));
  const uploadUrl = event?.designSource === "UPLOAD" && event.customImageKey ? await mediaUrl(event.customImageKey) : null;
  const preview = event && event.designSource !== "REQUEST" ? await cardPreviewProps(event) : null;
  const receipts = order.files.filter((f) => f.kind === "RECEIPT");
  const finals = order.files.filter((f) => f.kind === "FINAL");
  const lines = (order.lines as OrderLine[] | null) ?? [];
  const features = readFeatures(event?.features);
  const wizard = Boolean(order.product);
  const verifiable = order.status === "PENDING" && (wizard ? VERIFIABLE_STAGES.includes(order.stage) : true);
  const awaitingStaff = order.status === "PENDING" && ["SUBMITTED", "PENDING_VERIFICATION", "INFO_REQUIRED"].includes(order.stage);
  const production = order.status === "PAID" && (order.stage === "APPROVED" || order.stage === "IN_PRODUCTION");
  const delivered = order.status === "PAID" && (order.stage === "READY" || order.stage === "DELIVERED");
  const fileUrl = (fileId: string, inline = false) => `/api/orders/${order.id}/files/${fileId}${inline ? "?inline=1" : ""}`;
  const url = `/api/admin/orders/${order.id}`;

  return (
    <>
      <Link href="/admin/payments" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink">
        <ArrowLeft className="size-3.5" /> Payments & orders
      </Link>
      <PageHeader
        eyebrow={wizard ? productName(order.product) : `${planName(order.plan)} plan`}
        title={`Order ${ref}`}
        description={`${order.user.name} · ${event?.title ?? "No event"} · ${money(order.amount, order.currency)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.stage} />
            <StatusBadge status={order.status} />
          </div>
        }
      />

      {/* Actions for the current stage */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper p-4">
        {verifiable ? (
          <>
            <AdminAction
              url={url}
              body={{ action: "approve" }}
              label="Approve payment"
              icon={<CheckCircle2 className="size-4" />}
              variant="primary"
              confirm={{
                title: `Approve payment for ${ref}?`,
                description: `Only approve once ${money(order.amount, order.currency)} has arrived in the bank account. The customer is then sent their order${wizard && order.product && needsProduction(order.product, order.designSource ?? "TEMPLATE") ? " and it goes to the design team" : ""}.`,
                confirmLabel: "Approve",
                tone: "accent",
                reason: { label: "Bank reference or note (optional)", placeholder: "e.g. Al Rajhi transfer 19 Oct, ref 123456" },
                checkbox: { field: "confirmed", label: "I've checked the bank account and the transfer has arrived" },
              }}
            />
            {awaitingStaff ? (
              <>
                <AdminAction
                  url={url}
                  body={{ action: "request_info" }}
                  label="Request more information"
                  icon={<MessageSquareWarning className="size-4" />}
                  variant="outline"
                  confirm={{
                    title: "Ask the customer for more information",
                    description: "They're emailed your message and can reply from their order page.",
                    confirmLabel: "Send request",
                    reason: {
                      label: "What do you need?",
                      placeholder: "e.g. We can't find a transfer for this amount — please upload the receipt.",
                      required: true,
                      minLength: 5,
                    },
                  }}
                />
                <AdminAction
                  url={url}
                  body={{ action: "reject" }}
                  label="Reject payment"
                  icon={<XCircle className="size-4" />}
                  variant="outline"
                  confirm={{
                    title: `Reject the payment for ${ref}?`,
                    description: "The customer is told the reason and can correct it and resubmit.",
                    confirmLabel: "Reject",
                    tone: "danger",
                    reason: { label: "Reason (shown to the customer)", required: true, minLength: 5 },
                  }}
                />
              </>
            ) : null}
          </>
        ) : null}
        {production ? (
          <>
            <FinalFileUpload orderId={order.id} />
            <AdminAction
              url={url}
              body={{ action: "mark_ready" }}
              label="Mark ready & deliver"
              icon={<Send className="size-4" />}
              variant="primary"
              disabled={!finals.length}
              title={finals.length ? undefined : "Upload the final design first"}
              confirm={{
                title: "Deliver the final files?",
                description:
                  "The customer is emailed secure download links, notified in their account (and on WhatsApp if they opted in). Check the files are final.",
                confirmLabel: "Deliver",
                tone: "accent",
              }}
            />
          </>
        ) : null}
        {delivered ? (
          <AdminAction
            url={url}
            body={{ action: "retry_delivery" }}
            label="Retry delivery"
            icon={<Truck className="size-4" />}
            variant="outline"
            successMessage="Delivery queued"
          />
        ) : null}
        {!verifiable && !production && !delivered ? <Muted>No action needed at this stage.</Muted> : null}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <section>
            <SectionTitle title="Payment" description="An uploaded receipt is evidence only — confirm the money in the bank before approving." />
            <KeyValues
              items={[
                { label: "Amount", value: <span className="font-medium">{money(order.amount, order.currency)}</span> },
                ...lines.map((l) => ({ label: LINE_LABEL[l.key] ?? humanize(l.key), value: money(l.amount, order.currency) })),
                ...(order.promoCode ? [{ label: "Discount code", value: order.promoCode.code }] : []),
                { label: "Transfer reference", value: order.transferReference || <Muted>None given</Muted> },
                { label: "Reference to quote", value: ref },
                { label: "Provider", value: humanize(order.provider) },
                ...(order.customerNote ? [{ label: "Customer's reply", value: <span className="whitespace-pre-line">{order.customerNote}</span> }] : []),
                ...(order.rejectionReason ? [{ label: "Rejection reason", value: order.rejectionReason }] : []),
                ...(order.infoRequest ? [{ label: "Information requested", value: order.infoRequest }] : []),
                ...(order.receiptNumber
                  ? [
                      {
                        label: "Receipt",
                        value: (
                          <a className="underline" href={`/receipt/${order.id}`}>
                            {order.receiptNumber}
                          </a>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-ink">Customer&apos;s transfer receipts</p>
              {receipts.length ? (
                <ul className="flex flex-wrap gap-3">
                  {receipts.map((f) => (
                    <li key={f.id}>
                      <a
                        href={fileUrl(f.id, true)}
                        target="_blank"
                        rel="noopener"
                        className="block w-36 overflow-hidden rounded-xl border border-line bg-paper text-[12px] hover:border-bronze-300"
                      >
                        {f.mimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- private file, served by an admin-checked route
                          <img src={fileUrl(f.id, true)} alt="" className="h-32 w-full object-cover" />
                        ) : (
                          <span className="flex h-32 items-center justify-center bg-sand">
                            <FileText className="size-8 text-bronze-600" />
                          </span>
                        )}
                        <span className="block truncate px-2 py-1.5">{f.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Muted>No receipt uploaded.</Muted>
              )}
            </div>
          </section>

          <section>
            <SectionTitle title="Design requirements" />
            <KeyValues
              items={[
                { label: "Product", value: productName(order.product) },
                { label: "Design", value: event ? humanize(event.designSource) + (event.designSource === "TEMPLATE" ? ` · ${event.themeKey}` : "") : "—" },
                ...(event?.designBrief ? [{ label: "Brief", value: <span className="whitespace-pre-line">{event.designBrief}</span> }] : []),
                ...(event && event.product !== "PHOTO_ONLY"
                  ? [
                      { label: "QR codes", value: humanize(features.qr) },
                      { label: "WhatsApp invitations", value: features.whatsapp ? "Yes" : "No" },
                      { label: "Guests", value: String(order.guestLimit) },
                    ]
                  : []),
              ]}
            />
            {referenceUrls.length ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-ink">Reference images</p>
                <ul className="flex flex-wrap gap-3">
                  {referenceUrls.map((u, i) =>
                    u ? (
                      <li key={i}>
                        <a href={u} target="_blank" rel="noopener">
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                          <img src={u} alt="" className="size-28 rounded-xl border border-line object-cover" />
                        </a>
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ) : null}
            {uploadUrl ? (
              <p className="mt-3 text-sm">
                <a className="underline" href={uploadUrl} target="_blank" rel="noopener">
                  Customer&apos;s uploaded design
                </a>
              </p>
            ) : null}
          </section>

          {wizard ? (
            <section>
              <SectionTitle title="Final files" description="Delivered to the customer only after approval; downloads are checked on the server." />
              {finals.length ? (
                <ul className="space-y-2">
                  {finals.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm">
                      <FileText className="size-4 text-bronze-600" />
                      <a href={fileUrl(f.id)} className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">
                        {f.name}
                      </a>
                      <Muted>
                        {size(f.size)}
                        {f.width ? ` · ${f.width}×${f.height}` : ""} ·{" "}
                        {f.uploadedById ? `uploaded by ${actors.get(f.uploadedById)?.name ?? "staff"}` : "rendered"}
                      </Muted>
                      {production ? (
                        <AdminAction
                          url={`/api/admin/orders/${order.id}/files/${f.id}`}
                          method="DELETE"
                          label="Remove"
                          variant="ghost"
                          size="sm"
                          confirm={{ title: `Remove ${f.name}?`, confirmLabel: "Remove", tone: "danger" }}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Muted>{production ? "No final files yet — upload the finished design." : "None yet."}</Muted>
              )}
            </section>
          ) : null}

          {order.deliveries.length ? (
            <section>
              <SectionTitle title="Deliveries" description="Each channel is sent once; failures are recorded and never shown as delivered." />
              <DataTable
                rows={order.deliveries}
                rowKey={(r) => r.id}
                columns={[
                  { key: "channel", header: "Channel", cell: (r) => humanize(r.channel) },
                  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  { key: "attempts", header: "Attempts", cell: (r) => r.attempts },
                  { key: "sent", header: "Sent", cell: (r) => (r.sentAt ? dt(r.sentAt) : <Muted>—</Muted>) },
                  { key: "error", header: "Note", cell: (r) => (r.error ? <span className="text-[13px] text-ink-soft">{r.error}</span> : <Muted>—</Muted>) },
                ]}
              />
            </section>
          ) : null}

          <section>
            <SectionTitle title="History" description="Every stage change and payment decision, with who made it." />
            <DataTable
              rows={order.history}
              rowKey={(r) => r.id}
              columns={[
                { key: "at", header: "When", cell: (r) => dt(r.createdAt) },
                { key: "stage", header: "Stage", cell: (r) => (r.from && r.from !== r.to ? `${humanize(r.from)} → ${humanize(r.to)}` : humanize(r.to)) },
                {
                  key: "by",
                  header: "By",
                  cell: (r) => {
                    const a = r.actorId ? actors.get(r.actorId) : null;
                    return a ? `${a.name}${a.role === "ADMIN" ? " (staff)" : ""}` : <Muted>System</Muted>;
                  },
                },
                { key: "note", header: "Note", cell: (r) => (r.note ? <span className="whitespace-pre-line text-[13px]">{r.note}</span> : <Muted>—</Muted>) },
              ]}
            />
          </section>
        </div>

        <aside className="space-y-8">
          <section>
            <SectionTitle title="Customer" />
            <KeyValues
              items={[
                {
                  label: "Name",
                  value: (
                    <Link className="underline" href={`/admin/customers/${order.user.id}`}>
                      {order.user.name}
                    </Link>
                  ),
                },
                { label: "Email", value: order.user.email },
                { label: "Phone", value: order.user.phone ?? <Muted>—</Muted> },
                { label: "WhatsApp updates", value: order.user.whatsappUpdatesAt ? `Opted in ${dt(order.user.whatsappUpdatesAt)}` : "Not opted in" },
              ]}
            />
          </section>
          {event ? (
            <section>
              <SectionTitle title="Event" />
              <KeyValues
                items={[
                  {
                    label: "Title",
                    value: (
                      <Link className="underline" href={`/admin/events/${event.id}`}>
                        {event.title}
                      </Link>
                    ),
                  },
                  { label: "Occasion", value: humanize(event.type) },
                  { label: "When", value: eventWhen(event, true) },
                  ...(event.venueName ? [{ label: "Venue", value: `${event.venueName}${event.address ? ` · ${event.address}` : ""}` }] : []),
                  { label: "Hosts", value: event.hostNames || <Muted>—</Muted> },
                ]}
              />
            </section>
          ) : null}
          <section>
            <SectionTitle title="Timestamps" />
            <KeyValues
              items={[
                { label: "Created", value: dt(order.createdAt) },
                { label: "Submitted", value: order.submittedAt ? dt(order.submittedAt) : <Muted>—</Muted> },
                {
                  label: "Approved",
                  value: order.approvedAt ? (
                    `${dt(order.approvedAt)}${order.decidedById ? ` · ${actors.get(order.decidedById)?.name ?? ""}` : ""}`
                  ) : (
                    <Muted>—</Muted>
                  ),
                },
                { label: "Rejected", value: order.rejectedAt ? dt(order.rejectedAt) : <Muted>—</Muted> },
                { label: "Ready", value: order.readyAt ? dt(order.readyAt) : <Muted>—</Muted> },
                { label: "Delivered", value: order.deliveredAt ? dt(order.deliveredAt) : <Muted>—</Muted> },
              ]}
            />
          </section>
          {preview ? (
            <section>
              <SectionTitle title="Design (full, staff only)" />
              <CardPreview {...preview} className="w-full rounded-[3px] shadow-lift ring-1 ring-ink/5" title="Invitation" />
              <p className="mt-2 text-[12px] text-ink-faint">
                Customers see{" "}
                <a className="underline" href={`/api/events/${event!.id}/preview`} target="_blank" rel="noopener">
                  the protected preview
                </a>{" "}
                until approval.
              </p>
            </section>
          ) : null}
          {!wizard ? (
            <p className="flex items-start gap-2 text-[13px] text-ink-faint">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" /> A plan purchase from before the order wizard: approving activates the plan and sends the
              receipt.
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
