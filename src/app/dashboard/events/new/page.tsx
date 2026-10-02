import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { EventForm } from "@/components/dashboard/event-form";
import { STEP_KEYS } from "@/components/dashboard/steps";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.newEvent };
}

export default async function NewEventPage() {
  await requireUser("/dashboard/events/new");
  const { dict } = await getI18n();
  const d = dict.dashboard;
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition hover:text-ink">
        <ArrowLeft className="size-3.5 rtl:rotate-180" />
        {d.header.back}
      </Link>
      <ol className="mb-10 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={d.steps.label}>
        {STEP_KEYS.map((k, i) => (
          <li key={k} className="flex items-center gap-3">
            {i > 0 ? <span className="h-px w-5 bg-line" aria-hidden /> : null}
            <span className={cn("flex items-center gap-2 text-[13px]", i === 0 ? "font-medium text-ink" : "text-ink-faint")} aria-current={i === 0 ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[12px]",
                  i === 0 ? "bg-ink text-ivory" : "border border-line-strong bg-paper",
                )}
              >
                {i + 1}
              </span>
              {d.steps[k]}
            </span>
          </li>
        ))}
      </ol>
      <EventForm mode="create" />
    </div>
  );
}
