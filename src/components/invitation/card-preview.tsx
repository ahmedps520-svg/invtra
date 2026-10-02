"use client";

import { useMemo } from "react";
import { buildCardSvg, buildCustomCardSvg, type CardContent, type CardImage, type CardLanguage } from "@/lib/card/build";
import type { InvitationDesign } from "@/lib/design/schema";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { SAMPLE_GUEST, themeSampleContent } from "@/lib/card/sample";
import { cn } from "@/lib/utils";

/**
 * Live invitation-card preview. Renders exactly the SVG the server rasterises for
 * WhatsApp (same builder, same fonts, same layout metrics).
 */
export function CardPreview({
  themeKey,
  design,
  language = "EN",
  content,
  guest,
  qrText,
  qrPlaceholder = true,
  backgroundImage,
  customImage,
  className,
  title = "Invitation preview",
}: {
  themeKey: ThemeKey | string;
  design?: InvitationDesign;
  language?: CardLanguage;
  content?: CardContent;
  guest?: { name: string; allowedCount: number } | null;
  qrText?: string | null;
  qrPlaceholder?: boolean;
  backgroundImage?: CardImage | null;
  /** When set, renders the customer's own uploaded invitation with the QR overlaid. */
  customImage?: CardImage | null;
  className?: string;
  title?: string;
}) {
  const svg = useMemo(() => {
    const theme = getTheme(themeKey);
    const d = design ?? theme.defaults;
    if (customImage) {
      return buildCustomCardSvg({ image: customImage, design: d, qrText, qrPlaceholder, caption: language === "AR" ? "امسح الرمز لعرض دعوتك" : "Scan for your invitation" }).svg;
    }
    const g = guest === undefined ? (language === "AR" ? SAMPLE_GUEST.ar : SAMPLE_GUEST.en) : guest;
    return buildCardSvg({ theme, design: d, language, content: content ?? themeSampleContent(theme.key), guest: g, qrText, qrPlaceholder, backgroundImage });
  }, [themeKey, design, language, content, guest, qrText, qrPlaceholder, backgroundImage, customImage]);

  return (
    <div
      role="img"
      aria-label={title}
      className={cn("overflow-hidden [&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
