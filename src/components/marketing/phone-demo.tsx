"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BatteryFull,
  Camera,
  CheckCheck,
  ChevronLeft,
  CornerUpLeft,
  Mic,
  Plus,
  SignalHigh,
  SquareArrowOutUpRight,
  Wifi,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Hero product demonstration: a WhatsApp conversation in which a guest receives an
 * invitation, taps Accept, and receives their personal invitation with a QR code.
 *
 * The server renders the finished conversation (also what reduced-motion users and
 * no-JS visitors see). In the browser it holds that frame, then replays the story on
 * a gentle loop while the phone is on screen.
 */

type Stage = 0 | 1 | 2 | 3 | 4;
// 0 empty · 1 invitation arrives · 2 tap on Accept · 3 reply sent + typing · 4 personal invitation arrives
const TIMELINE: { stage: Stage; ms: number }[] = [
  { stage: 0, ms: 900 },
  { stage: 1, ms: 2800 },
  { stage: 2, ms: 1000 },
  { stage: 3, ms: 1500 },
  { stage: 4, ms: 5600 },
];
const FIRST_HOLD_MS = 4200;
const EASE = [0.22, 1, 0.36, 1] as const;

const WA = {
  wallpaper: "#efe9df",
  bubble: "#ffffff",
  outgoing: "#dcf5d3",
  text: "#111b21",
  meta: "#667781",
  action: "#00866e",
};

export function PhoneDemo({ className }: { className?: string }) {
  const { dict, locale } = useI18n();
  const t = dict.marketing.demo;
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.35 });
  const [stage, setStage] = useState<Stage>(4);
  const [cycle, setCycle] = useState(0);
  const pos = useRef(-1);

  useEffect(() => {
    if (reduce || !inView) return;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      pos.current = (pos.current + 1) % TIMELINE.length;
      const { stage: next, ms } = TIMELINE[pos.current];
      setStage(next);
      if (next === 1) setCycle((c) => c + 1);
      timer = setTimeout(advance, ms);
    };
    timer = setTimeout(advance, pos.current === -1 ? FIRST_HOLD_MS : 600);
    return () => clearTimeout(timer);
  }, [reduce, inView]);

  const ar = locale === "ar";
  const theme = ar ? "arabic" : "luxury";
  const language = ar ? "AR" : "EN";
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <p className="sr-only">{t.label}</p>
      <div
        aria-hidden="true"
        className="relative mx-auto aspect-[300/628] w-[min(300px,80vw)] rounded-[3rem] bg-[#1b1714] p-[9px] shadow-[0_2px_4px_rgb(30_26_22/0.08),0_40px_80px_-30px_rgb(30_26_22/0.45),inset_0_0_0_1.5px_rgb(255_255_255/0.08)]"
      >
        {/* side buttons */}
        <span className="absolute -start-[3px] top-[22%] h-10 w-[3px] rounded-s bg-[#2a2420]" />
        <span className="absolute -start-[3px] top-[31%] h-14 w-[3px] rounded-s bg-[#2a2420]" />
        <span className="absolute -end-[3px] top-[27%] h-20 w-[3px] rounded-e bg-[#2a2420]" />

        <div
          className="relative flex h-full flex-col overflow-hidden rounded-[2.4rem]"
          style={{ background: WA.wallpaper }}
          dir={ar ? "rtl" : "ltr"}
        >
          {/* Status bar */}
          <div
            className="relative flex h-9 shrink-0 items-center justify-between bg-[#f7f5f2] px-6 pt-1 text-[11px] font-semibold text-[#111b21]"
            dir="ltr"
          >
            <span>9:41</span>
            <span className="absolute start-1/2 top-2 h-[18px] w-[76px] -translate-x-1/2 rounded-full bg-[#1b1714]" />
            <span className="flex items-center gap-1">
              <SignalHigh className="size-3" strokeWidth={2.5} />
              <Wifi className="size-3" strokeWidth={2.5} />
              <BatteryFull className="size-3.5" strokeWidth={2} />
            </span>
          </div>

          {/* Chat header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-black/5 bg-[#f7f5f2] px-2.5 pb-2 pt-1">
            <ChevronLeft className="size-5 shrink-0 text-[#00866e] rtl:rotate-180" strokeWidth={2} />
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-bronze-200 bg-ivory">
              <LogoMark className="h-[18px]" title="" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold" style={{ color: WA.text }}>
                {t.sender}
              </span>
              <span className="block truncate text-[10.5px]" style={{ color: WA.meta }}>
                {t.senderStatus}
              </span>
            </span>
          </div>

          {/* Conversation */}
          <div
            className="relative flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden px-2.5 pb-2.5 pt-3"
            style={{
              backgroundImage: "radial-gradient(rgb(132 102 74 / 0.07) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
          >
            <div className="mb-1 flex justify-center">
              <span
                className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium shadow-[0_1px_0.5px_rgb(0_0_0/0.08)]"
                style={{ color: WA.meta }}
              >
                {t.today}
              </span>
            </div>

            <AnimatePresence initial={false} mode="popLayout">
              {stage >= 1 ? (
                <motion.div
                  key={`invite-${cycle}`}
                  layout={!reduce}
                  initial={enter}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.4 } }}
                  transition={{ duration: 0.55, ease: EASE }}
                  className="max-w-[86%] origin-bottom-left self-start rtl:origin-bottom-right"
                >
                  <Bubble>
                    <div className="overflow-hidden rounded-[7px]">
                      <div className="aspect-[1/1] overflow-hidden">
                        <CardPreview lazy themeKey={theme} language={language} guest={null} qrPlaceholder={false} title="" />
                      </div>
                    </div>
                    <p
                      className="whitespace-pre-line px-1.5 pb-0.5 pt-1.5 text-[11.5px] leading-[1.42]"
                      style={{ color: WA.text }}
                    >
                      {t.message}
                    </p>
                    <div className="flex items-end justify-between gap-2 px-1.5 pb-0.5">
                      <span className="text-[10px]" style={{ color: WA.meta }}>
                        {t.footer}
                      </span>
                      <Time>{t.time1}</Time>
                    </div>
                  </Bubble>
                  <div className="mt-[3px] grid gap-[3px]">
                    <QuickReply pressed={stage === 2} tapping={stage === 2 && !reduce}>
                      {t.accept}
                    </QuickReply>
                    <QuickReply>{t.decline}</QuickReply>
                  </div>
                </motion.div>
              ) : null}

              {stage >= 3 ? (
                <motion.div
                  key={`reply-${cycle}`}
                  layout={!reduce}
                  initial={enter}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.4 } }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="max-w-[78%] origin-bottom-right self-end rtl:origin-bottom-left"
                >
                  <div
                    className="flex items-end gap-2 rounded-[9px] rounded-se-[3px] px-2 py-1.5 shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]"
                    style={{ background: WA.outgoing }}
                  >
                    <span className="text-[11.5px]" style={{ color: WA.text }}>
                      {t.accept}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <Time>{t.time2}</Time>
                      <CheckCheck className="size-3 text-[#53bdeb]" strokeWidth={2.25} />
                    </span>
                  </div>
                </motion.div>
              ) : null}

              {stage === 3 ? (
                <motion.div
                  key={`typing-${cycle}`}
                  layout={!reduce}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.35, ease: EASE, delay: 0.5 }}
                  className="self-start"
                >
                  <div className="flex gap-1 rounded-[9px] rounded-ss-[3px] bg-white px-3 py-2.5 shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="size-1.5 rounded-full bg-[#9aa3a8]"
                        animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : null}

              {stage >= 4 ? (
                <motion.div
                  key={`delivery-${cycle}`}
                  layout={!reduce}
                  initial={enter}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.4 } }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="max-w-[86%] origin-bottom-left self-start rtl:origin-bottom-right"
                >
                  <Bubble>
                    <div className="overflow-hidden rounded-[7px]">
                      <CardPreview lazy themeKey={theme} language={language} qrPlaceholder title="" />
                    </div>
                    <p className="px-1.5 pb-0.5 pt-1.5 text-[11.5px] leading-[1.42]" style={{ color: WA.text }}>
                      {t.delivery}
                    </p>
                    <div className="flex justify-end px-1.5 pb-0.5">
                      <Time>{t.time2}</Time>
                    </div>
                    <div
                      className="-mx-[3px] -mb-[3px] mt-1 flex items-center justify-center gap-1.5 border-t border-black/[0.06] py-2 text-[12px] font-medium"
                      style={{ color: WA.action }}
                    >
                      <SquareArrowOutUpRight className="size-3 rtl:-scale-x-100" strokeWidth={2} />
                      {t.view}
                    </div>
                  </Bubble>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Composer */}
          <div className="flex shrink-0 items-center gap-2 bg-[#f7f5f2] px-2.5 pb-4 pt-2">
            <Plus className="size-[18px] shrink-0" strokeWidth={1.75} style={{ color: WA.action }} />
            <span
              className="flex h-7 flex-1 items-center rounded-full border border-black/10 bg-white px-3 text-[11px]"
              style={{ color: WA.meta }}
            >
              {t.typeMessage}
            </span>
            <Camera className="size-[18px] shrink-0" strokeWidth={1.75} style={{ color: WA.action }} />
            <Mic className="size-[18px] shrink-0" strokeWidth={1.75} style={{ color: WA.action }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[9px] rounded-ss-[3px] p-[3px] shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]" style={{ background: WA.bubble }}>
      {children}
    </div>
  );
}

function Time({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-[9.5px] leading-none tabular-nums" style={{ color: WA.meta }}>
      {children}
    </span>
  );
}

function QuickReply({ children, pressed, tapping }: { children: ReactNode; pressed?: boolean; tapping?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center gap-1.5 overflow-hidden rounded-[9px] py-2 text-[12px] font-medium shadow-[0_1px_0.5px_rgb(0_0_0/0.1)] transition-colors duration-300",
        pressed ? "bg-[#e9edef]" : "bg-white",
      )}
      style={{ color: WA.action }}
    >
      <CornerUpLeft className="size-3 rtl:-scale-x-100" strokeWidth={2} />
      {children}
      {tapping ? (
        <motion.span
          className="pointer-events-none absolute start-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/25 rtl:translate-x-1/2"
          initial={{ scale: 0.4, opacity: 0.7 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
        />
      ) : null}
    </div>
  );
}
