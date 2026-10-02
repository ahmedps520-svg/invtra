import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { EYEBROW } from "./styles";

/** Eyebrow + display heading + lead paragraph used at the top of every marketing section. */
export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
  as: Tag = "h2",
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  align?: "center" | "start";
  as?: "h1" | "h2";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Reveal className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl text-start", className)}>
      {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
      <Tag
        className={cn(
          "font-display text-[2.5rem] font-normal leading-[1.08] text-balance text-ink sm:text-5xl",
          Tag === "h1" && "sm:text-6xl",
          eyebrow ? "mt-4" : null,
        )}
      >
        {title}
      </Tag>
      {body ? <p className="mt-5 text-[17px] leading-relaxed text-pretty text-ink-soft">{body}</p> : null}
      {children}
    </Reveal>
  );
}
