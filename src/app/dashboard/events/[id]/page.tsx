import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { findOwnedEvent } from "@/server/events/access";
import { eventStats } from "@/server/events/service";
import { cardPreviewProps } from "@/server/events/preview";
import { sendReadiness, staleAcceptedCount } from "@/server/sending/service";
import { EventOverview } from "@/components/dashboard/overview";
import { doorClosesAt, doorUrl } from "@/server/door/service";
import { reminderOverview } from "@/server/reminders/service";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.overview };
}

export default async function EventOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}`);
  const event = await findOwnedEvent(user.id, id);
  if (!event) notFound();

  const [stats, activity, batch, stale, preview, readiness, reminders] = await Promise.all([
    eventStats(event.id),
    db.activity.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.sendBatch.findFirst({ where: { eventId: event.id, kind: { not: "TEST" } }, orderBy: { createdAt: "desc" } }),
    staleAcceptedCount(event),
    cardPreviewProps(event),
    sendReadiness(event),
    reminderOverview(event),
  ]);

  return (
    <EventOverview
      eventId={event.id}
      eventTitle={event.title}
      preview={preview}
      ready={readiness.ready}
      unsent={readiness.unsent}
      reminders={reminders}
      door={{ url: event.doorToken ? doorUrl(event.doorToken) : null, closesAt: doorClosesAt(event).toISOString(), timeZone: event.timezone }}
      // eslint-disable-next-line react-hooks/purity -- request time for relative timestamps
      serverNow={Date.now()}
      initial={{
        stats,
        activity: activity.map((a) => ({
          id: a.id,
          kind: a.kind,
          data: (a.data ?? null) as Record<string, unknown> | null,
          createdAt: a.createdAt.toISOString(),
          guestId: a.guestId,
        })),
        latestBatch: batch
          ? { id: batch.id, total: batch.total, sent: batch.sent, failed: batch.failed, skipped: batch.skipped, status: batch.status, kind: batch.kind }
          : null,
        staleAccepted: stale,
      }}
    />
  );
}
