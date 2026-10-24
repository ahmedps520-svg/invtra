"use client";

import { sampleQrSrc } from "@/lib/marketing/samples";
import { cn } from "@/lib/utils";
import { usePlayOnScreen, useStoryline } from "./use-play";

/**
 * "Bring your own artwork": the uploaded design drops into place and each guest's QR plate is
 * stamped on, the way INVTRA composites it. Plays while on screen; rests on the finished card.
 */
export function UploadStamp({
  sample,
  ar,
  labels,
}: {
  sample: { names: string; line: string; date: string; caption: string; label: string };
  ar: boolean;
  labels: { yours: string; stamped: string };
}) {
  const { ref, playing } = usePlayOnScreen<HTMLDivElement>(0.4);
  const step = useStoryline(playing, [700, 1000, 900]);
  const dropped = !playing || step >= 1;
  const stamped = !playing || step >= 2;

  return (
    <div ref={ref}>
      <div className="relative mx-auto w-[78%] max-w-[19rem] rounded-[1.25rem] border border-dashed border-gold/70 bg-cream p-[7%]">
        <span className="absolute -top-3 start-5 rounded-full bg-cream px-2 text-[11px] font-medium tracking-[0.12em] text-gold-deep uppercase rtl:text-[12px]">
          {labels.yours}
        </span>
        <figure
          role="img"
          aria-label={sample.label}
          className={cn(
            "@container relative aspect-[4/5] w-full overflow-hidden rounded-[4px] shadow-lift transition-[opacity,transform] duration-700 ease-luxe",
            dropped ? "translate-y-0 scale-100 opacity-100" : "-translate-y-4 scale-[1.03] opacity-0",
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#4c5a47,#26302a_70%)]" />
          <div className="absolute inset-[5%] border border-[#c9a66b]/60" />
          <div className="absolute inset-[7%] border border-[#c9a66b]/30" />
          <div className="absolute inset-x-0 top-[14%] text-center text-[#efe6d2]">
            <svg viewBox="0 0 120 20" className="mx-auto h-[3cqw] w-auto text-[#c9a66b]" fill="none" aria-hidden="true">
              <path d="M0 10h48M72 10h48" stroke="currentColor" strokeWidth="0.8" />
              <path d="M60 3l7 7-7 7-7-7z" stroke="currentColor" strokeWidth="0.8" />
            </svg>
            <p className={ar ? "mt-[6%] font-arabic-display text-[11cqw] leading-tight" : "mt-[6%] font-display text-[12.5cqw] leading-tight italic"}>{sample.names}</p>
            <p className="mt-[3cqw] font-display text-[3.4cqw] tracking-[0.3em] text-[#d9cdb4] uppercase">{sample.line}</p>
            <p className="mt-[2.5cqw] font-display text-[3.4cqw] tracking-[0.25em] text-[#c9a66b]" dir="ltr">
              {sample.date}
            </p>
          </div>
          <div
            className={cn(
              "absolute bottom-[8%] start-1/2 w-[32%] -translate-x-1/2 rounded-[7%] bg-white/95 p-[2.2%] text-center transition-[opacity,scale,rotate] duration-500 ease-luxe rtl:translate-x-1/2",
              stamped ? "scale-100 rotate-0 opacity-100" : "scale-150 -rotate-6 opacity-0",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- sample QR */}
            <img src={sampleQrSrc("N7RW4TKD2M")} width={240} height={240} alt="" loading="lazy" className="block h-auto w-full" />
            <p className="mt-[3%] truncate text-[1.75cqw] font-medium tracking-[0.06em] text-[#3a332c] uppercase">{sample.caption}</p>
          </div>
        </figure>
        <p className={cn("mt-3 text-center text-[12px] text-gold-deep transition-opacity duration-500", stamped ? "opacity-100" : "opacity-0")}>{labels.stamped}</p>
      </div>
    </div>
  );
}
