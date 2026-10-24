"use client";

import { useState, type ReactNode } from "react";
import { CheckCheck, ChevronLeft, CornerUpLeft, Link2, RotateCcw, SquareArrowOutUpRight } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/config";
import { LogoMark } from "@/components/brand/logo";
import { DEMO_CHAT, DEMO_UI } from "@/lib/marketing/demo-copy";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleQrSrc, sampleSrc } from "@/lib/marketing/samples";
import type { SendingMode } from "@/lib/marketing/links";
import { cn } from "@/lib/utils";
import { usePlayOnScreen, useStoryline } from "./use-play";

type Path = "accept" | "decline";

/** The guest in the demo is the guest printed on the sample cards. */
const GUEST = { en: "Khalid", ar: "خالد" };

/**
 * The guest's side of an invitation, played as a WhatsApp conversation while on screen:
 * the invitation arrives, they answer, and an acceptance brings their personal invitation and QR
 * code (a decline brings a polite thank-you and no code). With INVTRA's WhatsApp number the guest
 * answers in the chat; when hosts send from their own WhatsApp they answer on their invitation page.
 */
export function WhatsAppStory({
  locale,
  mode,
  labels,
}: {
  locale: Locale;
  mode: SendingMode;
  labels: { paths: string; accept: string; decline: string; replay: string; figure: string };
}) {
  const [path, setPath] = useState<Path>("accept");
  const [round, setRound] = useState(0);
  const { ref, playing } = usePlayOnScreen<HTMLDivElement>(0.4);
  const durations = mode === "cloud" ? [1600, 750, 900, 1300, 1000] : [1600, 700, 1300, 800, 1000];
  const step = useStoryline(playing, durations, `${path}:${round}`);
  const pop = playing ? "ivx-pop" : "";

  const ui = DEMO_UI[locale];
  const chat = DEMO_CHAT.WEDDING[locale];
  const name = GUEST[locale];
  const invite = `${fmt(ui.dear, { name })} ${fmt(ui.invited, { invite: chat.invite })}`;
  const thumb = sampleSrc(locale === "ar" ? "arabic" : "romantic", locale);
  const accepted = path === "accept";

  return (
    <div ref={ref} className="mx-auto w-full max-w-[24rem]">
      <figure aria-label={labels.figure} className="relative">
        <div className="relative h-[36rem] overflow-hidden rounded-[2.4rem] border-[7px] border-[#1b1714] bg-[#efe9df] shadow-[0_30px_70px_-35px_rgb(30_26_22/0.55)]">
          {/* header */}
          <div className="flex h-14 items-center gap-2.5 border-b border-black/5 bg-[#f7f5f2] px-3">
            <ChevronLeft className="size-5 shrink-0 text-[#00866e] rtl:rotate-180" strokeWidth={2} />
            <span className="flex size-9 items-center justify-center rounded-full border border-hairline bg-cream text-[14px] text-gold-deep">
              {mode === "cloud" ? <LogoMark className="h-5" title="" /> : chat.host.slice(0, 1)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] font-semibold text-[#111b21]">{mode === "cloud" ? ui.business : chat.host}</span>
              <span className="block truncate text-[11.5px] text-[#54656f]">{mode === "cloud" ? ui.businessStatus : ui.online}</span>
            </span>
          </div>

          {/* conversation, newest at the bottom */}
          <div
            className="absolute inset-x-0 bottom-0 top-14 flex flex-col justify-end gap-1.5 overflow-hidden px-3 pb-3 text-[13px] leading-snug text-[#111b21]"
            style={{ backgroundImage: "radial-gradient(rgb(132 102 74 / 0.07) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
          >
            {mode === "cloud" ? (
              <>
                <div className={cn("max-w-[86%] self-start", pop)}>
                  <Bubble>
                    <div className="flex gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                      <img src={thumb} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" loading="lazy" className="h-auto w-16 shrink-0 rounded-md" />
                      <p className="self-center">{invite}</p>
                    </div>
                    <p className="mt-1.5">{ui.question}</p>
                    <Meta>{ui.time1}</Meta>
                  </Bubble>
                  <div className="mt-1 grid gap-1">
                    {(["accept", "decline"] as Path[]).map((p) => (
                      <span
                        key={p}
                        className={cn(
                          "relative flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-white text-[13px] font-medium text-[#00866e] shadow-[0_1px_0.5px_rgb(0_0_0/0.1)] transition-colors duration-300",
                          step === 1 && p === path && "bg-[#e9edef]",
                        )}
                      >
                        <CornerUpLeft className="size-3.5 rtl:-scale-x-100" strokeWidth={2} />
                        {p === "accept" ? ui.accept : ui.decline}
                        {step === 1 && p === path ? <span className="ivx-ripple" /> : null}
                      </span>
                    ))}
                  </div>
                </div>
                {step >= 2 ? (
                  <div className={cn("max-w-[78%] self-end", pop)}>
                    <div className="flex items-end gap-2 rounded-xl rounded-se-[4px] bg-[#dcf5d3] px-2.5 py-1.5 shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]">
                      <span>{accepted ? ui.accept : ui.decline}</span>
                      <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-[#54656f]">
                        {ui.time2}
                        <CheckCheck className="size-3 text-[#53bdeb]" strokeWidth={2.25} />
                      </span>
                    </div>
                  </div>
                ) : null}
                {step === 3 ? <Typing className={pop} /> : null}
                {step >= 4 ? (
                  <div className={cn("max-w-[86%] self-start", pop)}>
                    <Bubble>
                      <p>{fmt(accepted ? ui.thanksAccept : ui.thanksDecline, { name })}</p>
                      <Meta>{ui.time2}</Meta>
                    </Bubble>
                  </div>
                ) : null}
                {step >= 5 && accepted ? (
                  <div className={cn("w-[62%] self-start", pop)}>
                    <Bubble>
                      {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                      <img src={sampleSrc("royal", locale)} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" loading="lazy" className="block h-auto w-full rounded-md" />
                      <p className="flex items-center justify-center gap-1.5 border-t border-black/[0.06] pt-1.5 text-[12.5px] font-medium text-[#00866e]">
                        <SquareArrowOutUpRight className="size-3 rtl:-scale-x-100" strokeWidth={2} />
                        {ui.view}
                      </p>
                    </Bubble>
                  </div>
                ) : null}
                {step >= 5 && !accepted ? <NoQr className={pop}>{ui.noQr}</NoQr> : null}
              </>
            ) : (
              <div className={cn("max-w-[86%] self-start", pop)}>
                <Bubble>
                  <div className="relative overflow-hidden rounded-lg bg-[#f0f2f2]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                    <img src={thumb} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" loading="lazy" className="block aspect-[1.6] h-auto w-full object-cover object-top" />
                    <div className="px-2.5 py-1.5">
                      <p className="text-[12.5px] font-semibold">{ui.linkTitle}</p>
                      <p className="text-[11.5px] text-[#54656f]">{ui.openPage}</p>
                    </div>
                    {step === 1 ? <span className="ivx-ripple" /> : null}
                  </div>
                  <p className="mt-1.5">
                    {invite} {ui.linkLead}{" "}
                    <span className="inline-flex items-center gap-0.5 text-[#027eb5]">
                      <Link2 className="size-3" />
                      invtra.store/i/8F3K92QX
                    </span>
                  </p>
                  <Meta>{ui.time1}</Meta>
                </Bubble>
              </div>
            )}
          </div>

          {/* own WhatsApp: the guest answers on their personal invitation page */}
          {mode === "own" ? (
            <div data-open={step >= 2} className="ivx-sheet absolute inset-x-0 bottom-0 top-10 flex flex-col overflow-hidden rounded-t-[1.6rem] bg-cream shadow-[0_-20px_40px_-20px_rgb(0_0_0/0.35)]">
              <div className="flex items-center justify-center gap-1.5 border-b border-hairline py-2 text-[11px] text-ink-faint" dir="ltr">
                <span className="size-1.5 rounded-full bg-sage" />
                invtra.store
              </div>
              <div className="flex flex-1 flex-col items-center px-5 pt-4 text-center">
                {step >= 4 && accepted ? (
                  <div className={cn("flex w-full flex-col items-center", pop)}>
                    <p className="text-[13.5px] text-ink">{ui.pageAccepted}</p>
                    <div className="mt-4 w-[76%] rounded-2xl border border-hairline bg-[#fffcf6] p-4 shadow-soft">
                      <p className="text-[10px] font-medium tracking-[0.2em] text-gold-deep uppercase rtl:text-[11px]">{ui.pass}</p>
                      <p className="mt-1 font-display text-xl text-ink">{name}</p>
                      <p className="text-[11.5px] text-ink-faint">{fmt(ui.admits, { n: locale === "ar" ? "٢" : "2" })}</p>
                      {/* eslint-disable-next-line @next/next/no-img-element -- sample QR */}
                      <img src={sampleQrSrc()} width={240} height={240} alt="" loading="lazy" className="mx-auto mt-3 w-[78%]" />
                      <p className="mt-2 text-[11px] text-ink-faint">{ui.showAtDoor}</p>
                    </div>
                  </div>
                ) : step >= 4 ? (
                  <div className={cn("flex w-full flex-col items-center pt-10", pop)}>
                    <p className="font-display text-2xl text-ink">{ui.pageDeclined}</p>
                    <NoQr className="mt-6">{ui.noQr}</NoQr>
                  </div>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample */}
                    <img src={thumb} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} alt="" loading="lazy" className="h-auto w-[62%] rounded-md shadow-soft" />
                    <p className="mt-4 font-display text-[1.6rem] leading-tight text-ink">{ui.pageTitle}</p>
                    <div className="mt-4 grid w-full grid-cols-2 gap-2">
                      {(["accept", "decline"] as Path[]).map((p) => (
                        <span
                          key={p}
                          className={cn(
                            "relative flex h-11 items-center justify-center overflow-hidden rounded-full text-[14px] font-medium transition-colors duration-300",
                            p === "accept" ? "bg-ink text-cream" : "border border-hairline text-ink",
                          )}
                        >
                          {p === "accept" ? ui.pageAccept : ui.pageDecline}
                          {step === 3 && p === path ? <span className="ivx-ripple" /> : null}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </figure>

      {/* accept / decline */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <span className="text-[13px] text-ink-faint">{labels.paths}</span>
        <div role="group" aria-label={labels.paths} className="inline-flex rounded-full border border-hairline bg-[#fffcf6] p-1">
          {(["accept", "decline"] as Path[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={path === p}
              onClick={() => {
                setPath(p);
                setRound((r) => r + 1);
              }}
              className={cn(
                "h-10 min-w-24 rounded-full px-4 text-[14px] font-medium transition-colors duration-300",
                path === p ? (p === "accept" ? "bg-sage text-white" : "bg-rosewood text-white") : "text-ink-soft hover:text-ink",
              )}
            >
              {p === "accept" ? labels.accept : labels.decline}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRound((r) => r + 1)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-soft transition hover:text-ink"
        >
          <RotateCcw className="size-3.5" />
          {labels.replay}
        </button>
      </div>
    </div>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return <div className="rounded-xl rounded-ss-[4px] bg-white p-2 shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]">{children}</div>;
}

function Meta({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-end text-[10px] text-[#54656f]">{children}</p>;
}

function Typing({ className }: { className?: string }) {
  return (
    <div className={cn("self-start", className)}>
      <div className="flex gap-1 rounded-xl rounded-ss-[4px] bg-white px-3.5 py-3 shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="ivx-dot size-1.5 rounded-full bg-[#9aa3a8]" />
        ))}
      </div>
    </div>
  );
}

function NoQr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-2 self-center rounded-full bg-white/80 px-3 py-1 text-[11.5px] text-ink-faint", className)}>
      <span className="h-px w-4 bg-line-strong" />
      {children}
      <span className="h-px w-4 bg-line-strong" />
    </p>
  );
}
