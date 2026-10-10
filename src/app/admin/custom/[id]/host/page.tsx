import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { env } from "@/server/env";
import { customStepLinks, customStepPage } from "@/server/custom/pages";
import { lookupCustomer } from "@/server/custom/service";
import { str, type SearchParams } from "@/server/admin/params";
import { isUnlimited, planPrice } from "@/lib/plans";
import { utcToZoned } from "@/lib/time";
import { CustomSteps } from "@/components/admin/custom-steps";
import { CustomPackageForm, type CustomPackageValues } from "@/components/admin/custom-package-form";
import { INCLUDED_EXAMPLE } from "@/lib/validation/custom-package";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Host & payment · Custom event" };

/** Step 3 of a custom event: the host's name and contact, and the price and guest allowance. */
export default async function CustomHostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { id } = await params;
  const forHost = str(await searchParams, "for", 160);
  const { event, order, draft } = await customStepPage(id, "host");
  // A paid package can't change any more.
  if (order?.status === "PAID") redirect(`/admin/custom/${event.id}/send`);
  const e = env();
  const pending = order?.status === "PENDING" ? order : null;
  const email = pending?.user.email ?? (forHost.includes("@") ? forHost.toLowerCase() : draft ? "" : event.user.email);
  const customer = email ? await lookupCustomer(email) : null;
  const locale: "en" | "ar" = (pending?.user.locale ?? customer?.locale) === "ar" ? "ar" : "en";
  const decimals = ["KWD", "BHD", "OMR"].includes(e.PAYMENT_CURRENCY) ? 3 : 2;
  const initial: CustomPackageValues = {
    host: {
      email,
      name: pending?.user.name ?? customer?.name ?? "",
      phone: pending?.user.phone ?? customer?.phone ?? "",
      locale,
    },
    package: pending
      ? {
          unlimited: isUnlimited(pending.guestLimit),
          guestLimit: isUnlimited(pending.guestLimit) ? "" : String(pending.guestLimit),
          price: String(pending.amount / 10 ** decimals),
          included: pending.title ?? "",
          dueDate: pending.dueAt ? utcToZoned(pending.dueAt, event.timezone).date : "",
          note: pending.note ?? "",
        }
      : { unlimited: true, guestLimit: "", price: "", included: INCLUDED_EXAMPLE[locale], dueDate: "", note: "" },
  };

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
        eyebrow={draft ? "Custom event · draft" : `Custom event · ${event.user.name}`}
        title="Host & payment"
        description={
          pending
            ? "Change the host or the package. The host keeps the same payment link — unless you change the host, then the old link stops working."
            : "Who the event is for and what they pay. Saving creates the secure payment link and moves the event into the host's account."
        }
      />
      <CustomSteps current={2} links={customStepLinks(event.id, Boolean(order))} />
      <CustomPackageForm
        eventId={event.id}
        initial={initial}
        initialCustomer={customer}
        existing={Boolean(pending)}
        eventDate={utcToZoned(event.startsAt, event.timezone).date}
        currency={e.PAYMENT_CURRENCY}
        planPrices={{ standard: planPrice("BASIC", e.PAYMENT_CURRENCY), premium: planPrice("PREMIUM", e.PAYMENT_CURRENCY) }}
      />
    </>
  );
}
