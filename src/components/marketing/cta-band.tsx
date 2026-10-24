import Link from "next/link";
import { ArrowRight, CheckCheck, Eye, Smartphone } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import type { SendingMode } from "@/lib/marketing/links";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc } from "@/lib/marketing/samples";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

/** Closing call to action, with the free first step (a test send, or a preview) beside the button. */
export function CtaBand({
  dict,
  ctaHref,
  secondary = { href: "/pricing", label: dict.marketing.cta.secondary },
  mode,
  locale,
}: {
  dict: Dictionary;
  ctaHref: string;
  secondary?: { href: string; label: string };
  mode?: SendingMode;
  locale?: Locale;
}) {
  const t = dict.marketing.cta;
  const test = mode ? dict.marketing.home.cta.test[mode] : null;
  return (
    <section aria-labelledby="cta-title" className={cn(CONTAINER, "pb-20 sm:pb-28")}>
      <Reveal>
        <div className="relative overflow-clip rounded-[2rem] border border-hairline bg-cream-deep px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-0" />
          <svg
            aria-hidden="true"
            viewBox="0 0 400 300"
            preserveAspectRatio="xMidYMax meet"
            className="pointer-events-none absolute bottom-0 left-1/2 h-[92%] w-auto max-w-none -translate-x-1/2 text-gold/40"
            fill="none"
          >
            <path d="M40 300V180C40 91.6 111.6 20 200 20s160 71.6 160 160v120" stroke="currentColor" strokeWidth="0.8" />
            <path d="M64 300V184c0-75.1 60.9-136 136-136s136 60.9 136 136v116" stroke="currentColor" strokeWidth="0.5" />
          </svg>
          <div className={cn("relative grid grid-cols-[minmax(0,1fr)] items-center gap-10", test ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14" : "mx-auto max-w-2xl text-center")}>
            <div className={cn(test ? "text-center lg:text-start" : "")}>
              <LogoMark className={cn("h-12", test ? "mx-auto lg:mx-0" : "mx-auto")} title="" />
              <p className={cn(EYEBROW, "mt-7 text-gold-deep!")}>{t.eyebrow}</p>
              <h2 id="cta-title" className="mt-4 font-display text-[2.3rem] leading-[1.1] text-balance text-ink sm:text-[3.2rem]">
                {t.title}
              </h2>
              <p className={cn("mt-5 max-w-lg text-[17px] leading-relaxed text-ink-soft", test ? "mx-auto lg:mx-0" : "mx-auto")}>{t.body}</p>
              <div className={cn("mt-9 flex flex-col gap-3 sm:flex-row", test ? "justify-center lg:justify-start" : "justify-center")}>
                <Link href={ctaHref} className={buttonClasses("primary", "lg", "group")}>
                  {t.primary}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </Link>
                <Link href={secondary.href} className={buttonClasses("outline", "lg")}>
                  {secondary.label}
                </Link>
              </div>
            </div>

            {test && mode ? (
              <Link href={ctaHref} className="ivx-paper-light ivx-foil group mx-auto block w-full max-w-sm p-5 transition-[translate,box-shadow] duration-500 ease-luxe hover:-translate-y-1 hover:shadow-lift">
                <div className="relative flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-deep">
                    {mode === "cloud" ? <Smartphone className="size-5" strokeWidth={1.4} /> : <Eye className="size-5" strokeWidth={1.4} />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[1.5rem] leading-tight text-ink">{test.title}</p>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{test.body}</p>
                  </div>
                </div>
                <div aria-hidden="true" className="relative mt-5 flex items-center gap-3 rounded-2xl bg-[#efe9df] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                  <img src={sampleSrc("royal", locale === "ar" ? "ar" : "en")} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" loading="lazy" className="h-auto w-14 rounded-md shadow-soft" />
                  <div className="min-w-0 flex-1 rounded-xl rounded-ss-[4px] bg-white px-3 py-2 text-[12.5px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]">
                    <p className="truncate">{dict.marketing.demo.delivery}</p>
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#54656f]">
                      {dict.marketing.demo.time2}
                      <CheckCheck className="size-3 text-[#53bdeb]" strokeWidth={2.25} />
                    </p>
                  </div>
                </div>
                <p className="relative mt-4 flex items-center justify-between text-[12.5px] font-medium text-gold-deep">
                  {test.note}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </p>
              </Link>
            ) : null}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
