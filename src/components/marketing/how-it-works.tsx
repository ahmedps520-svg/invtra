import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

/** Editorial five-step walkthrough (anchor: #how-it-works). */
export function HowItWorks({ dict, ctaHref }: { dict: Dictionary; ctaHref: string }) {
  const t = dict.marketing.how;
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20">
      <div className={cn(CONTAINER, "grid gap-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-10")}>
        <div className="lg:col-span-5">
          <Reveal className="lg:sticky lg:top-32">
            <p className={EYEBROW}>{t.eyebrow}</p>
            <h2 id="how-title" className="mt-4 font-display text-[2.5rem] leading-[1.08] text-balance text-ink sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-pretty text-ink-soft">{t.body}</p>
            <Link href={ctaHref} className={buttonClasses("outline", "md", "group mt-9")}>
              {t.cta}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </Reveal>
        </div>

        <ol className="lg:col-span-7 lg:col-start-6">
          {t.steps.map((step, i) => (
            <li key={step.title} className="border-t border-line first:border-t-0">
              <Reveal delay={i * 60} className="group grid grid-cols-[auto_1fr] gap-x-6 py-8 sm:gap-x-10 sm:py-10">
                <span className="w-14 font-display text-5xl leading-none font-light text-bronze-400 tabular-nums lining-nums transition-colors duration-500 group-hover:text-bronze-600 sm:w-20 sm:text-6xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pt-1">
                  <h3 className="font-display text-[1.75rem] leading-tight text-ink sm:text-3xl">{step.title}</h3>
                  <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
