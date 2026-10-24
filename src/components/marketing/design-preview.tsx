"use client";

import { useState } from "react";
import { SAMPLE_HEIGHT, SAMPLE_WIDTH, sampleSrc, type SampleLang } from "@/lib/marketing/samples";
import { cn } from "@/lib/utils";

type Lang = "EN" | "AR" | "BILINGUAL";
const FILE: Record<Lang, SampleLang> = { EN: "en", AR: "ar", BILINGUAL: "bi" };

/** A design at full size, switchable between English, Arabic and bilingual. */
export function DesignPreview({
  theme,
  initial,
  label,
  languages,
  alt,
}: {
  theme: string;
  initial: Lang;
  label: string;
  languages: Record<Lang, string>;
  /** "{language}" is replaced with the language shown. */
  alt: string;
}) {
  const [lang, setLang] = useState<Lang>(initial);
  return (
    <div>
      <div className="ivx-foil relative mx-auto aspect-[4/5] w-full max-w-[26rem] overflow-hidden rounded-[6px] bg-cream-deep shadow-lift ring-1 ring-black/5">
        {(["EN", "AR", "BILINGUAL"] as Lang[]).map((l) => (
          // eslint-disable-next-line @next/next/no-img-element -- pre-rendered sample, one per language
          <img
            key={l}
            src={sampleSrc(theme, FILE[l])}
            width={SAMPLE_WIDTH}
            height={SAMPLE_HEIGHT}
            alt={l === lang ? alt.replace("{language}", languages[l]) : ""}
            aria-hidden={l === lang ? undefined : true}
            loading={l === initial ? undefined : "lazy"}
            fetchPriority={l === initial ? "high" : undefined}
            className={cn("absolute inset-0 h-full w-full transition-opacity duration-500 ease-luxe", l === lang ? "opacity-100" : "opacity-0")}
          />
        ))}
      </div>
      <div className="mt-5 flex justify-center">
        <div role="group" aria-label={label} className="inline-flex rounded-full border border-hairline bg-[#fffcf6] p-1">
          {(["AR", "EN", "BILINGUAL"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              lang={l === "AR" ? "ar" : undefined}
              aria-pressed={l === lang}
              onClick={() => setLang(l)}
              className={cn("h-10 min-w-16 rounded-full px-4 text-[14px] transition-colors duration-300", l === lang ? "bg-ink text-cream" : "text-ink-soft hover:text-ink")}
            >
              {languages[l]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
