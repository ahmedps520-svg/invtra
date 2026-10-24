"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A short manifesto that types itself once, word by word, when it scrolls into view. The whole
 * text is always in the HTML; under reduced motion (or before it's seen) it simply reads as text.
 */
export function Manifesto({ eyebrow, text }: { eyebrow: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"rest" | "waiting" | "typing">("rest");
  const words = text.split(/(\s+)/);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Only animate when it starts below the fold, so text already on screen never blinks out.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    setPhase("waiting");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setPhase("typing");
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  let n = 0;
  return (
    <section aria-label={eyebrow} className="relative overflow-clip py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_50%,var(--color-gold-soft),transparent)] opacity-60" />
      <div ref={ref} className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <p className="eyebrow text-gold-deep! rtl:text-[13px]">{eyebrow}</p>
        <span aria-hidden="true" className="ivx-gold-rule mx-auto mt-6 block w-24" />
        <p className="mt-8 font-display text-[1.85rem] leading-[1.35] text-balance text-ink sm:text-[2.6rem] sm:leading-[1.3] rtl:leading-[1.6]">
          {words.map((w, i) => {
            if (/^\s+$/.test(w)) return w;
            const delay = n++ * 55;
            return (
              <span
                key={i}
                style={phase === "typing" ? { transitionDelay: `${delay}ms` } : undefined}
                className={cn("transition-opacity duration-300 ease-out", phase === "waiting" ? "opacity-0" : "opacity-100")}
              >
                {w}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
