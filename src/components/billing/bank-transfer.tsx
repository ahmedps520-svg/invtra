"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bank transfer details with copy buttons, and the WhatsApp button to send the receipt. */
export function BankTransfer({
  title,
  intro,
  rows,
  copyLabel,
  copiedLabel,
  receipt,
  rtl,
}: {
  title: string;
  intro: string;
  rows: { label: string; value: string; copy?: string; ltr?: boolean }[];
  copyLabel: string;
  copiedLabel: string;
  receipt: { href: string; label: string };
  rtl: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    } catch {
      window.prompt(label, value);
    }
  }
  return (
    <div className="rounded-2xl border border-line bg-ivory/70 p-5 sm:p-6">
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{intro}</p>
      <dl className="mt-5 divide-y divide-line rounded-xl border border-line bg-paper">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <dt className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink-faint rtl:tracking-normal">{r.label}</dt>
              <dd
                className={cn("mt-0.5 text-[15px] font-medium text-ink [overflow-wrap:anywhere]", r.ltr && "tabular-nums", r.ltr && rtl && "text-right")}
                dir={r.ltr ? "ltr" : "auto"}
              >
                {r.value}
              </dd>
            </div>
            {r.copy ? (
              <button
                type="button"
                onClick={() => copy(r.label, r.copy!)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-medium text-ink-soft transition hover:border-line-strong hover:text-ink"
              >
                {copied === r.label ? <Check className="size-3.5 text-sage" /> : <Copy className="size-3.5" />}
                {copied === r.label ? copiedLabel : copyLabel}
              </button>
            ) : null}
          </div>
        ))}
      </dl>
      <a
        href={receipt.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-[15px] font-medium text-white shadow-soft transition hover:brightness-95"
      >
        <MessageCircle className="size-4" />
        {receipt.label}
      </a>
    </div>
  );
}
