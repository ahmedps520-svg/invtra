import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { cardView } from "@/server/events/preview";
import { isUnlocked } from "@/server/render/preview";
import { currentOrder } from "@/server/orders/service";
import { nextOrderStep } from "@/components/dashboard/order-steps";
import type { Event } from "@prisma/client";
import { pickTemplate } from "@/server/whatsapp/compose";
import { coHostedEvents } from "@/server/events/cohosts";

import { fmt } from "@/lib/i18n/config";
import { buttonClasses } from "@/components/ui/button";
import { EventCard, type EventCardData } from "@/components/dashboard/event-card";
import { EventsEmptyState } from "@/components/dashboard/events-empty";
import { computeOrderSteps, computeSteps } from "./_lib/progress";
import { whenLabel } from "@/lib/event-when";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.events };
}

export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const { dict, locale } = await getI18n();
  const d = dict.dashboard;

  const [events, keeping] = await Promise.all([
    db.event.findMany({
      where: { userId: user.id, deletedAt: null, customDraft: false },
      orderBy: { startsAt: "asc" },
    }),
    coHostedEvents(user.id),
  ]);

  if (!events.length && !keeping.length) {
    return <EventsEmptyState firstName={user.name.split(" ")[0]} />;
  }

  const grouped = await db.guest.groupBy({
    by: ["eventId", "rsvpStatus"],
    where: { eventId: { in: events.map((e) => e.id) }, isTest: false },
    _count: true,
  });
  const count = (eventId: string, status?: string) =>
    grouped.filter((g) => g.eventId === eventId && (!status || g.rsvpStatus === status)).reduce((s, g) => s + g._count, 0);

  const now = new Date();
  const cards: EventCardData[] = await Promise.all(
    events.map(async (e) => {
      const total = count(e.id);
      const template = await pickTemplate(e, { locale: null }, "INVITATION");
      const showAr = locale === "ar";
      return {
        id: e.id,
        title: showAr && e.titleAr ? e.titleAr : e.title,
        hostNames: showAr && e.hostNamesAr ? e.hostNamesAr : e.hostNames,
        type: e.type,
        plan: e.plan,
        dateLabel: whenLabel(e, locale, { style: "long" }),
        venue: showAr && e.venueNameAr ? e.venueNameAr : e.venueName,
        preview: await cardView(e),
        counts: { total, accepted: count(e.id, "ACCEPTED"), declined: count(e.id, "DECLINED"), pending: count(e.id, "PENDING") },
        steps: computeSteps(e, total, Boolean(template)),
        past: !e.dateTbd && e.startsAt < now,
        ...(isUnlocked(e) ? {} : { order: await orderProgress(e) }),
      };
    }),
  );
  const upcoming = cards.filter((c) => !c.past);
  const past = cards.filter((c) => c.past).reverse();

  // Lists this user keeps for other people's events, with their own guests' replies.
  const theirs = keeping.length
    ? await db.guest.groupBy({ by: ["coHostId", "rsvpStatus"], where: { coHostId: { in: keeping.map((k) => k.id) }, isTest: false }, _count: true })
    : [];
  const listCount = (coHostId: string, status?: string) =>
    theirs.filter((g) => g.coHostId === coHostId && (!status || g.rsvpStatus === status)).reduce((s, g) => s + g._count, 0);
  const kept: EventCardData[] = await Promise.all(
    keeping.map(async (k) => {
      const e = k.event;
      const showAr = locale === "ar";
      return {
        id: e.id,
        title: showAr && e.titleAr ? e.titleAr : e.title,
        hostNames: showAr && e.hostNamesAr ? e.hostNamesAr : e.hostNames,
        type: e.type,
        plan: e.plan,
        dateLabel: whenLabel(e, locale, { style: "long" }),
        venue: showAr && e.venueNameAr ? e.venueNameAr : e.venueName,
        preview: await cardView(e),
        counts: { total: listCount(k.id), accepted: listCount(k.id, "ACCEPTED"), declined: listCount(k.id, "DECLINED"), pending: listCount(k.id, "PENDING") },
        steps: computeSteps(e, 0, false),
        past: !e.dateTbd && e.startsAt < now,
        coHost: { label: k.label, owner: e.user.name || e.user.email },
      };
    }),
  );

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{fmt(d.events.greeting, { name: user.name.split(" ")[0] })}</p>
          <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{d.events.title}</h1>
          <p className="mt-2 max-w-xl text-[15px] text-ink-soft">{d.events.subtitle}</p>
        </div>
        <Link href="/dashboard/events/new" className={buttonClasses("primary", "lg")}>
          <Plus className="size-4" />
          {d.events.newEvent}
        </Link>
      </div>

      {upcoming.length ? (
        <section className="mt-12" aria-labelledby="upcoming-h">
          <h2 id="upcoming-h" className="sr-only">
            {d.events.upcoming}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((c) => (
              <EventCard key={c.id} data={c} dict={dict} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {kept.length ? (
        <section className={upcoming.length ? "mt-16" : "mt-12"} aria-labelledby="keeping-h">
          <div className="mb-6 flex items-center gap-4">
            <h2 id="keeping-h" className="font-display text-2xl text-ink">
              {d.cohosts.keeping}
            </h2>
            <span className="hairline flex-1" aria-hidden />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {kept.map((c) => (
              <EventCard key={c.id} data={c} dict={dict} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {past.length ? (
        <section className="mt-16" aria-labelledby="past-h">
          <div className="mb-6 flex items-center gap-4">
            <h2 id="past-h" className="font-display text-2xl text-ink-soft">
              {d.events.past}
            </h2>
            <span className="hairline flex-1" aria-hidden />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {past.map((c) => (
              <EventCard key={c.id} data={c} dict={dict} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Where an unpaid event's order stands: the wizard's next step, or the submitted order. */
async function orderProgress(e: Event) {
  const order = await currentOrder(e.id);
  const next = nextOrderStep(computeOrderSteps(e, order), e.product);
  return { next, stage: order && order.stage !== "DRAFT" ? order.stage : null, orderId: order?.id ?? null };
}
