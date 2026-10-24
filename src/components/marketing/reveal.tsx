import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades content up as it scrolls into view.
 *
 * Pure CSS (a scroll-driven animation, see `.ivx-reveal` in marketing.css), so it costs no
 * JavaScript and nothing to hydrate. Browsers without scroll-driven animations, and visitors who
 * prefer reduced motion, simply see the content in place.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger in milliseconds, turned into a little extra scroll before this one starts. */
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={delay ? ({ ...style, "--ivx-stagger": `${Math.round(delay * 0.4)}px` } as CSSProperties) : style}
      className={cn("ivx-reveal", className)}
    >
      {children}
    </div>
  );
}
