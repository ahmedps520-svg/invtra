import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { plural } from "./i18n";
import { doneCount, nextStep, stepHref, STEP_KEYS, type StepState } from "./steps";

type PreviewProps = React.ComponentProps<typeof CardPreview>;

export type EventCardData = {
  id: string;
  title: string;
  hostNames: string;
  type: string;
  plan: string | null;
  dateLabel: string;
  venue: string;
  preview: PreviewProps;
  counts: { total: number; accepted: number; declined: number; pending: number };
  steps: StepState;
  past: boolean;
};

/** Compact five-segment progress indicator. */
export function StepDots({ steps, label, className }: { steps: StepState; label: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)} role="img" aria-label={label}>
      {STEP_KEYS.map((k) => (
        <span key={k} className={cn("h-1 w-5 rounded-full transition-colors", steps[k] ? "bg-bronze-500" : "bg-mist")} />
      ))}
    </div>
  );
}

export function EventCard({ data, dict, locale }: { data: EventCardData; dict: Dictionary; locale: Locale }) {
  const d = dict.dashboard;
  const next = nextStep(data.steps);
  const nextLabel = next ? d.events.nextSteps[next === "event" ? "design" : next] : d.events.nextSteps.done;
  const href = next && next !== "event" ? stepHref(data.id, next) : stepHref(data.id, "overview");
  const counts = [
    { label: d.events.accepted, value: data.counts.accepted, tone: "bg-sage" },
    { label: d.events.declined, value: data.counts.declined, tone: "bg-rosewood" },
    { label: d.events.pending, value: data.counts.pending, tone: "bg-ochre" },
  ];

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-soft transition-all duration-500 ease-luxe hover:-translate-y-0.5 hover:shadow-lift",
        data.past && "opacity-85",
      )}
    >
      <div className="paper-grain relative flex h-64 items-center justify-center overflow-hidden border-b border-line bg-sand">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-mist/60 to-transparent" aria-hidden />
        <CardPreview
          {...data.preview}
          guest={null}
          qrPlaceholder={false}
          title={data.title}
          className="relative w-40 -rotate-2 rounded-[3px] shadow-lift ring-1 ring-ink/5 transition-transform duration-700 ease-luxe group-hover:rotate-0 group-hover:scale-[1.03]"
        />
        <div className="absolute start-4 top-4">
          {data.plan ? (
            <Badge tone="bronze">{dict.common.plans[data.plan as keyof typeof dict.common.plans]}</Badge>
          ) : (
            <Badge>{d.header.noPlan}</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow">{dict.common.eventTypes[data.type as keyof typeof dict.common.eventTypes]}</p>
        <h3 className="mt-2 font-display text-[26px] leading-tight text-ink">
          <Link href={stepHref(data.id, "overview")} className="after:absolute after:inset-0 focus-visible:outline-none">
            {data.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-ink-soft">{data.hostNames}</p>
        <div className="mt-4 space-y-1.5 text-[13px] text-ink-faint">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-3.5 shrink-0" />
            {data.dateLabel}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{data.venue}</span>
          </p>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink-soft">
              {data.counts.total ? plural(locale, d.events.guests, data.counts.total) : d.events.noGuests}
            </p>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {counts.map((c) => (
              <div key={c.label}>
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                  <span className={cn("size-1.5 shrink-0 rounded-full", c.tone)} />
                  <span className="truncate">{c.label}</span>
                </dt>
                <dd className="mt-1 font-display text-2xl leading-none text-ink lining-nums tabular-nums">{formatNumber(c.value, locale)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <StepDots steps={data.steps} label={fmt(d.steps.progress, { done: doneCount(data.steps) })} />
          <Link
            href={href}
            className="relative z-10 inline-flex items-center gap-1.5 text-[13px] font-medium text-bronze-700 transition hover:text-bronze-900"
          >
            {next ? fmt(d.events.continue, { step: nextLabel }) : nextLabel}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
