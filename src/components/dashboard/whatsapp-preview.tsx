"use client";

import { BadgeCheck, ExternalLink, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tasteful WhatsApp-style chat used for message previews and the dev simulator.
 * "in" = received by the guest (from INVTRA), "out" = sent by the guest.
 */
export function ChatFrame({
  title,
  subtitle,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[1.75rem] border border-line bg-paper shadow-lift", className)}>
      <div className="flex items-center gap-3 bg-[#1f2c27] px-4 py-3 text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f3ede4] font-display text-[15px] text-bronze-700" dir="ltr">
          i
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-medium">
            {title}
            <BadgeCheck className="size-3.5 shrink-0 text-[#25d366]" />
          </p>
          {subtitle ? <p className="truncate text-[11px] text-white/60">{subtitle}</p> : null}
        </div>
      </div>
      <div
        className={cn("space-y-2.5 px-3 py-4 sm:px-4", bodyClassName)}
        style={{
          backgroundColor: "#efeae2",
          backgroundImage: "radial-gradient(rgb(132 102 74 / 0.07) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export type BubbleButton = { text: string; url?: string | null; onClick?: () => void; disabled?: boolean };

export function Bubble({
  side = "in",
  header,
  body,
  footer,
  time,
  status,
  buttons,
  className,
  error,
}: {
  side?: "in" | "out";
  header?: React.ReactNode;
  body?: React.ReactNode;
  footer?: string | null;
  time?: string;
  status?: React.ReactNode;
  buttons?: BubbleButton[];
  className?: string;
  error?: React.ReactNode;
}) {
  const incoming = side === "in";
  return (
    <div className={cn("flex", incoming ? "justify-start" : "justify-end")}>
      <div className={cn("w-fit max-w-[88%] sm:max-w-[80%]", className)}>
        <div
          className={cn(
            "overflow-hidden rounded-xl text-[14px] leading-[1.45] text-[#111b21] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]",
            incoming ? "rounded-ss-sm bg-white" : "rounded-se-sm bg-[#d9fdd3]",
          )}
        >
          {header ? <div className="p-1 pb-0">{header}</div> : null}
          <div className="px-2.5 pb-1.5 pt-1.5">
            {body ? <MessageText text={body} /> : null}
            {footer ? (
              <p dir="auto" className="mt-1 text-[12.5px] text-[#667781]">
                {footer}
              </p>
            ) : null}
            {time || status ? (
              <div className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                {time ? <span dir="ltr">{time}</span> : null}
                {status}
              </div>
            ) : null}
          </div>
          {buttons?.length ? (
            <div className="border-t border-[#e9edef]">
              {buttons.map((b, i) => {
                const inner = (
                  <>
                    {b.url ? <ExternalLink className="size-3.5" /> : <Reply className="size-3.5 rtl:-scale-x-100" />}
                    <span dir="auto">{b.text}</span>
                  </>
                );
                const cls = cn(
                  "flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-[14px] font-medium text-[#027eb5] transition",
                  i > 0 && "border-t border-[#e9edef]",
                  (b.onClick || b.url) && !b.disabled ? "hover:bg-[#f5f6f6]" : "cursor-default",
                  b.disabled && "opacity-50",
                );
                if (b.url)
                  return (
                    <a key={i} href={b.url} target="_blank" rel="noreferrer" className={cls}>
                      {inner}
                    </a>
                  );
                return (
                  <button key={i} type="button" className={cls} onClick={b.onClick} disabled={b.disabled || !b.onClick} tabIndex={b.onClick ? 0 : -1}>
                    {inner}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {error ? <div className="mt-1 px-1 text-[12px] text-rosewood">{error}</div> : null}
      </div>
    </div>
  );
}

/** Message text with per-line direction, so bilingual Arabic + English messages read naturally. */
export function MessageText({ text, className }: { text: React.ReactNode; className?: string }) {
  if (typeof text !== "string") return <div className={cn("break-words", className)}>{text}</div>;
  return (
    <div className={cn("break-words", className)}>
      {text.split("\n").map((line, i) =>
        line.trim() ? (
          <p key={i} dir="auto" className="text-start">
            {line}
          </p>
        ) : (
          <div key={i} className="h-[0.7em]" aria-hidden />
        ),
      )}
    </div>
  );
}

/** Small centred system note ("Today"). */
export function ChatNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11.5px] text-[#54656f] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">{children}</span>
    </div>
  );
}
