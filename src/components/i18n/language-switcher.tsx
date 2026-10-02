"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/** EN | العربية toggle. Persists the choice in a cookie (and on the account when signed in). */
export function LanguageSwitcher({ locale, className, compact }: { locale: Locale; className?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch("/api/locale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: next }),
          });
          router.refresh();
        })
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-sand hover:text-ink disabled:opacity-60",
        className,
      )}
      aria-label={next === "ar" ? "التبديل إلى العربية" : "Switch to English"}
      lang={next}
    >
      <Globe className="size-3.5" />
      {compact ? (next === "ar" ? "ع" : "EN") : next === "ar" ? "العربية" : "English"}
    </button>
  );
}
