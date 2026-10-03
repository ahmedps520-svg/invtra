import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { lookupCustomer } from "@/server/custom/service";
import { env } from "@/server/env";
import { planPrice } from "@/lib/plans";
import { str, type SearchParams } from "@/server/admin/params";
import { PageHeader } from "@/components/admin/ui";
import { CustomEventWizard } from "@/components/admin/custom-wizard";

export const metadata: Metadata = { title: "New custom event" };

export default async function NewCustomEventPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const email = str(await searchParams, "email", 160);
  const e = env();
  const initialCustomer = email.includes("@")
    ? await lookupCustomer(email)
    : null;
  const approved = await db.messageTemplate.count({
    where: { purpose: "PAYMENT_REQUEST", status: "APPROVED", isActive: true },
  });
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
        eyebrow="Business"
        title="New custom event"
        description="Set up an event for a host with your own price and guest allowance, then send them a secure payment link."
      />
      <CustomEventWizard
        initialEmail={email.includes("@") ? email : ""}
        initialCustomer={initialCustomer}
        currency={e.PAYMENT_CURRENCY}
        testPayments={e.PAYMENT_PROVIDER === "mock"}
        whatsappReady={approved > 0}
        planPrices={{
          standard: planPrice("BASIC", e.PAYMENT_CURRENCY),
          premium: planPrice("PREMIUM", e.PAYMENT_CURRENCY),
        }}
      />
    </>
  );
}
