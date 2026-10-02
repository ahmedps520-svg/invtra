import { ArrowLeftRight, CalendarDays, Languages, Type } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { CardPreview } from "@/components/invitation/card-preview";
import { Reveal } from "./reveal";
import { CONTAINER } from "./styles";
import { cn } from "@/lib/utils";

const POINT_ICONS = [ArrowLeftRight, Languages, CalendarDays, Type];

/** Arabic + English, with real right-to-left composition. */
export function BilingualSection({ dict, locale }: { dict: Dictionary; locale: "en" | "ar" }) {
  const t = dict.marketing.bilingual;
  const ar = locale === "ar";
  const cards = [
    { theme: "minimal", language: "EN" as const, label: t.englishCard },
    { theme: "bilingual", language: "BILINGUAL" as const, label: t.bilingualCard },
    { theme: "arabic", language: "AR" as const, label: t.arabicCard },
  ];
  // Reading order: the guest's own language sits closest to the text.
  const ordered = ar ? [...cards].reverse() : cards;

  return (
    <section aria-labelledby="bilingual-title" className="relative overflow-hidden bg-[#1c1815] text-ivory">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/3 end-[-10%] size-[52rem] rounded-full bg-[radial-gradient(closest-side,rgb(169_132_78/0.22),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.035)_1px,transparent_1px)] [background-size:4px_4px]" />
      </div>

      <div className={cn(CONTAINER, "relative grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-12 lg:gap-12")}>
        <div className="lg:col-span-5">
          <Reveal>
            <p className="eyebrow text-bronze-300! rtl:text-[13px]">{t.eyebrow}</p>
            <h2
              id="bilingual-title"
              className="mt-4 font-display text-[2.5rem] leading-[1.08] text-balance text-ivory sm:text-5xl"
            >
              {t.title}
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-pretty text-[#cfc6ba]">{t.body}</p>
          </Reveal>
          <ul className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {t.points.map((p, i) => {
              const Icon = POINT_ICONS[i];
              return (
                <li key={p.title}>
                  <Reveal delay={i * 60}>
                    <Icon className="size-5 text-bronze-300" strokeWidth={1.25} />
                    <h3 className="mt-4 text-[15px] font-medium text-ivory">{p.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-[#a99f93]">{p.body}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>

        <Reveal className="lg:col-span-7 lg:col-start-6">
          <div className="relative mx-auto flex max-w-[36rem] items-end justify-center pb-4">
            {ordered.map((c, i) => {
              const center = i === 1;
              return (
                <figure
                  key={c.theme}
                  className={cn(
                    "relative shrink-0 transition-transform duration-700 ease-luxe",
                    center ? "z-10 w-[44%] hover:-translate-y-2" : "w-[36%] opacity-95 hover:-translate-y-1.5",
                    i === 0 && "-me-[8%] mb-6 -rotate-[6deg] rtl:rotate-[6deg]",
                    i === 2 && "-ms-[8%] mb-6 rotate-[6deg] rtl:-rotate-[6deg]",
                  )}
                >
                  <div className="overflow-hidden rounded-[6px] shadow-[0_30px_60px_-25px_rgb(0_0_0/0.7)] ring-1 ring-white/10">
                    <CardPreview themeKey={c.theme} language={c.language} qrPlaceholder title={c.label} />
                  </div>
                  <figcaption className="mt-4 text-center text-[12px] tracking-wide text-[#a99f93]">{c.label}</figcaption>
                </figure>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
