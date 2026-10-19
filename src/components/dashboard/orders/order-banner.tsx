import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { OrderStage } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Top of an event's overview while its order is under way: the wizard's next step, or where the
 * submitted order stands (with a link to it).
 */
export function OrderBanner({
  dict,
  order,
  nextStep,
}: {
  dict: Dictionary;
  order: { id: string; stage: OrderStage } | null;
  nextStep: { href: string; label: string } | null;
}) {
  const d = dict.dashboard.orders;
  if (!order || order.stage === "DRAFT") {
    if (!nextStep) return null;
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-bronze-200 bg-bronze-50/60 px-6 py-5">
        <div>
          <p className="font-display text-xl text-ink">{d.stages.DRAFT}</p>
          <p className="mt-1 text-sm text-ink-soft">{d.stageHelp.DRAFT}</p>
        </div>
        <Link href={nextStep.href} className={buttonClasses("primary", "md")} data-testid="continue-order">
          {nextStep.label}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      </div>
    );
  }
  const attention = order.stage === "REJECTED" || order.stage === "INFO_REQUIRED";
  return (
    <div
      className={cn(
        "mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border px-6 py-5",
        attention ? "border-rosewood/30 bg-rosewood-soft" : "border-line bg-paper shadow-soft",
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Clock className={cn("mt-1 size-5 shrink-0", attention ? "text-rosewood" : "text-bronze-600")} />
        <div>
          <p className="font-display text-xl text-ink">{d.stages[order.stage]}</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{d.stageHelp[order.stage]}</p>
        </div>
      </div>
      <Link href={`/dashboard/orders/${order.id}`} className={buttonClasses(attention ? "primary" : "outline", "md")}>
        {d.done.view}
      </Link>
    </div>
  );
}
