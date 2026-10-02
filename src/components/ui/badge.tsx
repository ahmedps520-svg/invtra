import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "sage" | "rosewood" | "ochre" | "slate" | "bronze";

const tones: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft border-line",
  sage: "bg-sage-soft text-sage border-sage/20",
  rosewood: "bg-rosewood-soft text-rosewood border-rosewood/20",
  ochre: "bg-ochre-soft text-ochre border-ochre/20",
  slate: "bg-slate-soft text-slate border-slate/20",
  bronze: "bg-bronze-50 text-bronze-700 border-bronze-200",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Visual tone per guest status, shared by dashboard and admin. */
export const GUEST_STATUS_TONE: Record<string, Tone> = {
  PENDING: "neutral",
  MESSAGE_SENT: "slate",
  ACCEPTED: "sage",
  DECLINED: "rosewood",
  INVITATION_SENT: "sage",
  VIEWED: "bronze",
  QR_SCANNED: "bronze",
  FAILED: "rosewood",
};
