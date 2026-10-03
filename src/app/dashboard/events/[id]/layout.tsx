import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { findOwnedEvent } from "@/server/events/access";
import { formatDate, formatTime } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EventStepNav } from "@/components/dashboard/event-steps";
import { loadSteps } from "../../_lib/progress";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}`);
  const event = await findOwnedEvent(user.id, id);
  if (!event) notFound();
  const { dict, locale } = await getI18n();
  const d = dict.dashboard;
  const { steps } = await loadSteps(event);

  const ar = locale === "ar";
  const title = ar && event.titleAr ? event.titleAr : event.title;
  const venue = ar && event.venueNameAr ? event.venueNameAr : event.venueName;
  const date = formatDate(event.startsAt, { locale, timeZone: event.timezone, style: "full" });
  const time = formatTime(event.startsAt, { locale, timeZone: event.timezone });

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
                {date} · {time}
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
            {event.firstSentAt ? (
              <Badge tone="sage" dot>
                {d.header.sent}
              </Badge>
            ) : null}
            {event.plan ? (
              <Badge tone="bronze">{fmt(d.header.plan, { plan: dict.common.plans[event.plan] })}</Badge>
            ) : (
              <Badge>{d.header.noPlan}</Badge>
            )}
          </div>
        </div>
        <div className="mt-8">
          <EventStepNav eventId={event.id} steps={steps} />
        </div>
      </header>
      <div className="mt-10">{children}</div>
    </div>
  );
}
