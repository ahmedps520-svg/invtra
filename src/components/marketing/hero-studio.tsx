"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, BatteryFull, Camera, ChevronLeft, CornerUpLeft, Mic, Minus, Plus, SignalHigh, Wifi } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/config";
import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleLang, sampleSrc } from "@/lib/marketing/samples";
import { DEMO_CHAT, DEMO_GUEST, DEMO_UI, STUDIO_DESIGN, STUDIO_OCCASIONS, withDigits, type DemoLang, type StudioOccasion } from "@/lib/marketing/demo-copy";
import { startHref, type SendingMode } from "@/lib/marketing/links";
import { Choices } from "./choices";

const LiveCard = dynamic(() => import("./live-card").then((m) => m.LiveCard), { ssr: false });

type Language = "EN" | "AR" | "BILINGUAL";
type Digits = "arab" | "latn";

/** Where the names sit on the opening design, so the "writing" lands on them (measured on the card). */
const OPENING = { theme: "royal", background: "#0F2E26", namesTop: "18.5%", namesHeight: "15%" } as const;

/**
 * The homepage hero: the invitation arriving (envelope → card → WhatsApp) and the "Make it
 * personal" controls that rewrite it live. The arrival is pure CSS (marketing.css, .ivx-stage),
 * so it plays from the first paint; the controls hydrate afterwards.
 */
export function HeroStudio({
  copy,
  designNames,
  locale,
  mode,
  signedIn,
  children,
}: {
  copy: Dictionary["marketing"]["home"]["studio"] & { example: string; stageLabel: string };
  designNames: Record<string, string>;
  locale: Locale;
  mode: SendingMode;
  signedIn: boolean;
  /** The headline column (server-rendered). */
  children: ReactNode;
}) {
  const id = useId();
  const [name, setName] = useState(DEMO_GUEST[locale]);
  const [seats, setSeats] = useState(2);
  const [occasion, setOccasion] = useState<StudioOccasion>("WEDDING");
  const [language, setLanguage] = useState<Language>(locale === "ar" ? "AR" : "EN");
  const [digits, setDigits] = useState<Digits>("arab");
  const [live, setLive] = useState(false);

  const theme = STUDIO_DESIGN[occasion];
  const chatLang: DemoLang = language === "EN" ? "en" : language === "AR" ? "ar" : locale;
  const guestName = name.trim().slice(0, 28) || DEMO_GUEST[chatLang];
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setLive(true);
    set(v);
  };

  const qrText = useMemo(() => {
    const origin = typeof window === "undefined" ? "https://invtra.store" : window.location.origin;
    const q = new URLSearchParams({ guest: guestName, seats: String(seats), lang: language });
    return `${origin}/designs/${theme}/demo?${q.toString()}`;
  }, [guestName, seats, language, theme]);

  const ui = DEMO_UI[chatLang];
  const chat = DEMO_CHAT[occasion][chatLang];
  const arabicText = (s: string) => (chatLang === "ar" ? withDigits(s, digits) : s);
  const message = arabicText(`${fmt(ui.dear, { name: guestName })} ${fmt(ui.invited, { invite: chat.invite })}`);
  const img = sampleSrc(theme, sampleLang(language));

  const card = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample, sized and cached */}
      <img src={img} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" fetchPriority="high" decoding="async" />
      {live ? (
        <div className="absolute inset-0">
          <LiveCard
            theme={theme}
            language={language}
            digits={digits}
            guest={{ name: guestName, allowedCount: seats }}
            qrText={qrText}
            title={`${copy.design}: ${designNames[theme]}`}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-y-12 [grid-template-areas:'text''stage''controls'] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-14 lg:gap-y-10 lg:[grid-template-areas:'text_stage''controls_stage']">
      <div className="[grid-area:text] lg:self-end">{children}</div>

      {/* The stage */}
      <div className="relative mx-auto w-full max-w-[25rem] [grid-area:stage] lg:max-w-[28rem]">
        <p className="sr-only">{copy.stageLabel}</p>
        <span className="absolute -top-3 start-[8%] z-10 rounded-full border border-hairline bg-cream px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-gold-deep uppercase rtl:text-[12px]">
          {copy.example}
        </span>
        <div aria-hidden="true" className="ivx-stage">
          {/* Phone, at rest showing the message */}
          <div className="ivx-phone ivx-anim">
            <div className="ivx-screen" dir={chatLang === "ar" ? "rtl" : "ltr"} lang={chatLang}>
              <div className="ivx-statusbar" dir="ltr">
                <span>9:41</span>
                <span className="ivx-island" />
                <span className="flex items-center gap-[0.8cqw]">
                  <SignalHigh className="size-[2.8cqw]" strokeWidth={2.5} />
                  <Wifi className="size-[2.8cqw]" strokeWidth={2.5} />
                  <BatteryFull className="size-[3.2cqw]" strokeWidth={2} />
                </span>
              </div>
              <div className="ivx-chathead">
                <ChevronLeft className="size-[4.4cqw] shrink-0 text-[#00866e] rtl:rotate-180" strokeWidth={2} />
                <span className="ivx-avatar">{mode === "cloud" ? <LogoMark className="h-[4cqw]" title="" /> : chat.host.slice(0, 1)}</span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[3cqw] font-semibold">{mode === "cloud" ? ui.business : chat.host}</span>
                  <span className="block truncate text-[2.3cqw] text-[#54656f]">{mode === "cloud" ? ui.businessStatus : ui.online}</span>
                </span>
              </div>
              <div className="ivx-chat">
                <span className="ivx-pill ivx-anim ivx-bubble-rest">{ui.today}</span>
                <div className="ivx-bubble ivx-anim">
                  <div className="ivx-bubble-card">{card}</div>
                  <div>
                    {mode === "own" ? (
                      <div className="ivx-linkpreview">
                        <p className="font-semibold">{ui.linkTitle}</p>
                        <p className="text-[#54656f]">{ui.openPage}</p>
                      </div>
                    ) : null}
                    <p className="ivx-msg">
                      {message}
                      {"\n"}
                      {mode === "cloud" ? (
                        ui.question
                      ) : (
                        <>
                          {ui.linkLead} <span className="text-[#027eb5]">invtra.store/i/8F3K92QX</span>
                        </>
                      )}
                    </p>
                    <p className="ivx-meta">
                      <span>{mode === "cloud" ? ui.sentWith : ""}</span>
                      <span className="tabular-nums">{arabicText(ui.time1)}</span>
                    </p>
                  </div>
                </div>
                {mode === "cloud" ? (
                  <div className="ivx-replies ivx-anim ivx-bubble-rest">
                    {[ui.accept, ui.decline].map((label) => (
                      <span key={label} className="ivx-reply">
                        <CornerUpLeft className="size-[2.6cqw] rtl:-scale-x-100" strokeWidth={2} />
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="ivx-composer">
                <Plus className="size-[3.6cqw] shrink-0" strokeWidth={1.75} />
                <span className="ivx-composer-field">{ui.typeMessage}</span>
                <Camera className="size-[3.6cqw] shrink-0" strokeWidth={1.75} />
                <Mic className="size-[3.6cqw] shrink-0" strokeWidth={1.75} />
              </div>
            </div>
          </div>

          {/* The envelope, and the card that rises out of it and flies into the chat */}
          <span className="ivx-env ivx-env-back ivx-anim" />
          <div
            className="ivx-fly ivx-anim"
            style={
              {
                "--ivx-card-bg": OPENING.background,
                "--ivx-names-top": OPENING.namesTop,
                "--ivx-names-h": OPENING.namesHeight,
              } as CSSProperties
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- same file as the bubble image */}
            <img src={sampleSrc(OPENING.theme, locale === "ar" ? "ar" : "en")} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" />
            <span className="ivx-ink ivx-anim" />
            <span className="ivx-sheen ivx-anim" />
          </div>
          <span className="ivx-env ivx-env-front ivx-anim" />
          <span className="ivx-flap ivx-flap-open ivx-anim" />
          <span className="ivx-flap ivx-flap-closed ivx-anim" />
          <span className="ivx-seal ivx-anim">
            <LogoMark className="h-[6.5cqw]" title="" />
          </span>
        </div>
      </div>

      {/* Make it personal */}
      <div className="w-full [grid-area:controls] lg:self-start">
        <div className="ivx-paper ivx-grain mx-auto max-w-[34rem] p-5 sm:p-6 lg:mx-0">
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[1.65rem] leading-tight text-ink">{copy.title}</h2>
              <span className="text-[12px] text-ink-faint">
                {copy.design}: <span className="text-gold-deep">{designNames[theme]}</span>
              </span>
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{copy.body}</p>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div>
                <label htmlFor={`${id}-name`} className="text-[13px] font-medium text-ink">
                  {copy.name}
                </label>
                <input
                  id={`${id}-name`}
                  value={name}
                  maxLength={28}
                  autoComplete="off"
                  placeholder={copy.namePlaceholder}
                  onChange={(e) => touch(setName)(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-xl border border-hairline bg-[#fffcf6] px-4 text-[16px] text-ink shadow-[inset_0_1px_2px_rgb(30_26_22/0.06)] outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
                />
              </div>
              <div>
                <span className="text-[13px] font-medium text-ink" id={`${id}-seats`}>
                  {copy.seats}
                </span>
                <div role="group" aria-labelledby={`${id}-seats`} className="mt-1.5 flex h-12 items-center rounded-xl border border-hairline bg-[#fffcf6]">
                  <button
                    type="button"
                    aria-label={copy.fewer}
                    disabled={seats <= 1}
                    onClick={() => touch(setSeats)(seats - 1)}
                    className="flex size-11 items-center justify-center text-ink-soft transition hover:text-ink disabled:opacity-35"
                  >
                    <Minus className="size-4" />
                  </button>
                  <output aria-live="polite" className="w-5 text-center text-[16px] tabular-nums text-ink">
                    {locale === "ar" ? withDigits(String(seats), "arab") : seats}
                  </output>
                  <button
                    type="button"
                    aria-label={copy.more}
                    disabled={seats >= 9}
                    onClick={() => touch(setSeats)(seats + 1)}
                    className="flex size-11 items-center justify-center text-ink-soft transition hover:text-ink disabled:opacity-35"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <Choices
              label={copy.occasion}
              value={occasion}
              onChange={touch(setOccasion)}
              options={STUDIO_OCCASIONS.map((o) => ({ value: o, label: copy.occasions[o] }))}
              className="mt-5"
              scroll
            />
            <div className="mt-4 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
              <Choices
                label={copy.language}
                value={language}
                onChange={touch(setLanguage)}
                options={(["AR", "EN", "BILINGUAL"] as Language[]).map((l) => ({ value: l, label: copy.languages[l], lang: l === "AR" ? "ar" : undefined }))}
                segmented
              />
              <Choices
                label={copy.numerals}
                value={digits}
                onChange={touch(setDigits)}
                disabled={language === "EN"}
                hint={copy.numeralsNote}
                options={[
                  { value: "arab", label: "١٢", lang: "ar" },
                  { value: "latn", label: "12" },
                ]}
                segmented
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
              <p className="text-[12px] text-ink-faint">{copy.qrNote}</p>
              <Link href={startHref(signedIn, { theme, occasion })} className={buttonClasses("outline", "sm", "group h-11")}>
                {copy.start}
                <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
