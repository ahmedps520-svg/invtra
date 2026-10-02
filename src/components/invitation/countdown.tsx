"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Label, Reveal, useInvitation, useNumber } from "./primitives";
import s from "./invitation.module.css";

/** Live countdown to the event start (rendered client-side only to avoid hydration drift). */
export function Countdown() {
  const { vm } = useInvitation();
  const num = useNumber();
  const target = new Date(vm.event.startsAt).getTime();
  const end = vm.event.endsAt ? new Date(vm.event.endsAt).getTime() : target + 6 * 3600_000;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now !== null && now >= target) {
    return (
      <Reveal className="py-6 text-center">
        <Label pick={(d) => (now < end ? d.countdown.today : d.countdown.passed)} className={cn(s.display, "text-3xl")} inline={false} />
      </Reveal>
    );
  }
  const diff = now === null ? 0 : Math.max(0, target - now);
  const parts = [
    { v: Math.floor(diff / 86_400_000), label: (d: typeof vm.dict.en) => d.countdown.days },
    { v: Math.floor((diff % 86_400_000) / 3_600_000), label: (d: typeof vm.dict.en) => d.countdown.hours },
    { v: Math.floor((diff % 3_600_000) / 60_000), label: (d: typeof vm.dict.en) => d.countdown.minutes },
    { v: Math.floor((diff % 60_000) / 1000), label: (d: typeof vm.dict.en) => d.countdown.seconds },
  ];
  return (
    <Reveal className="text-center">
      <Label pick={(d) => d.countdown.title} className={cn(s.eyebrow, "mb-6 block")} />
      <div className="flex justify-center gap-2.5 sm:gap-4" dir="ltr" role="timer" aria-live="off">
        {(vm.lang === "ar" ? [...parts].reverse() : parts).map((p, i) => (
          <div key={i} className={cn(s.countBox, "flex flex-col items-center")}>
            <span className={cn(s.display, "text-4xl tabular-nums sm:text-5xl")} suppressHydrationWarning>
              {now === null ? "––" : num(p.v, i === 0 ? 0 : 2)}
            </span>
            <Label pick={p.label} className={cn(s.muted, "mt-2 text-[10px] font-medium uppercase tracking-[0.2em]")} inline={false} />
          </div>
        ))}
      </div>
    </Reveal>
  );
}
