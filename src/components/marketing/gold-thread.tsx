"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A thin gold thread that draws itself down the section as the page scrolls, lighting each step
 * as it reaches it. Drives one CSS variable (--ivx-thread, 0…1) and a data attribute per step;
 * the thread itself is a scaleY transform. Fully drawn under reduced motion.
 */
export function GoldThread({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const steps = Array.from(el.querySelectorAll<HTMLElement>("[data-thread-step]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--ivx-thread", "1");
      steps.forEach((s) => (s.dataset.lit = "true"));
      return;
    }
    let frame = 0;
    let active = false;
    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const reach = window.innerHeight * 0.62 - box.top;
      const p = Math.max(0, Math.min(1, reach / box.height));
      el.style.setProperty("--ivx-thread", p.toFixed(4));
      for (const s of steps) {
        const node = s.getBoundingClientRect();
        s.dataset.lit = String(node.top + 24 - box.top <= reach);
      }
    };
    const onScroll = () => {
      if (active && !frame) frame = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting;
      if (active) update();
    });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ ["--ivx-thread" as string]: "1" }}>
      {children}
    </div>
  );
}
