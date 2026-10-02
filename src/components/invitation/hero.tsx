"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { getTheme } from "@/lib/themes/registry";
import { monogramOf, cn } from "@/lib/utils";
import { star } from "@/lib/card/ornaments";
import { Divider, Txt, useInvitation } from "./primitives";
import s from "./invitation.module.css";

function splitNames(names: string): [string, string] | null {
  const parts = names.split(/\s+(?:&|and|و)\s+|\s*&\s*/i).map((p) => p.trim()).filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/** Host names, stacked with an accented ampersand when there are two. */
function Names({ className }: { className?: string }) {
  const { vm, lang, animation } = useInvitation();
  const theme = getTheme(vm.themeKey);
  const upper = theme.page.namesUppercase;
  const en = vm.event.hostNames;
  const ar = vm.event.hostNamesAr || "";
  const render = (names: string, arabic: boolean, size: string) => {
    const pair = splitNames(names);
    const cls = cn(s.display, size, upper && !arabic && "uppercase tracking-[0.08em]");
    const word = (text: string, i: number) =>
      animation === "elegant" ? (
        <motion.span
          className="block"
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.4, delay: 0.25 + i * 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {text}
        </motion.span>
      ) : (
        <span className="block">{text}</span>
      );
    if (!pair) {
      return (
        <h1 className={cls} lang={arabic ? "ar" : "en"} dir={arabic ? "rtl" : undefined}>
          {word(names, 0)}
        </h1>
      );
    }
    return (
      <h1 className={cls} lang={arabic ? "ar" : "en"} dir={arabic ? "rtl" : undefined}>
        {word(pair[0], 0)}
        <span className={cn("my-1 block text-[0.5em] italic", s.accent, arabic && "not-italic")} aria-label={arabic ? "و" : "and"}>
          {arabic ? "و" : "&"}
        </span>
        {word(pair[1], 1)}
      </h1>
    );
  };
  if (lang === "ar") return <div className={className}>{render(ar || en, true, "text-[3.4rem] sm:text-7xl")}</div>;
  if (lang === "bilingual" && ar) {
    return (
      <div className={cn(className, "space-y-3")}>
        {render(ar, true, "text-5xl sm:text-6xl")}
        <p className={cn(s.display, "text-2xl sm:text-3xl opacity-80", upper && "uppercase tracking-[0.1em]")}>{en}</p>
      </div>
    );
  }
  return <div className={className}>{render(en, false, "text-[3.4rem] sm:text-7xl")}</div>;
}

function HeroText({ light }: { light?: boolean }) {
  const { vm } = useInvitation();
  return (
    <div className={cn("relative z-10 mx-auto flex max-w-xl flex-col items-center px-10 text-center sm:px-6", light && "text-white")}>
      {vm.event.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vm.event.logoUrl} alt="" className="mb-8 h-16 w-auto object-contain" />
      ) : null}
      <Txt en={vm.copy.en.eyebrow} ar={vm.copy.ar.eyebrow} as="p" className={cn(s.eyebrow, "mb-6", light && "text-white/85")} inline />
      <Names />
      <Txt
        en={vm.copy.en.intro}
        ar={vm.copy.ar.intro}
        as="p"
        className={cn("mt-6 max-w-md text-lg leading-relaxed", light ? "text-white/85" : s.muted)}
      />
      <Divider className={cn("mt-8", light && "text-white/80")} />
      <Txt en={vm.event.date.en} ar={vm.event.date.ar} as="p" className="mt-6 text-sm font-medium uppercase tracking-[0.2em]" inline={false} />
      <Txt
        en={vm.event.venueName}
        ar={vm.event.venueNameAr}
        as="p"
        className={cn("mt-2 text-sm", light ? "text-white/80" : s.muted)}
      />
    </div>
  );
}

function ScrollCue({ light }: { light?: boolean }) {
  const { d } = useInvitation();
  return (
    <div className={cn("absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.3em]", light ? "text-white/70" : s.muted)}>
      <span>{d.scroll}</span>
      <ChevronDown className={cn("size-4", s.scrollCue)} aria-hidden="true" />
    </div>
  );
}

export function Hero() {
  const { vm } = useInvitation();
  const style = getTheme(vm.themeKey).page.hero;
  const cover = vm.event.coverUrl;

  if (style === "split") {
    return (
      <header className="relative grid min-h-[100svh] md:grid-cols-2">
        <div className="relative min-h-[46svh] overflow-hidden md:min-h-full">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: "var(--inv-accent)" }}>
              <div className="absolute -end-24 -top-24 size-96 rounded-full opacity-25" style={{ background: "var(--inv-surface)" }} />
              <div className="absolute bottom-10 start-10 grid grid-cols-4 gap-2 opacity-70">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="size-3" style={{ background: "var(--inv-surface)", opacity: [1, 0.4, 0.7, 0.2][i % 4] }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative flex items-center justify-center py-20">
          <HeroText />
          <ScrollCue />
        </div>
      </header>
    );
  }

  if (style === "framed") {
    return (
      <header className="relative flex min-h-[100svh] items-center justify-center p-4 sm:p-8">
        <div className={cn(s.frame, "relative flex min-h-[calc(100svh-2rem)] w-full max-w-3xl flex-col items-center justify-center overflow-hidden py-24 sm:min-h-[calc(100svh-4rem)]")}>
          {cover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" className="absolute inset-0 size-full object-cover opacity-30" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--inv-bg) 55%, transparent), var(--inv-bg))" }} />
            </>
          ) : null}
          <svg className={cn("absolute top-8 h-10 w-24", s.accent)} viewBox="-50 -10 100 40" fill="currentColor" aria-hidden="true">
            {Array.from({ length: 11 }).map((_, i) => {
              const a = (Math.PI * (20 + i * 14)) / 180;
              return <path key={i} d={`M${Math.cos(a) * 12} ${Math.sin(a) * 12 - 8}L${Math.cos(a) * 30} ${Math.sin(a) * 30 - 8}`} stroke="currentColor" strokeWidth="1" />;
            })}
            <path d="M-8 -8A8 8 0 0 0 8 -8Z" />
          </svg>
          <HeroText />
          <ScrollCue />
        </div>
      </header>
    );
  }

  if (style === "arch") {
    return (
      <header className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 pb-24 pt-16">
        <svg className={cn("mb-6 size-6", s.accent)} viewBox="-12 -12 24 24" aria-hidden="true">
          <path d={star(0, 0, 11)} fill="currentColor" />
        </svg>
        <div className={cn(s.arch, "relative w-full max-w-md overflow-hidden border px-6 pb-14 pt-24")} style={{ borderColor: "var(--inv-accent)", background: "var(--inv-surface)" }}>
          <div className={cn(s.arch, "pointer-events-none absolute inset-2 border")} style={{ borderColor: "var(--inv-line)" }} />
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className={cn(s.arch, "mx-auto -mt-16 mb-10 aspect-[4/5] w-3/4 object-cover")} />
          ) : null}
          <HeroText />
        </div>
        <ScrollCue />
      </header>
    );
  }

  if (style === "monogram") {
    const mono = vm.design.monogram || monogramOf(vm.lang === "ar" && vm.event.hostNamesAr ? vm.event.hostNamesAr : vm.event.hostNames);
    return (
      <header className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 py-24">
        <div className={cn("pointer-events-none absolute -start-16 -top-10 h-72 w-72 opacity-50", s.accent)} aria-hidden="true">
          <Sprig />
        </div>
        <div className={cn("pointer-events-none absolute -bottom-10 -end-16 h-72 w-72 rotate-180 opacity-40", s.accent)} aria-hidden="true">
          <Sprig />
        </div>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="mb-10 size-44 rounded-full object-cover shadow-lg ring-1 ring-[var(--inv-line)] ring-offset-8 ring-offset-[var(--inv-bg)]" />
        ) : (
          <div className="relative mb-10 flex size-28 items-center justify-center rounded-full border" style={{ borderColor: "var(--inv-accent)" }}>
            <div className="absolute inset-1.5 rounded-full border" style={{ borderColor: "var(--inv-line)" }} />
            <span className={cn(s.display, s.accent, "text-3xl")}>{mono}</span>
          </div>
        )}
        <HeroText />
        <ScrollCue />
      </header>
    );
  }

  // centered (default)
  return (
    <header className="relative flex min-h-[100svh] items-center justify-center overflow-hidden py-24">
      {cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-black/45" />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-6 border sm:inset-10" style={{ borderColor: "var(--inv-line)" }} aria-hidden="true" />
      )}
      <HeroText light={Boolean(cover)} />
      <ScrollCue light={Boolean(cover)} />
    </header>
  );
}

function Sprig() {
  const leaves = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg viewBox="0 0 300 300" className="size-full" fill="currentColor">
      <path d="M10 290 Q 120 170 290 20" stroke="currentColor" strokeWidth="2" fill="none" />
      {leaves.map((i) => {
        const t = (i + 1) / 10;
        const x = 10 + (290 - 10) * t + (i % 2 ? -14 : 14);
        const y = 290 - 270 * t + (i % 2 ? -10 : 10);
        const rot = -45 + (i % 2 ? -40 : 40);
        return <ellipse key={i} cx={x} cy={y} rx={22 - i} ry={8 - i * 0.4} transform={`rotate(${rot} ${x} ${y})`} opacity={0.55 + (i % 3) * 0.15} />;
      })}
    </svg>
  );
}
