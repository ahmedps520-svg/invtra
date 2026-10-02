import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { buttonClasses } from "@/components/ui/button";
import { CardPreview } from "@/components/invitation/card-preview";
import { PhoneDemo } from "./phone-demo";

export function Hero({ dict, locale, ctaHref }: { dict: Dictionary; locale: "en" | "ar"; ctaHref: string }) {
  const t = dict.marketing.hero;
  const ar = locale === "ar";

  return (
    <section className="relative overflow-hidden">
      {/* Atmosphere: warm glow + paper grain */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 end-[-10%] size-[46rem] rounded-full bg-[radial-gradient(closest-side,var(--color-bronze-100),transparent)] opacity-80" />
        <div className="absolute -bottom-56 start-[-12%] size-[36rem] rounded-full bg-[radial-gradient(closest-side,var(--color-sand),transparent)]" />
        <div className="paper-grain absolute inset-0 opacity-60" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-28 lg:pt-20">
        <div className="lg:col-span-6 xl:col-span-6">
          <p className="eyebrow flex animate-fade-up items-center gap-3 max-sm:tracking-[0.2em] rtl:text-[13px]">
            <span className="hidden h-px w-8 bg-bronze-400 sm:block" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h1 style={{ animationDelay: "80ms" }} className="mt-7 font-display font-normal text-ink animate-fade-up">
            <span className="block text-[clamp(2.9rem,13.5vw,4.5rem)] leading-[1.02] sm:text-7xl lg:text-[4.5rem] xl:text-[5.5rem]">
              {t.titleLine1}
            </span>
            <span className="block text-[clamp(2.9rem,13.5vw,4.5rem)] leading-[1.1] text-bronze-700 italic sm:text-7xl lg:text-[4.5rem] xl:text-[5.5rem] rtl:not-italic">
              {t.titleLine2}
            </span>
          </h1>
          <p
            style={{ animationDelay: "160ms" }}
            className="mt-8 max-w-xl text-lg leading-relaxed text-pretty text-ink-soft animate-fade-up sm:text-xl sm:leading-relaxed"
          >
            {t.subtitle}
          </p>
          <div
            style={{ animationDelay: "240ms" }}
            className="mt-10 flex flex-col gap-3 animate-fade-up sm:flex-row sm:items-center"
          >
            <Link href={ctaHref} className={buttonClasses("primary", "lg", "group")}>
              {t.primary}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <Link href="/designs" className={buttonClasses("outline", "lg")}>
              {t.secondary}
            </Link>
          </div>
          <ul style={{ animationDelay: "320ms" }} className="mt-10 flex flex-wrap gap-x-6 gap-y-2.5 animate-fade-up">
            {t.assurances.map((a) => (
              <li key={a} className="flex items-center gap-2 text-[13px] text-ink-faint">
                <Check className="size-3.5 text-bronze-500" strokeWidth={2} />
                {a}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[34rem] lg:col-span-6 lg:max-w-none">
          {/* A thin arch echoes the invitation designs behind the phone */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 560"
            className="pointer-events-none absolute start-1/2 top-1/2 h-[112%] w-auto -translate-x-1/2 -translate-y-1/2 text-bronze-300/70 [mask-image:linear-gradient(to_bottom,black_55%,transparent_92%)] rtl:translate-x-1/2"
            fill="none"
          >
            <path d="M20 560V200C20 100.6 100.6 20 200 20s180 80.6 180 180v360" stroke="currentColor" strokeWidth="1" />
            <path
              d="M44 560V204c0-86.2 69.8-156 156-156s156 69.8 156 156v356"
              stroke="currentColor"
              strokeWidth="0.6"
              opacity="0.6"
            />
          </svg>

          {/* Floating printed invitation, tucked behind the phone */}
          <div
            aria-hidden="true"
            style={{ animationDelay: "400ms" }}
            className="absolute start-[2%] top-[12%] hidden w-[230px] -rotate-[7deg] animate-fade-up sm:block xl:start-[4%] xl:w-[250px] rtl:rotate-[7deg]"
          >
            <div className="overflow-hidden rounded-[6px] shadow-lift ring-1 ring-black/5">
              <CardPreview themeKey={ar ? "bilingual" : "minimal"} language={ar ? "BILINGUAL" : "EN"} qrPlaceholder title="" />
            </div>
          </div>

          <div style={{ animationDelay: "200ms" }} className="relative animate-fade-up sm:ms-[22%] xl:ms-[26%]">
            <PhoneDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
