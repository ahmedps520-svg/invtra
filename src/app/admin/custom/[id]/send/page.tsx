import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Palette, Receipt } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getCustomPackage } from "@/server/custom/service";
import { cardPreviewProps } from "@/server/events/preview";
import { guestsLabel } from "@/server/payments/receipts";
import { CardPreview } from "@/components/invitation/card-preview";
import { CustomSteps } from "@/components/admin/custom-steps";
import { SendLinkPanel } from "@/components/admin/send-link-panel";
import { KeyValues, PageHeader, StatusBadge } from "@/components/admin/ui";
import {
  dt,
  eventDate,
  eventDateTime,
  money,
  rel,
} from "@/components/admin/format";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Send link · Custom event" };

/** Step 7 of a custom event: check the invitation and package, then send the payment link. */
export default async function CustomSendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const pkg = await getCustomPackage(id);
  if (!pkg) notFound();
  const [preview, approved] = await Promise.all([
    cardPreviewProps(pkg.event),
    db.messageTemplate.count({
      where: { purpose: "PAYMENT_REQUEST", status: "APPROVED", isActive: true },
    }),
  ]);
  const event = pkg.event;

  return (
    <>
      <Link
        href="/admin/custom"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Custom events
      </Link>
      <PageHeader
        eyebrow={`Custom event · ${pkg.user.name}`}
        title="Send the payment link"
        description="Check the invitation and the package, then send the host their secure payment link."
      />
      <CustomSteps
        current={6}
        links={{ 5: `/admin/custom/${pkg.id}/design` }}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <section aria-label="Invitation">
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
            href={`/admin/custom/${pkg.id}/design`}
            className={buttonClasses("outline", "sm", "mt-3")}
          >
            <Palette className="size-3.5" />
            Edit design
          </Link>
        </section>

        <div className="space-y-8">
          <div className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-3xl text-ink">
                {money(pkg.amount, pkg.currency)}
              </p>
              <StatusBadge
                status={pkg.status}
                label={
                  pkg.status === "PENDING"
                    ? "Awaiting payment"
                    : pkg.status === "CANCELLED"
                      ? "Withdrawn"
                      : undefined
                }
              />
            </div>
            <KeyValues
              items={[
                {
                  label: "Host",
                  value: `${pkg.user.name} · ${pkg.user.email}${pkg.user.phone ? ` · ${pkg.user.phone}` : ""}`,
                },
                {
                  label: "Event",
                  value: `${event.title} · ${eventDateTime(event.startsAt, event.timezone)}`,
                },
                { label: "Guests", value: guestsLabel(pkg.guestLimit, false) },
                ...(pkg.title
                  ? [
                      {
                        label: "Included",
                        value: (
                          <span className="whitespace-pre-line">
                            {pkg.title}
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(pkg.dueAt
                  ? [
                      {
                        label: "Pay by",
                        value: eventDate(pkg.dueAt, event.timezone),
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          {pkg.status === "PENDING" ? (
            <SendLinkPanel
              orderId={pkg.id}
              payUrl={pkg.payUrl}
              hasPhone={Boolean(pkg.user.phone)}
              whatsappReady={approved > 0}
              testPayments={env().PAYMENT_PROVIDER === "mock"}
              lastSent={
                pkg.requestSentAt
                  ? `${rel(pkg.requestSentAt)} (${dt(pkg.requestSentAt)} UTC)`
                  : null
              }
            />
          ) : pkg.status === "PAID" ? (
            <div className="rounded-2xl border border-sage/25 bg-sage-soft px-5 py-5 text-[14px] text-ink-soft">
              <p className="font-medium text-ink">
                Paid {pkg.paidAt ? dt(pkg.paidAt) : ""}
              </p>
              <p className="mt-1">
                The plan is active and the host has their receipt.
              </p>
              {pkg.receiptNumber ? (
                <Link
                  href={`/receipt/${pkg.id}`}
                  className={buttonClasses("outline", "sm", "mt-4")}
                >
                  <Receipt className="size-3.5" />
                  Receipt {pkg.receiptNumber}
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-sand/40 px-5 py-4 text-[14px] text-ink-soft">
              This package was withdrawn — its payment link no longer works.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
