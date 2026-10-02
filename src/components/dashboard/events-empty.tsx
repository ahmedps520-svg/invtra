"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { buttonClasses } from "@/components/ui/button";
import { fmt } from "@/lib/i18n/config";
import { STEP_KEYS } from "./steps";

/** First-run welcome: what INVTRA does, in five steps, with a sample invitation. */
export function EventsEmptyState({ firstName }: { firstName: string }) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.events;
  const reduce = useReducedMotion();
  const ar = locale === "ar";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-line bg-paper shadow-soft">
      <div className="paper-grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative grid items-center gap-12 px-6 py-12 sm:px-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-16 lg:py-20">
        <div>
          <p className="eyebrow">{firstName ? fmt(dict.dashboard.events.greeting, { name: firstName }) : d.empty.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] text-ink sm:text-5xl lg:text-[3.6rem]">{d.empty.title}</h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">{d.empty.body}</p>

          <ol className="mt-9 space-y-3.5">
            {STEP_KEYS.map((k, i) => (
              <motion.li
                key={k}
                initial={reduce ? false : { opacity: 0, x: ar ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-bronze-200 bg-bronze-50 font-display text-[15px] text-bronze-700 lining-nums">
                  {i + 1}
                </span>
                <span className="text-[15px] text-ink">{d.empty.steps[k]}</span>
              </motion.li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/dashboard/events/new" className={buttonClasses("primary", "lg")}>
              {d.empty.cta}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
            <p className="text-[13px] text-ink-faint">{d.empty.note}</p>
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: ar ? 2.5 : -2.5 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[300px]"
        >
          <CardPreview
            themeKey={ar ? "arabic" : "minimal"}
            language={ar ? "AR" : "EN"}
            qrPlaceholder
            className="rounded-[4px] shadow-lift ring-1 ring-ink/5"
          />
        </motion.div>
      </div>
    </div>
  );
}
