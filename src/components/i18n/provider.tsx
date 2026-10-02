"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n";
import { dirOf, type Locale } from "@/lib/i18n/config";

type Ctx = { locale: Locale; dir: "ltr" | "rtl"; dict: Partial<Dictionary> };

const I18nContext = createContext<Ctx | null>(null);

/**
 * Supplies dictionary namespaces to client components. Providers nest: an inner
 * provider adds namespaces on top of the outer one.
 */
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Partial<Dictionary>; children: ReactNode }) {
  const parent = useContext(I18nContext);
  const value = useMemo<Ctx>(
    () => ({ locale, dir: dirOf(locale), dict: { ...(parent?.locale === locale ? parent.dict : {}), ...dict } }),
    [locale, dict, parent],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the dictionary. Namespaces must have been provided by an enclosing layout. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx as { locale: Locale; dir: "ltr" | "rtl"; dict: Dictionary };
}
