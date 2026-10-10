import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { customStepLinks, customStepPage } from "@/server/custom/pages";
import { eventToInput } from "@/server/events/service";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { EventForm } from "@/components/dashboard/event-form";
import { CustomSteps } from "@/components/admin/custom-steps";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Event · Custom event" };

/** Step 1 of a custom event (editing): every detail, all optional but the occasion and date. */
export default async function CustomDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { event, order, draft } = await customStepPage(id, "details");
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
        title="Event details"
        description="Leave out anything you don't want on the invitation — the names, the venue or the address — and add any extra details guests should know."
      />
      <CustomSteps current={0} links={customStepLinks(event.id, Boolean(order))} />
      <I18nProvider locale="en" dict={pickNamespaces("en", ["common", "dashboard", "themes"])}>
        <EventForm
          mode="edit"
          eventId={event.id}
          initial={eventToInput(event)}
          custom={{ saveUrl: `/api/admin/custom/events/${event.id}`, next: "/admin/custom/:id/design", submitLabel: "Save & continue to design" }}
        />
      </I18nProvider>
    </>
  );
}
