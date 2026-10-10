import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { cardPreviewProps } from "@/server/events/preview";
import { pickTemplate } from "@/server/whatsapp/compose";

import { fmt } from "@/lib/i18n/config";
import { buttonClasses } from "@/components/ui/button";
import { EventCard, type EventCardData } from "@/components/dashboard/event-card";
import { EventsEmptyState } from "@/components/dashboard/events-empty";
import { computeSteps } from "./_lib/progress";
import { whenLabel } from "@/lib/event-when";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.events };
}

export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const { dict, locale } = await getI18n();
  const d = dict.dashboard;

  const events = await db.event.findMany({
    where: { userId: user.id, deletedAt: null, customDraft: false },
    orderBy: { startsAt: "asc" },
  });

  if (!events.length) {
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
        preview: await cardPreviewProps(e),
        counts: { total, accepted: count(e.id, "ACCEPTED"), declined: count(e.id, "DECLINED"), pending: count(e.id, "PENDING") },
        steps: computeSteps(e, total, Boolean(template)),
        past: !e.dateTbd && e.startsAt < now,
      };
    }),
  );
  const upcoming = cards.filter((c) => !c.past);
  const past = cards.filter((c) => c.past).reverse();

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
