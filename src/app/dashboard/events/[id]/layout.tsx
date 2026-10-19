import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin, ScanLine } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { db } from "@/server/db";
import { findGuestAccess } from "@/server/events/cohosts";

import { fmt } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { CoHostNav, EventStepNav, OrderStepNav } from "@/components/dashboard/event-steps";
import { orderStepKeys } from "@/components/dashboard/order-steps";
import { computeOrderSteps, loadSteps } from "../../_lib/progress";
import { currentOrder } from "@/server/orders/service";
import { isUnlocked } from "@/server/render/preview";
import { whenLabel } from "@/lib/event-when";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}`);
  const access = await findGuestAccess(user, id);
  if (!access) notFound();
  const { event, coHost } = access;
  const { dict, locale } = await getI18n();
  const d = dict.dashboard;
  // Co-hosts see their own list and sending; everything else stays with the owner. Until the
  // event is paid for, the owner goes through the order wizard instead.
  const ordering = !coHost && !isUnlocked(event);
  const order = ordering ? await currentOrder(event.id) : null;
  const steps = coHost || ordering ? null : (await loadSteps(event)).steps;
  const orderSteps = ordering ? computeOrderSteps(event, order) : null;
  const owner = coHost ? await db.user.findUnique({ where: { id: event.userId }, select: { name: true, email: true } }) : null;

  const ar = locale === "ar";
  const title = ar && event.titleAr ? event.titleAr : event.title;
  const venue = ar && event.venueNameAr ? event.venueNameAr : event.venueName;
  const when = whenLabel(event, locale);

  return (
    <div>
      <header className="animate-fade-up">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium text-ink-faint transition hover:text-ink"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          {d.header.back}
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="eyebrow">{dict.common.eventTypes[event.type]}</p>
            <h1 className="mt-2.5 font-display text-[2.1rem] leading-[1.1] text-ink sm:text-5xl">{title}</h1>
            <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4 text-bronze-500" />
                {when}
              </span>
              <span className="inline-flex min-w-0 items-center gap-2">
                <MapPin className="size-4 shrink-0 text-bronze-500" />
                <span className="truncate">{venue}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* The guest website exactly as an accepted guest sees it (sample guest, full screen). */}
            <a href={`/preview/${event.id}`} target="_blank" rel="noopener" className={buttonClasses("outline", "sm")}>
              <ExternalLink className="size-3.5" />
              {d.header.viewGuestPage}
            </a>
            {coHost ? (
              <Badge tone="bronze">{fmt(d.cohosts.badge, { label: coHost.label })}</Badge>
            ) : (
              <>
                {/* Arrivals and door scans on the night. */}
                <Link href={`/dashboard/events/${event.id}/checkin`} className={buttonClasses("outline", "sm")}>
                  <ScanLine className="size-3.5" />
                  {dict.door.checkin.open}
                </Link>
                {event.firstSentAt ? (
                  <Badge tone="sage" dot>
                    {d.header.sent}
                  </Badge>
                ) : null}
                {event.plan ? (
                  <Badge tone="bronze">{fmt(d.header.plan, { plan: dict.common.plans[event.plan] })}</Badge>
                ) : order && order.stage !== "DRAFT" ? (
                  <Link href={`/dashboard/orders/${order.id}`}>
                    <Badge tone={order.stage === "REJECTED" || order.stage === "INFO_REQUIRED" ? "rosewood" : "ochre"} dot>
                      {d.orders.stages[order.stage]}
                    </Badge>
                  </Link>
                ) : event.purchasedAt ? (
                  <Badge tone="bronze">{d.orders.products[event.product]}</Badge>
                ) : (
                  <Badge>{d.header.noPlan}</Badge>
                )}
              </>
            )}
          </div>
        </div>
        {owner ? <p className="mt-3 text-sm text-ink-faint">{fmt(d.cohosts.hostedBy, { owner: owner.name || owner.email })}</p> : null}
        <div className="mt-8">
          {orderSteps ? (
            <OrderStepNav eventId={event.id} keys={orderStepKeys(event.product)} steps={orderSteps} />
          ) : steps ? (
            event.product === "PHOTO_ONLY" ? null : <EventStepNav eventId={event.id} steps={steps} />
          ) : (
            <CoHostNav eventId={event.id} />
          )}
        </div>
      </header>
      <div className="mt-10">{children}</div>
    </div>
  );
}
