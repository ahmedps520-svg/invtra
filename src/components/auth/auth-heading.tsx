import type { ReactNode } from "react";

/** Heading block shared by every auth page. */
export function AuthHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[2.6rem] leading-[1.05] text-ink sm:text-5xl">{title}</h1>
      {subtitle ? <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">{subtitle}</p> : null}
    </div>
  );
}
