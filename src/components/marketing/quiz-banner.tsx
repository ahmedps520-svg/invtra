import { Sparkles } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { buttonClasses } from "@/components/ui/button";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc } from "@/lib/marketing/samples";
import { QuizButton } from "./quiz-button";
import { Reveal } from "./reveal";
import { CONTAINER } from "./styles";

/** Mid-page invitation to the quiz (anchor: #find opens it). */
export function QuizBanner({ dict, locale }: { dict: Dictionary; locale: "en" | "ar" }) {
  const q = dict.marketing.home.quiz;
  const lang = locale === "ar" ? "ar" : "en";
  return (
    <section aria-labelledby="find-title" className={`${CONTAINER} py-6 sm:py-10`}>
      <Reveal>
        <div className="relative overflow-clip rounded-[1.75rem] bg-[#1c1815] px-6 py-10 text-ivory sm:px-10 sm:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(176_144_90/0.35),transparent)]" />
          <div className="relative grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="eyebrow text-[#e0c895]! rtl:text-[13px]">{q.banner.eyebrow}</p>
              <h2 id="find-title" className="mt-3 font-display text-[2.1rem] leading-[1.1] text-ivory sm:text-[2.6rem]">
                {q.banner.title}
              </h2>
              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[#cfc6ba]">{q.banner.body}</p>
              <QuizButton className={buttonClasses("accent", "lg", "mt-7 bg-gold text-[#1c1815] hover:bg-[#c5a66c]")}>
                <Sparkles className="size-4" strokeWidth={1.6} />
                {q.title}
              </QuizButton>
            </div>
            <div aria-hidden="true" className="relative hidden h-44 w-64 md:block">
              {(["teddy", "royal", "lantern"] as const).map((k, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample
                <img
                  key={k}
                  src={sampleSrc(k, lang)}
                  width={SAMPLE_WIDTH}
                  height={SAMPLE_HEIGHT}
                  alt=""
                  loading="lazy"
                  className="absolute top-0 h-auto w-28 rounded-[4px] shadow-[0_20px_40px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10"
                  style={{ insetInlineStart: `${i * 4.6}rem`, rotate: `${(i - 1) * 7}deg`, zIndex: i === 1 ? 2 : 1, top: i === 1 ? 0 : "1rem" }}
                />
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
