import { PenLine, QrCode, ScanLine, Send, Sparkles, SquareCheckBig } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

const ICONS = [PenLine, Send, SquareCheckBig, QrCode, ScanLine, Sparkles];

/** Create → Invite → Accept → Receive → Scan → Celebrate. */
export function Journey({ dict }: { dict: Dictionary }) {
  const t = dict.marketing.journey;
  return (
    <section aria-labelledby="journey-title" className="relative border-y border-line/80 bg-paper">
      <div className={cn(CONTAINER, "py-16 sm:py-20")}>
        <Reveal className="mb-12 flex items-center justify-center gap-4 sm:mb-14">
          <span className="hairline w-12 sm:w-24" aria-hidden="true" />
          <h2 id="journey-title" className={EYEBROW}>
            {t.title}
          </h2>
          <span className="hairline w-12 sm:w-24" aria-hidden="true" />
        </Reveal>
        <ol className="grid gap-0 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-10 lg:grid-cols-6 lg:gap-x-0">
          {t.steps.map((step, i) => {
            const Icon = ICONS[i];
            const last = i === t.steps.length - 1;
            return (
              <li key={step.title} className="relative">
                <Reveal
                  delay={i * 70}
                  className="flex gap-5 pb-9 sm:pb-0 lg:flex-col lg:items-center lg:gap-0 lg:px-3 lg:text-center"
                >
                  {/* connector: vertical on phones, horizontal on large screens */}
                  {!last ? (
                    <>
                      <span aria-hidden="true" className="absolute bottom-0 start-6 top-14 w-px bg-line-strong/70 sm:hidden" />
                      <span
                        aria-hidden="true"
                        className="absolute top-6 hidden h-px bg-[linear-gradient(90deg,var(--color-line-strong),var(--color-bronze-300))] lg:block lg:start-[calc(50%+2.25rem)] lg:end-[calc(-50%+2.25rem)] rtl:bg-[linear-gradient(270deg,var(--color-line-strong),var(--color-bronze-300))]"
                      />
                    </>
                  ) : null}
                  <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-ivory text-bronze-600 shadow-[inset_0_0_0_4px_var(--color-paper)]">
                    <Icon className="size-[19px]" strokeWidth={1.25} />
                  </span>
                  <div className="min-w-0 pt-1 lg:pt-5">
                    <p className="flex items-baseline gap-2 lg:justify-center">
                      <span className="text-[11px] font-medium tabular-nums text-bronze-500">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-[1.6rem] leading-none text-ink">{step.title}</span>
                    </p>
                    <p className="mt-2 max-w-[17rem] text-[14px] leading-relaxed text-ink-faint lg:mx-auto lg:max-w-[11rem] lg:text-[13px]">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
