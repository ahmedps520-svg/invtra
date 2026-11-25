"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildCardSvg, buildCustomCardSvg, effectiveQrText, type CardContent, type CardImage, type CardLanguage } from "@/lib/card/build";
import { buildCanvasSvg } from "@/lib/canvas/render";
import { isCanvasCard } from "@/lib/canvas/doc";
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
  canvasImages,
  className,
  title = "Invitation preview",
  lazy = false,
  thumb = false,
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
  /** Photos used by a Studio design, by storage key. */
  canvasImages?: Record<string, CardImage>;
  className?: string;
  title?: string;
  /**
   * Galleries: render a same-size placeholder until the card nears the viewport. Keeps
   * long pages light (each card is a full SVG with its own QR code) and fast to first paint.
   */
  lazy?: boolean;
  /** Small preview: artwork designs load their thumbnail instead of the full artwork. */
  thumb?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!lazy);
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const svg = useMemo(() => {
    if (!near) return null;
    const theme = getTheme(themeKey);
    const d = design ?? theme.defaults;
    if (customImage) {
      return buildCustomCardSvg({ image: customImage, design: d, qrText, qrPlaceholder, caption: language === "AR" ? "امسح الرمز لعرض دعوتك" : "Scan for your invitation" }).svg;
    }
    const g = guest === undefined ? (language === "AR" ? SAMPLE_GUEST.ar : SAMPLE_GUEST.en) : guest;
    const c = content ?? themeSampleContent(theme.key);
    if (isCanvasCard(d)) {
      return buildCanvasSvg(d.canvas, {
        content: c,
        guest: g,
        qrText: effectiveQrText(d, qrText, qrPlaceholder),
        digits: d.digits,
        language: language === "AR" ? "ar" : "en",
        images: canvasImages,
        thumbs: thumb,
      });
    }
    return buildCardSvg({ theme, design: d, language, content: c, guest: g, qrText, qrPlaceholder, backgroundImage, artThumb: thumb });
  }, [near, themeKey, design, language, content, guest, qrText, qrPlaceholder, backgroundImage, customImage, canvasImages, thumb]);

  if (svg === null) {
    return (
      <div
        ref={ref}
        role="img"
        aria-label={title}
        className={cn("overflow-hidden", className)}
        style={{ aspectRatio: "1080 / 1350", background: (design ?? getTheme(themeKey).defaults).palette.background }}
      />
    );
  }
  return (
    <div
      ref={ref}
      role="img"
      aria-label={title}
      className={cn("overflow-hidden [&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
