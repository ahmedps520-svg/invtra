import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { str, type SearchParams } from "@/server/admin/params";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { EventForm } from "@/components/dashboard/event-form";
import { CustomSteps } from "@/components/admin/custom-steps";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "New custom event" };

/** Step 1 of a custom event: the occasion and whatever details you have (most are optional). */
export default async function NewCustomEventPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  // From a customer's page (/admin/custom/new?email=…): prefill the host when the design is done.
  const email = str(await searchParams, "email", 160);
  const forHost = email.includes("@") ? `?for=${encodeURIComponent(email)}` : "";
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
        description="Start with the occasion and the date — everything else is optional and can be filled in later. Next you design the invitation; the host, the price and the payment link come last."
      />
      <CustomSteps current={0} />
      {/* The form's copy is English in the admin area. */}
      <I18nProvider locale="en" dict={pickNamespaces("en", ["common", "dashboard", "themes"])}>
        <EventForm
          mode="create"
          custom={{ saveUrl: "/api/admin/custom/events", next: `/admin/custom/:id/design${forHost}`, submitLabel: "Create & design the invitation" }}
        />
      </I18nProvider>
    </>
  );
}
