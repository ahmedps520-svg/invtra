import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { findOwnedEvent } from "@/server/events/access";
import { eventToInput } from "@/server/events/service";
import { EventForm } from "@/components/dashboard/event-form";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.details };
}

export default async function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/details`);
  const event = await findOwnedEvent(user.id, id, { scheduleItems: { orderBy: { sortOrder: "asc" } } });
  if (!event) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <EventForm mode="edit" eventId={event.id} initial={eventToInput(event)} />
    </div>
  );
}
