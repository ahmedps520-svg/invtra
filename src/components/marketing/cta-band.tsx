import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

/** Closing call to action. */
export function CtaBand({
  dict,
  ctaHref,
  secondary = { href: "/pricing", label: dict.marketing.cta.secondary },
}: {
  dict: Dictionary;
  ctaHref: string;
  secondary?: { href: string; label: string };
}) {
  const t = dict.marketing.cta;
  return (
    <section aria-labelledby="cta-title" className={cn(CONTAINER, "pb-24 sm:pb-32")}>
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] border border-line bg-sand px-6 py-20 text-center sm:px-12 sm:py-24">
          <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0" />
          <svg
            aria-hidden="true"
            viewBox="0 0 400 300"
            preserveAspectRatio="xMidYMax meet"
            className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-[92%] w-auto text-bronze-300/60"
            fill="none"
          >
            <path d="M40 300V180C40 91.6 111.6 20 200 20s160 71.6 160 160v120" stroke="currentColor" strokeWidth="0.8" />
            <path d="M64 300V184c0-75.1 60.9-136 136-136s136 60.9 136 136v116" stroke="currentColor" strokeWidth="0.5" />
          </svg>
          <div className="relative mx-auto max-w-2xl">
            <LogoMark className="mx-auto h-12" title="" />
            <p className={cn(EYEBROW, "mt-8")}>{t.eyebrow}</p>
            <h2 id="cta-title" className="mt-4 font-display text-[2.4rem] leading-[1.1] text-balance text-ink sm:text-[3.4rem]">
              {t.title}
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-ink-soft">{t.body}</p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={ctaHref} className={buttonClasses("primary", "lg", "group")}>
                {t.primary}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
              <Link href={secondary.href} className={buttonClasses("outline", "lg")}>
                {secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
