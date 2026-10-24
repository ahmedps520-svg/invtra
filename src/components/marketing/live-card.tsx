"use client";

import { useMemo } from "react";
import { CardPreview } from "@/components/invitation/card-preview";
import type { EventType } from "@prisma/client";
import { sampleCardContent, themeSampleContent } from "@/lib/card/sample";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { withDigits } from "@/lib/marketing/demo-copy";

/**
 * The real card engine, loaded only once a visitor personalises a demo (it's the heaviest part of
 * the page). Until then the demos show the pre-rendered sample image of the same design.
 */
export function LiveCard({
  theme: themeKey,
  language,
  digits,
  guest,
  qrText,
  title,
  occasion,
}: {
  theme: ThemeKey;
  language: "EN" | "AR" | "BILINGUAL";
  digits: "arab" | "latn";
  guest: { name: string; allowedCount: number };
  qrText: string;
  title: string;
  /** Use this occasion's sample wording instead of the design's own. */
  occasion?: EventType | null;
}) {
  const { design, content } = useMemo(() => {
    const theme = getTheme(themeKey);
    const c = occasion ? sampleCardContent(occasion) : themeSampleContent(themeKey);
    return {
      design: { ...theme.defaults, digits },
      content: {
        ...c,
        date: { en: c.date.en, ar: withDigits(c.date.ar, digits) },
        time: { en: c.time.en, ar: withDigits(c.time.ar, digits) },
        venueNameAr: c.venueNameAr ? withDigits(c.venueNameAr, digits) : c.venueNameAr,
        addressAr: c.addressAr ? withDigits(c.addressAr, digits) : c.addressAr,
      },
    };
  }, [themeKey, digits, occasion]);
  return (
    <CardPreview
      themeKey={themeKey}
      design={design}
      language={language}
      content={content}
      guest={guest}
      qrText={qrText}
      qrPlaceholder={false}
      title={title}
      className="h-full w-full"
    />
  );
}
