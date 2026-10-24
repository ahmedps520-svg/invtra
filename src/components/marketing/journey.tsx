import { PenLine, QrCode, ScanLine, Send, Sparkles, SquareCheckBig } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GoldThread } from "./gold-thread";
import { SectionHeading } from "./section-heading";
import { CONTAINER } from "./styles";

const ICONS = [PenLine, Send, SquareCheckBig, QrCode, ScanLine, Sparkles];

/** Create → Invite → Accept → Receive → Scan → Celebrate, tied together by the gold thread (#how-it-works). */
export function Journey({ dict }: { dict: Dictionary }) {
  const t = dict.marketing.journey;
  const how = dict.marketing.how;
  return (
    <section id="how-it-works" aria-labelledby="journey-title" className="relative scroll-mt-20 border-y border-hairline/70 bg-[#fffcf6] py-16 sm:py-28">
      <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className={cn(CONTAINER, "relative")}>
        <SectionHeading eyebrow={t.eyebrow} title={<span id="journey-title">{t.title}</span>} body={how.body} />

        <GoldThread className="relative mx-auto mt-14 max-w-4xl sm:mt-16">
          {/* the thread: a hairline track and the gold that draws down it */}
          <span aria-hidden="true" className="absolute bottom-6 top-6 start-[1.4rem] w-px bg-hairline md:start-1/2 md:-translate-x-1/2 rtl:md:translate-x-1/2" />
          <span
            aria-hidden="true"
            className="absolute bottom-6 top-6 start-[1.4rem] w-[1.5px] origin-top bg-[linear-gradient(180deg,var(--color-gold),var(--color-gold-deep))] [transform:scaleY(var(--ivx-thread))] md:start-1/2 md:-translate-x-1/2 rtl:md:translate-x-1/2"
          />
          <ol className="relative space-y-10 md:space-y-4">
            {t.steps.map((step, i) => {
              const Icon = ICONS[i];
              const end = i % 2 === 1;
              return (
                <li
                  key={step.title}
                  data-thread-step=""
                  className="group/step relative grid grid-cols-[2.8rem_minmax(0,1fr)] gap-x-5 md:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] md:gap-x-8"
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-11 items-center justify-center rounded-full border border-hairline bg-cream text-ink-faint shadow-[inset_0_0_0_4px_#fffcf6] transition-[color,border-color,background-color] duration-700 ease-luxe",
                      "group-data-[lit=true]/step:border-gold group-data-[lit=true]/step:bg-gold-soft group-data-[lit=true]/step:text-gold-deep",
                      "md:col-start-2 md:row-start-1 md:mx-auto md:size-14",
                    )}
                  >
                    <Icon className="size-[18px] md:size-5" strokeWidth={1.35} />
                  </span>
                  <div
                    className={cn(
                      "pt-1 transition-[opacity,translate] duration-700 ease-luxe md:row-start-1 md:pt-2.5",
                      "opacity-100 group-data-[lit=false]/step:translate-y-2 group-data-[lit=false]/step:opacity-55",
                      end ? "md:col-start-3" : "md:col-start-1 md:text-end",
                    )}
                  >
                    <p className={cn("flex items-baseline gap-2.5", !end && "md:justify-end")}>
                      <span className="font-display text-sm tabular-nums text-gold-deep" dir="ltr">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-[1.75rem] leading-none text-ink">{step.title}</span>
                    </p>
                    <p className={cn("mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft", !end && "md:ms-auto")}>{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </GoldThread>
      </div>
    </section>
  );
}
