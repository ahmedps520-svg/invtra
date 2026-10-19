import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { ownerEventOrList } from "@/app/dashboard/_lib/access";
import { eventStats } from "@/server/events/service";
import { cardView } from "@/server/events/preview";
import { sendReadiness, staleAcceptedCount } from "@/server/sending/service";
import { EventOverview } from "@/components/dashboard/overview";
import { doorClosesAt, doorUrl } from "@/server/door/service";
import { reminderOverview } from "@/server/reminders/service";
import { eventDesign } from "@/server/events/design";
import { statusVideo, statusVideoFilename } from "@/server/video/status";
import { backdrop } from "@/server/video/compose";
import Link from "next/link";
import { currentOrder } from "@/server/orders/service";
import { isUnlocked } from "@/server/render/preview";
import { computeOrderSteps } from "@/app/dashboard/_lib/progress";
import { nextOrderStep, orderStepHref, ORDER_STEP_LABEL } from "@/components/dashboard/order-steps";
import { OrderBanner } from "@/components/dashboard/orders/order-banner";
import { EventCard } from "@/components/invitation/event-card";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.overview };
}

export default async function EventOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}`);
  const event = await ownerEventOrList(user.id, id);
  const { dict } = await getI18n();

  // The order wizard's progress, or where the latest order stands (until it's delivered).
  const order = await currentOrder(event.id);
  const unlocked = isUnlocked(event);
  const next = unlocked ? null : nextOrderStep(computeOrderSteps(event, order), event.product);
  const banner = (
    <OrderBanner
      dict={dict}
      order={order && order.stage !== "DELIVERED" ? { id: order.id, stage: order.stage } : null}
      nextStep={next ? { href: orderStepHref(event.id, next), label: dict.dashboard.orders.steps[ORDER_STEP_LABEL[next]] } : null}
    />
  );

  // Photo only: no guests or sending — the invitation image and the order are all there is.
  if (event.product === "PHOTO_ONLY") {
    return (
      <div>
        {banner}
        <div className="grid items-start gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="paper-grain flex justify-center rounded-3xl bg-sand/70 p-6">
            <EventCard view={await cardView(event)} title={event.title} className="w-full max-w-[280px] rounded-[3px] shadow-lift" />
          </div>
          {order ? (
            <div className="space-y-3 text-[15px] text-ink-soft">
              <p className="font-display text-2xl text-ink">{dict.dashboard.orders.products.PHOTO_ONLY}</p>
              <p>{dict.dashboard.orders.stageHelp[order.stage]}</p>
              <Link href={`/dashboard/orders/${order.id}`} className={buttonClasses("outline", "md")}>
                {dict.dashboard.orders.done.view}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const [stats, activity, batch, stale, preview, readiness, reminders, video] = await Promise.all([
    eventStats(event.id),
    db.activity.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.sendBatch.findFirst({ where: { eventId: event.id, kind: { not: "TEST" } }, orderBy: { createdAt: "desc" } }),
    staleAcceptedCount(event),
    cardView(event),
    sendReadiness(event),
    reminderOverview(event),
    statusVideo(event),
  ]);

  return (
    <>
      {banner}
      <EventOverview
        eventId={event.id}
        eventTitle={event.title}
        preview={preview}
        ready={readiness.ready}
        unsent={readiness.unsent}
        reminders={reminders}
        video={{
          initial: video,
          hasPlan: Boolean(event.plan),
          hasMusic: Boolean(event.musicKey),
          filename: statusVideoFilename(event.title),
          stage: backdrop(eventDesign(event).palette),
        }}
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
    </>
  );
}
