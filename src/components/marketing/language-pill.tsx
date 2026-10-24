"use client";

import { useTransition } from "react";
import type { Locale } from "@/lib/i18n/config";
import { isLocalizedPath, localePath, splitLocale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/** The section the visitor is reading, so the other language opens at the same place. */
function currentSection(): string | null {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("main section[id], main [data-section][id]"));
  let found: string | null = null;
  for (const s of sections) {
    if (s.getBoundingClientRect().top <= window.innerHeight * 0.35) found = s.id;
    else break;
  }
  return found && found !== "top" ? found : null;
}

/** EN | ع segmented switch. Keeps the visitor's place: the other language opens at the same section. */
export function LanguagePill({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const [pending, start] = useTransition();

  const go = (next: Locale) => {
    if (next === locale || pending) return;
    start(async () => {
      await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: next }) });
      const { path } = splitLocale(window.location.pathname);
      const target = isLocalizedPath(path) ? localePath(next, path) : window.location.pathname;
      const section = currentSection();
      window.location.assign(target + window.location.search + (section ? `#${section}` : window.location.hash));
    });
  };

  return (
    <div
      role="group"
      aria-label={label}
      dir="ltr"
      className={cn("inline-flex h-10 items-center rounded-full border border-hairline bg-cream/70 p-1 text-[13px]", pending && "opacity-60", className)}
    >
      {(["en", "ar"] as Locale[]).map((l) => {
        const on = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={on}
            aria-label={l === "ar" ? "العربية" : "English"}
            onClick={() => go(l)}
            className={cn(
              "flex h-8 min-w-11 items-center justify-center rounded-full px-3 font-medium transition-colors duration-300",
              on ? "bg-ink text-cream" : "text-ink-soft hover:text-ink",
              l === "ar" && "font-arabic text-[15px] leading-none",
            )}
          >
            {l === "ar" ? "ع" : "EN"}
          </button>
        );
      })}
    </div>
  );
}
