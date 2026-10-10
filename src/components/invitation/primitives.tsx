"use client";

import { createContext, useContext, type CSSProperties, type ElementType, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { star } from "@/lib/card/ornaments";
import { displayWeight, fontStack } from "@/lib/design/fonts";
import { getTheme } from "@/lib/themes/registry";
import { luminance } from "@/lib/qr";
import { cn } from "@/lib/utils";
import type { InvitationDesign } from "@/lib/design/schema";
import type { InvitationDict, InvitationVM, PageLang } from "./types";
import s from "./invitation.module.css";

type Ctx = { vm: InvitationVM; lang: PageLang; d: InvitationDict; animation: InvitationDesign["animation"] };

const InvitationContext = createContext<Ctx | null>(null);

export function InvitationProvider({ vm, children }: { vm: InvitationVM; children: ReactNode }) {
  const reduced = useReducedMotion();
  const value: Ctx = {
    vm,
    lang: vm.lang,
    d: vm.lang === "ar" ? vm.dict.ar : vm.dict.en,
    animation: reduced ? "none" : vm.design.animation,
  };
  return <InvitationContext.Provider value={value}>{children}</InvitationContext.Provider>;
}

export function useInvitation() {
  const ctx = useContext(InvitationContext);
  if (!ctx) throw new Error("useInvitation outside provider");
  return ctx;
}

/** CSS variables that theme the whole page. */
export function themeVars(design: InvitationDesign): CSSProperties {
  const p = design.palette;
  const display = `${fontStack(design.fonts.display)}`.replace(/, (serif|sans-serif)$/, "") + `, ${fontStack(design.fonts.arabicDisplay)}`;
  const body = `${fontStack(design.fonts.body)}`.replace(/, (serif|sans-serif)$/, "") + `, ${fontStack(design.fonts.arabicBody)}`;
  const names =
    `${fontStack(design.names?.font ?? design.fonts.display)}`.replace(/, (serif|sans-serif)$/, "") +
    `, ${fontStack(design.names?.fontAr ?? design.fonts.arabicDisplay)}`;
  return {
    "--inv-bg": p.background,
    "--inv-surface": p.surface,
    "--inv-text": p.text,
    "--inv-muted": p.muted,
    "--inv-accent": p.accent,
    "--inv-on-accent": luminance(p.accent) > 0.45 ? "#15120f" : "#ffffff",
    "--inv-display": display,
    "--inv-body": body,
    "--inv-display-weight": design.fonts.display === "jost" ? 300 : design.fonts.display === "pinyon" ? 400 : design.fonts.display === "quicksand" ? 600 : 500,
    // The names' own typeface and colour (or the display typeface and text colour).
    "--inv-names": names,
    "--inv-names-weight": displayWeight(design.names?.font ?? design.fonts.display),
    "--inv-names-color": design.names?.color ?? p.text,
  } as CSSProperties;
}

/** Text in the page language; bilingual pages show Arabic then English. */
export function Txt({
  en,
  ar,
  as: Tag = "span",
  className,
  inline,
  arClassName,
  enClassName,
}: {
  en: string | null | undefined;
  ar?: string | null;
  as?: ElementType;
  className?: string;
  /** Bilingual short labels on one line: "التاريخ · Date". */
  inline?: boolean;
  arClassName?: string;
  enClassName?: string;
}) {
  const { lang } = useInvitation();
  const enText = en ?? "";
  const arText = ar || "";
  if (lang === "en" || (!arText && lang === "bilingual")) return <Tag className={className}>{enText}</Tag>;
  if (lang === "ar") {
    return (
      <Tag className={className} lang="ar" dir="rtl">
        {arText || enText}
      </Tag>
    );
  }
  if (inline) {
    return (
      <Tag className={className}>
        <span lang="ar" dir="rtl">
          {arText}
        </span>
        <span aria-hidden="true" className="mx-2 opacity-50">
          ·
        </span>
        <span lang="en">{enText}</span>
      </Tag>
    );
  }
  return (
    <Tag className={cn(className, "flex flex-col gap-1")}>
      <span lang="ar" dir="rtl" className={arClassName}>
        {arText}
      </span>
      <span lang="en" className={cn("opacity-80", enClassName)}>
        {enText}
      </span>
    </Tag>
  );
}

/** Dictionary label in the page language(s). */
export function Label({ pick, className, inline = true }: { pick: (d: InvitationDict) => string; className?: string; inline?: boolean }) {
  const { vm } = useInvitation();
  return <Txt en={pick(vm.dict.en)} ar={pick(vm.dict.ar)} className={className} inline={inline} />;
}

/** Scroll-triggered reveal following the design's animation setting. */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" }) {
  const { animation } = useInvitation();
  if (animation === "none") {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const elegant = animation === "elegant";
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp
      className={className}
      data-reveal=""
      initial={{ opacity: 0, y: elegant ? 22 : 12, filter: elegant ? "blur(6px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: elegant ? 1.1 : 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}

export function Divider({ className }: { className?: string }) {
  const { vm } = useInvitation();
  const kind = getTheme(vm.themeKey).page.divider;
  return (
    <div className={cn("flex items-center justify-center", s.accent, className)} aria-hidden="true">
      <svg width="180" height="24" viewBox="-90 -12 180 24" fill="currentColor">
        {kind === "line" ? (
          <>
            <path d="M-70 0H-14M14 0H70" stroke="currentColor" strokeWidth="1" />
            <path d="M0 -5L5 0L0 5L-5 0Z" />
          </>
        ) : kind === "diamond" ? (
          <>
            <path d="M-86 0H-22M22 0H86" stroke="currentColor" strokeWidth="1" />
            <path d="M0 -8L8 0L0 8L-8 0Z" />
            <path d="M-15 -3.5L-11.5 0L-15 3.5L-18.5 0Z" />
            <path d="M15 -3.5L18.5 0L15 3.5L11.5 0Z" />
          </>
        ) : kind === "floral" ? (
          <>
            <path d="M-6 0Q-40 -10 -84 -2" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <path d="M6 0Q40 -10 84 -2" stroke="currentColor" strokeWidth="1.3" fill="none" />
            {[-70, -52, -34, 34, 52, 70].map((x, i) => (
              <ellipse key={x} cx={x} cy={i % 2 ? -9 : 1} rx="7" ry="2.6" transform={`rotate(${x < 0 ? -30 : 30} ${x} ${i % 2 ? -9 : 1})`} opacity="0.8" />
            ))}
            <circle r="3.5" />
          </>
        ) : kind === "star" ? (
          <>
            <path d="M-90 0H-22M22 0H90" stroke="currentColor" strokeWidth="1" />
            <path d={star(0, 0, 11)} />
            <circle cx="-32" r="2" />
            <circle cx="32" r="2" />
          </>
        ) : kind === "moon" ? (
          <>
            <path d="M-90 0H-26M26 0H90" stroke="currentColor" strokeWidth="1" />
            <path d="M7.5 -8.66A10 10 0 1 0 7.5 8.66A10 10 0 0 1 7.5 -8.66Z" />
            <path d={star(-38, 0, 5, 4, 0.35)} />
            <path d={star(38, 0, 5, 4, 0.35)} />
          </>
        ) : kind === "heart" ? (
          <>
            <path d="M-90 0H-24M24 0H90" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
            <path d="M0 9C-3 6 -11 1 -11 -4.5C-11 -8.5 -8 -11 -4.8 -11C-2.6 -11 -1 -9.8 0 -8.2C1 -9.8 2.6 -11 4.8 -11C8 -11 11 -8.5 11 -4.5C11 1 3 6 0 9Z" />
            <circle cx="-16" r="2" opacity="0.6" />
            <circle cx="16" r="2" opacity="0.6" />
          </>
        ) : (
          <>
            <rect x="-30" y="-4" width="8" height="8" />
            <rect x="-14" y="-4" width="8" height="8" opacity="0.6" />
            <rect x="2" y="-4" width="8" height="8" />
            <rect x="18" y="-4" width="8" height="8" opacity="0.35" />
          </>
        )}
      </svg>
    </div>
  );
}


export function SectionHeading({ label, title }: { label: (d: InvitationDict) => string; title?: { en: string; ar?: string | null } }) {
  return (
    <div className="mb-8 text-center">
      <Label pick={label} className={cn(s.eyebrow, "block")} />
      {title ? <Txt en={title.en} ar={title.ar} as="h2" className={cn(s.display, "mt-3 text-3xl sm:text-4xl")} /> : null}
    </div>
  );
}

/** Digits in the design's numeral style for Arabic pages. */
export function useNumber() {
  const { vm } = useInvitation();
  return (n: number, pad = 0) => {
    const str = String(n).padStart(pad, "0");
    if (vm.lang !== "en" && vm.design.digits === "arab") return str.replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[Number(c)]);
    return str;
  };
}

export function pickLang<T>(lang: PageLang, en: T, ar: T): T {
  return lang === "ar" ? ar : en;
}
