"use client";

import { Users } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { ProgressBar } from "@/components/ui/card";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";

/** At the top of a co-host's guest list: whose list it is, who invited them, and room left. */
export function CoHostNote({ label, owner, count, limit }: { label: string; owner: string; count: number; limit: number | null }) {
  const { dict, locale } = useI18n();
  const t = dict.dashboard.cohosts;
  return (
    <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-bronze-200 bg-gradient-to-br from-bronze-50 via-paper to-paper px-5 py-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-bronze-200 bg-paper text-bronze-600" aria-hidden="true">
          <Users className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-xl text-ink">{fmt(t.yourListFor, { label })}</h3>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">{fmt(t.coHostIntro, { owner })}</p>
        </div>
      </div>
      {limit ? (
        <div className="w-full shrink-0 sm:w-48">
          <p className="text-[12.5px] text-ink-soft tabular-nums">
            {fmt(t.coHostLimit, { n: formatNumber(count, locale), limit: formatNumber(limit, locale) })}
          </p>
          <ProgressBar value={count} max={limit} className="mt-2" />
        </div>
      ) : null}
    </section>
  );
}
