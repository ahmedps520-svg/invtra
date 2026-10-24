import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { buttonClasses } from "@/components/ui/button";
import type { SendingMode } from "@/lib/marketing/links";
import { THEME_KEYS } from "@/lib/themes/types";
import { HeroStudio } from "./hero-studio";
import { QuizButton } from "./quiz-button";
import { CONTAINER } from "./styles";

/** Headline, the invitation arriving, and "Make it personal". */
export function Hero({
  dict,
  locale,
  ctaHref,
  mode,
  signedIn,
}: {
  dict: Dictionary;
  locale: Locale;
  ctaHref: string;
  mode: SendingMode;
  signedIn: boolean;
}) {
  const t = dict.marketing.hero;
  const h = dict.marketing.home;
  const designNames = Object.fromEntries(THEME_KEYS.map((k) => [k, dict.themes[k].name]));

  return (
    <section id="top" className="relative -mt-[68px] overflow-hidden pt-[68px] sm:-mt-[72px] sm:pt-[72px]">
      {/* Atmosphere: warm glow and paper grain */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 end-[-15%] size-[48rem] rounded-full bg-[radial-gradient(closest-side,var(--color-gold-soft),transparent)] opacity-70" />
        <div className="absolute -bottom-64 start-[-14%] size-[40rem] rounded-full bg-[radial-gradient(closest-side,var(--color-cream-deep),transparent)]" />
        <div className="paper-grain absolute inset-0 opacity-50" />
      </div>

      <div className={`${CONTAINER} relative pb-20 pt-8 sm:pt-12 lg:pb-28 lg:pt-14`}>
        <HeroStudio
          copy={{ ...h.studio, example: h.hero.example, stageLabel: h.hero.stageLabel }}
          designNames={designNames}
          locale={locale}
          mode={mode}
          signedIn={signedIn}
        >
          <p className="eyebrow flex items-center gap-3 text-gold-deep! max-sm:tracking-[0.2em] rtl:text-[13px]">
            <span className="hidden h-px w-8 bg-gold sm:block" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h1 className="mt-5 font-display font-normal text-ink motion-safe:animate-rise sm:mt-7">
            <span className="block text-[clamp(2.7rem,12vw,4.25rem)] leading-[1.02] sm:text-7xl lg:text-[4.4rem] xl:text-[5.2rem] rtl:leading-[1.25]">
              {t.titleLine1}
            </span>
            <span className="block text-[clamp(2.7rem,12vw,4.25rem)] leading-[1.1] text-gold-deep italic sm:text-7xl lg:text-[4.4rem] xl:text-[5.2rem] rtl:not-italic rtl:leading-[1.3]">
              {t.titleLine2}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-soft sm:mt-7 sm:text-xl sm:leading-relaxed">{t.subtitle}</p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
            <Link href={ctaHref} className={buttonClasses("primary", "lg", "group")}>
              {t.primary}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <QuizButton className={buttonClasses("outline", "lg", "group border-hairline bg-cream/60")}>
              <Sparkles className="size-4 text-gold-deep" strokeWidth={1.5} />
              {h.hero.quiz}
            </QuizButton>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5">
            {t.assurances.map((a) => (
              <li key={a} className="flex items-center gap-2 text-[13px] text-ink-faint">
                <Check className="size-3.5 text-gold-deep" strokeWidth={2} />
                {a}
              </li>
            ))}
          </ul>
        </HeroStudio>
      </div>
    </section>
  );
}
