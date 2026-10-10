import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Palette,
  Receipt,
  RotateCcw,
  UserPen,
} from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { customStepLinks, customStepPage } from "@/server/custom/pages";
import { isTestPaid } from "@/server/payments/service";
import { orderReference } from "@/server/payments/bank";
import { paymentRequestWhatsAppUrl } from "@/server/custom/service";
import { AdminAction } from "@/components/admin/actions";
import { cardPreviewProps } from "@/server/events/preview";
import { guestsLabel } from "@/server/payments/receipts";
import { CardPreview } from "@/components/invitation/card-preview";
import { CustomSteps } from "@/components/admin/custom-steps";
import { SendLinkPanel } from "@/components/admin/send-link-panel";
import { KeyValues, PageHeader, StatusBadge } from "@/components/admin/ui";
import {
  dt,
  eventDate,
  money,
  rel,
  eventWhen,
} from "@/components/admin/format";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Send link · Custom event" };

/** Step 4 of a custom event: check the invitation and package, then send the payment link. */
export default async function CustomSendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { event, order: pkg } = await customStepPage(id, "send");
  // No payment link yet: the host and the price come first.
  if (!pkg) redirect(`/admin/custom/${event.id}/host`);
  const [preview, approved, testPaid] = await Promise.all([
    cardPreviewProps(event),
    db.messageTemplate.count({
      where: { purpose: "PAYMENT_REQUEST", status: "APPROVED", isActive: true },
    }),
    pkg.status === "PAID" ? isTestPaid(pkg.id) : false,
  ]);

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
      <CustomSteps current={3} links={customStepLinks(event.id, true)} />

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
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/admin/custom/${event.id}/design`}
              className={buttonClasses("outline", "sm")}
            >
              <Palette className="size-3.5" />
              Edit design
            </Link>
            {pkg.status === "PENDING" ? (
              <Link
                href={`/admin/custom/${event.id}/host`}
                className={buttonClasses("outline", "sm")}
              >
                <UserPen className="size-3.5" />
                Edit host & price
              </Link>
            ) : null}
          </div>
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
                  value: `${event.title} · ${eventWhen(event, true)}`,
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
              whatsappOff={env().WHATSAPP_PROVIDER === "off"}
              ownWhatsAppUrl={
                env().WHATSAPP_PROVIDER === "off"
                  ? paymentRequestWhatsAppUrl({ ...pkg, event })
                  : null
              }
              emailReady={
                env().EMAIL_PROVIDER === "smtp" ||
                env().NODE_ENV !== "production"
              }
              lastSent={
                pkg.requestSentAt
                  ? `${rel(pkg.requestSentAt)} (${dt(pkg.requestSentAt)} UTC)`
                  : null
              }
            />
          ) : null}

          {pkg.status === "PENDING" ? (
            env().PAYMENT_PROVIDER === "manual" ? (
              <div className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6">
                <p className="font-medium text-ink">Paid by bank transfer</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                  The host sees your bank details on the payment link and sends
                  the transfer receipt on WhatsApp with the reference{" "}
                  <span className="font-medium text-ink" dir="ltr">
                    {orderReference(pkg.id)}
                  </span>
                  . Once the money is in your account, mark it paid: the plan
                  switches on and the host gets a numbered receipt.
                </p>
                <AdminAction
                  url={`/api/admin/orders/${pkg.id}`}
                  body={{ action: "mark_paid" }}
                  label="Mark as paid"
                  variant="primary"
                  className="mt-4"
                  icon={<CheckCircle2 className="size-3.5" />}
                  successMessage="Marked paid — the plan is active"
                  confirm={{
                    title: "Mark this package paid?",
                    description: `Confirms ${money(pkg.amount, pkg.currency)} arrived in your account and activates the package.`,
                    confirmLabel: "Mark as paid",
                    reason: {
                      label: "Transfer reference",
                      placeholder:
                        "e.g. bank transfer ref. or the date it arrived",
                      required: true,
                    },
                  }}
                />
              </div>
            ) : null
          ) : pkg.status === "PAID" ? (
            <div className="rounded-2xl border border-sage/25 bg-sage-soft px-5 py-5 text-[14px] text-ink-soft">
              <p className="font-medium text-ink">
                Paid {pkg.paidAt ? dt(pkg.paidAt) : ""}
              </p>
              {testPaid ? (
                <div className="mt-2 space-y-3">
                  <p>
                    <span className="font-medium text-ink">
                      This was a test payment — no money was taken.
                    </span>{" "}
                    Undo it to put the link back to awaiting payment, then send
                    it to the host. The link stays the same.
                  </p>
                  <AdminAction
                    url={`/api/admin/custom/${pkg.id}`}
                    body={{ action: "undo_test" }}
                    label="Undo test payment"
                    variant="primary"
                    icon={<RotateCcw className="size-3.5" />}
                    confirm={{
                      title: "Undo the test payment?",
                      description:
                        "The package goes back to awaiting payment with the same link, the test receipt is removed and the event goes back to having no plan until the host pays.",
                      confirmLabel: "Undo test payment",
                    }}
                  />
                </div>
              ) : (
                <p className="mt-1">
                  The plan is active and the host has their receipt.
                </p>
              )}
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
            <div className="rounded-2xl border border-line bg-sand/40 px-5 py-4 text-[14px] text-ink-soft">
              <p>
                This package was{" "}
                {pkg.status === "REFUNDED" ? "refunded" : "withdrawn"} — its
                payment link no longer works.
              </p>
              {pkg.status === "CANCELLED" ? (
                <Link
                  href={`/admin/custom/${event.id}/host`}
                  className={buttonClasses("outline", "sm", "mt-3")}
                >
                  <UserPen className="size-3.5" />
                  Offer a new package
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
