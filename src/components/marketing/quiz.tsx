"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mail, RotateCcw, X } from "lucide-react";
import type { EventType, PlanTier } from "@prisma/client";

export type { QuizDesign };
import type { Dictionary } from "@/lib/i18n";
import { buttonClasses } from "@/components/ui/button";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleLang, sampleSrc } from "@/lib/marketing/samples";
import { DESIGN_STYLES } from "@/lib/marketing/design-styles";
import { matchDesigns, planFor, type QuizAnswers, type QuizDesign } from "@/lib/marketing/quiz";
import { startHref, type SendingMode } from "@/lib/marketing/links";
import { cn } from "@/lib/utils";
import { QUIZ_EVENT } from "./quiz-button";

type Lang = "AR" | "EN" | "BILINGUAL";
type Answers = Partial<QuizAnswers>;

/** "Find your invitation": four quick questions, then designs and the plan that fits. */
export function Quiz({
  designs,
  occasions,
  copy,
  planNames,
  mode,
  signedIn,
  contactHref,
}: {
  designs: QuizDesign[];
  occasions: { value: EventType; label: string }[];
  copy: Dictionary["marketing"]["home"]["quiz"];
  planNames: Record<PlanTier, string>;
  mode: SendingMode;
  signedIn: boolean;
  contactHref: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({});
  const total = 4;

  useEffect(() => {
    const open = () => {
      setStep(0);
      setA({});
      if (!dialog.current?.open) dialog.current?.showModal();
    };
    const onHash = () => window.location.hash === "#find" && open();
    window.addEventListener(QUIZ_EVENT, open);
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => {
      window.removeEventListener(QUIZ_EVENT, open);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const close = () => {
    dialog.current?.close();
    if (window.location.hash === "#find") history.replaceState(null, "", window.location.pathname + window.location.search);
  };
  const pick = (patch: Answers) => {
    setA((prev) => ({ ...prev, ...patch }));
    setStep((s) => s + 1);
  };

  const done = step >= total && a.occasion && a.guests && a.language && a.style;
  const results = done ? matchDesigns(designs, a as QuizAnswers) : [];
  const best = results[0];
  const plan = best && a.guests ? planFor(a.guests, best) : null;

  const option = (on: boolean) =>
    cn(
      "flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start text-[15px] transition-colors duration-300",
      on ? "border-gold bg-gold-soft/60 text-ink" : "border-hairline bg-[#fffcf6] text-ink hover:border-gold",
    );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="quiz-title"
      onClose={() => setStep(0)}
      onClick={(e) => e.target === dialog.current && close()}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-ink/45 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[1.75rem]"
    >
      <div className="flex h-full flex-col bg-cream sm:max-h-[90dvh] sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <h2 id="quiz-title" className="font-display text-[1.6rem] leading-tight text-ink">
              {copy.title}
            </h2>
            <p className="text-[12.5px] text-ink-faint" aria-live="polite">
              {done ? copy.result.eyebrow : copy.step.replace("{n}", String(step + 1)).replace("{total}", String(total))}
            </p>
          </div>
          <button type="button" onClick={close} aria-label={copy.close} className="flex size-11 items-center justify-center rounded-full text-ink transition hover:bg-cream-deep">
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="h-1 bg-hairline/60">
          <div className="h-full origin-left bg-gold transition-transform duration-500 ease-luxe rtl:origin-right" style={{ transform: `scaleX(${Math.min(step, total) / total})` }} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {!done ? (
            <fieldset key={step} className="ivx-pop">
              <legend className="font-display text-[1.9rem] leading-tight text-ink">
                {[copy.questions.occasion, copy.questions.guests, copy.questions.language, copy.questions.style][step]}
              </legend>
              <div className={cn("mt-5 grid gap-2.5", step === 0 ? "sm:grid-cols-2" : step === 3 ? "sm:grid-cols-2" : "")}>
                {step === 0
                  ? occasions.map((o) => (
                      <button key={o.value} type="button" aria-pressed={a.occasion === o.value} onClick={() => pick({ occasion: o.value })} className={option(a.occasion === o.value)}>
                        {o.label}
                        <ArrowRight className="size-4 text-gold rtl:rotate-180" />
                      </button>
                    ))
                  : step === 1
                    ? copy.guests.map((g) => (
                        <button key={g.value} type="button" aria-pressed={a.guests === g.value} onClick={() => pick({ guests: g.value })} className={option(a.guests === g.value)}>
                          {g.label}
                          <ArrowRight className="size-4 text-gold rtl:rotate-180" />
                        </button>
                      ))
                    : step === 2
                      ? (["AR", "EN", "BILINGUAL"] as Lang[]).map((l) => (
                          <button key={l} type="button" aria-pressed={a.language === l} onClick={() => pick({ language: l })} className={option(a.language === l)}>
                            {copy.languages[l]}
                            <ArrowRight className="size-4 text-gold rtl:rotate-180" />
                          </button>
                        ))
                      : DESIGN_STYLES.map((s) => (
                          <button key={s} type="button" aria-pressed={a.style === s} onClick={() => pick({ style: s })} className={option(a.style === s)}>
                            <span>
                              <span className="block">{copy.styles[s].label}</span>
                              <span className="block text-[13px] text-ink-faint">{copy.styles[s].body}</span>
                            </span>
                            <ArrowRight className="size-4 shrink-0 text-gold rtl:rotate-180" />
                          </button>
                        ))}
              </div>
              {step > 0 ? (
                <button type="button" onClick={() => setStep((s) => s - 1)} className="mt-6 inline-flex h-11 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
                  <ArrowLeft className="size-4 rtl:rotate-180" />
                  {copy.back}
                </button>
              ) : null}
            </fieldset>
          ) : (
            <div className="ivx-pop">
              <p className="font-display text-[1.9rem] leading-tight text-ink">{copy.result.title}</p>
              <ul className="mt-5 grid grid-cols-3 gap-3 sm:gap-5">
                {results.map((d) => (
                  <li key={d.key}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample in the chosen occasion's wording */}
                    <img
                      src={sampleSrc(d.key, sampleLang(a.language!), a.occasion)}
                      width={SAMPLE_WIDTH}
                      height={SAMPLE_HEIGHT}
                      alt={d.name}
                      className="block h-auto w-full rounded-[4px] bg-cream-deep shadow-soft ring-1 ring-black/5"
                    />
                    <p className="mt-2 font-display text-[1.15rem] leading-tight text-ink sm:text-[1.3rem]">{d.name}</p>
                    <Link href={startHref(signedIn, { theme: d.key, occasion: a.occasion })} className="mt-1 inline-flex min-h-9 items-center gap-1 text-[12.5px] font-medium text-gold-deep hover:underline">
                      {copy.result.start}
                      <ArrowRight className="size-3 rtl:rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>

              {plan ? (
                <div className="ivx-paper mt-7 p-5">
                  <p className="text-[12px] font-medium tracking-[0.14em] text-gold-deep uppercase rtl:text-[13px]">{copy.result.plan}</p>
                  <p className="mt-1 font-display text-[1.8rem] leading-none text-ink">{planNames[plan.tier]}</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{copy.result.reasons[plan.reason].replace("{design}", best.name)}</p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {best ? (
                  <Link href={startHref(signedIn, { theme: best.key, occasion: a.occasion })} className={buttonClasses("primary", "lg", "group")}>
                    {copy.result.start}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                ) : null}
                {plan?.tier === "CUSTOM" ? (
                  <a href={contactHref} className={buttonClasses("outline", "lg")}>
                    <Mail className="size-4" strokeWidth={1.5} />
                    {copy.result.contact}
                  </a>
                ) : best ? (
                  <Link href={startHref(signedIn, { theme: best.key, occasion: a.occasion })} className={buttonClasses("outline", "lg")}>
                    {copy.result.test[mode]}
                  </Link>
                ) : null}
              </div>
              <p className="mt-3 text-[12.5px] text-ink-faint">{copy.result.testNote[mode]}</p>
              <button type="button" onClick={() => {
                  setA({});
                  setStep(0);
                }} className="mt-5 inline-flex h-11 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
                <RotateCcw className="size-4" />
                {copy.restart}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
