"use client";

import { useState } from "react";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc } from "@/lib/marketing/samples";
import { cn } from "@/lib/utils";
import { usePlayOnScreen, useStoryline } from "./use-play";

type Lang = "EN" | "AR" | "BILINGUAL";
const ORDER: Lang[] = ["EN", "AR", "BILINGUAL"];
const FILE = { EN: "en", AR: "ar", BILINGUAL: "bi" } as const;

/**
 * One invitation turning from English (left to right) to Arabic (right to left) to both, with the
 * numerals following. Plays while on screen; the chips pick a language by hand.
 */
export function BilingualFlip({ labels, label }: { labels: Record<Lang, string>; label: string }) {
  const { ref, playing } = usePlayOnScreen<HTMLDivElement>(0.4);
  const [picked, setPicked] = useState<Lang | null>(null);
  const step = useStoryline(playing && !picked, [2400, 2400, 2400]);
  const lang: Lang = picked ?? ORDER[Math.min(step, 2)];

  return (
    <div ref={ref}>
      <figure aria-label={label} className="relative mx-auto aspect-[4/5] w-[78%] max-w-[19rem] [perspective:1200px]">
        {ORDER.map((l) => (
          // eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample
          <img
            key={l}
            src={sampleSrc("bilingual", FILE[l])}
            width={SAMPLE_WIDTH}
            height={SAMPLE_HEIGHT}
            alt=""
            loading="lazy"
            className={cn(
              "absolute inset-0 h-full w-full rounded-[4px] shadow-lift ring-1 ring-black/5 transition-[opacity,transform] duration-700 ease-luxe [backface-visibility:hidden]",
              l === lang ? "opacity-100 [transform:rotateY(0deg)]" : "pointer-events-none opacity-0 [transform:rotateY(-70deg)]",
            )}
          />
        ))}
      </figure>
      <div className="mt-6 flex flex-col items-center gap-3">
        <div role="group" aria-label={label} className="inline-flex rounded-full border border-hairline bg-[#fffcf6] p-1">
          {ORDER.map((l) => (
            <button
              key={l}
              type="button"
              lang={l === "AR" ? "ar" : l === "EN" ? "en" : undefined}
              aria-pressed={l === lang}
              onClick={() => setPicked(l)}
              className={cn("h-10 rounded-full px-4 text-[14px] transition-colors duration-300", l === lang ? "bg-ink text-cream" : "text-ink-soft hover:text-ink")}
            >
              {labels[l]}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-3 text-[12px] text-ink-faint" dir="ltr" aria-hidden="true">
          <span className={cn("transition-colors", lang !== "AR" && "text-gold-deep")}>LTR →</span>
          <span className="h-3 w-px bg-hairline" />
          <span className={cn("transition-colors", lang !== "EN" && "text-gold-deep")}>← RTL</span>
          <span className="h-3 w-px bg-hairline" />
          <span className="ivx-ar-ui tabular-nums">{lang === "EN" ? "12" : lang === "AR" ? "١٢" : "12 · ١٢"}</span>
        </p>
      </div>
    </div>
  );
}
