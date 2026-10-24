"use client";

import { Check, ScanLine } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { sampleQrSrc } from "@/lib/marketing/samples";
import { cn } from "@/lib/utils";
import { usePlayOnScreen, useStoryline } from "./use-play";

const TOTAL = 250;
const BEFORE = 147;

/**
 * Door check-in, played while on screen: the scan line sweeps a guest's personal code, the guest
 * is checked in and the arrivals counter ticks. At rest it shows the checked-in result.
 */
export function CheckinScan({
  locale,
  copy,
}: {
  locale: Locale;
  copy: { title: string; aim: string; checkedIn: string; arrived: string; of: string; guest: string; seats: string; label: string };
}) {
  const { ref, playing } = usePlayOnScreen<HTMLDivElement>(0.4);
  const step = useStoryline(playing, [2100]);
  const done = step >= 1;
  const n = (x: number) => formatNumber(x, locale);
  const count = done ? BEFORE + 1 : BEFORE;

  return (
    <div ref={ref} className="mx-auto w-full max-w-[25rem]">
      <figure role="img" aria-label={copy.label} className="ivx-paper-light overflow-hidden p-3">
        <div aria-hidden="true">
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <ScanLine className="size-4 text-gold-deep" strokeWidth={1.5} />
              {copy.title}
            </p>
            <p className="text-[12px] text-ink-faint">
              {copy.arrived}{" "}
              <span key={count} className={cn("inline-block font-display text-[1.35rem] leading-none text-ink tabular-nums", playing && "ivx-pop")}>
                {n(count)}
              </span>{" "}
              {fmt(copy.of, { total: n(TOTAL) })}
            </p>
          </div>

          {/* the camera */}
          <div className="relative aspect-[4/4.4] overflow-hidden rounded-[1.1rem] bg-[radial-gradient(120%_90%_at_50%_30%,#3a332c,#14110e_75%)]">
            {/* the guest's phone with their pass */}
            <div className="absolute left-1/2 top-[9%] w-[54%] -translate-x-1/2 rotate-[-4deg] rounded-[1.4rem] border-[5px] border-[#0d0b09] bg-[#fffcf6] p-3 text-center shadow-[0_24px_40px_-20px_rgb(0_0_0/0.8)] rtl:rotate-[4deg]">
              <p className="text-[9px] font-medium tracking-[0.2em] text-gold-deep uppercase rtl:text-[10px]">INVTRA</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- sample QR */}
              <img src={sampleQrSrc()} width={240} height={240} alt="" loading="lazy" className="mx-auto mt-2 w-[86%]" />
              <p className="mt-1.5 truncate font-display text-[15px] text-ink">{copy.guest}</p>
            </div>
            {/* aiming frame */}
            <div className="absolute left-1/2 top-[19%] aspect-square w-[46%] -translate-x-1/2 [container-type:inline-size]">
              {["start-0 top-0 border-s-2 border-t-2 rounded-ss-xl", "end-0 top-0 border-e-2 border-t-2 rounded-se-xl", "bottom-0 start-0 border-b-2 border-s-2 rounded-es-xl", "bottom-0 end-0 border-b-2 border-e-2 rounded-ee-xl"].map((c) => (
                <span key={c} className={cn("absolute size-7 border-gold transition-colors duration-500", done && "border-[#7fc29a]", c)} />
              ))}
              <span
                data-scanning={!done}
                className="ivx-scanline absolute inset-x-1 h-0.5 rounded-full bg-[linear-gradient(90deg,transparent,#e9cf95,transparent)] shadow-[0_0_14px_2px_rgb(233_207_149/0.6)] [--ivx-scan-travel:76cqw]"
              />
            </div>
            <p className={cn("absolute inset-x-0 bottom-[22%] text-center text-[12px] text-white/70 transition-opacity duration-300", done && "opacity-0")}>{copy.aim}</p>

            {/* result */}
            <div
              className={cn(
                "absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl bg-[#f3faf5] px-4 py-3 shadow-[0_18px_30px_-18px_rgb(0_0_0/0.6)] transition-[opacity,translate] duration-500 ease-luxe",
                done ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-white">
                <Check className="size-5" strokeWidth={2.5} />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[14px] font-semibold text-ink">{copy.guest}</span>
                <span className="block text-[12.5px] text-sage">
                  {copy.seats} · {copy.checkedIn}
                </span>
              </span>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
