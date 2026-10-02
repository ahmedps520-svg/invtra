import { ARABIC_PATH, ARABIC_VIEWBOX, MARK_PATH, MARK_VIEWBOX, WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/brand/logo-paths";
import { cn } from "@/lib/utils";

/** The INVTRA mark: calligraphic "i" + QR modules inside a scan frame. */
export function LogoMark({ className, title = "INVTRA" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn("h-8 w-auto text-bronze-600", className)} role="img" aria-label={title}>
      <path fill="currentColor" fillRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={cn("h-4 w-auto text-bronze-600", className)} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={WORDMARK_PATH} />
    </svg>
  );
}

export function LogoArabic({ className }: { className?: string }) {
  return (
    <svg viewBox={ARABIC_VIEWBOX} className={cn("h-4 w-auto text-bronze-600", className)} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={ARABIC_PATH} />
    </svg>
  );
}

/** Horizontal lock-up for navigation bars. */
export function Logo({ className, markClassName, showWordmark = true }: { className?: string; markClassName?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-bronze-600", className)} dir="ltr">
      <LogoMark className={cn("h-9", markClassName)} />
      {showWordmark ? <LogoWordmark className="h-[15px]" /> : null}
      <span className="sr-only">INVTRA</span>
    </span>
  );
}
