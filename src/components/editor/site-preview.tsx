"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/provider";
import type { InvitationDesign } from "@/lib/design/schema";
import { cn } from "@/lib/utils";
import type { ImageMode } from "./types";

const PHONE_W = 390;
const PHONE_H = 844;

/**
 * The guest website, live, inside a phone frame. The page at /preview/{eventId}
 * posts {type:"invtra:preview-ready"} when it has loaded; we answer (and on every
 * draft change, debounced) with {type:"invtra:preview", themeKey, design, imageMode}.
 */
export function SitePreview({
  eventId,
  themeKey,
  design,
  imageMode,
  themeParam,
  version = 0,
  maxHeight,
  className,
}: {
  eventId: string;
  themeKey: string;
  design: InvitationDesign;
  imageMode: ImageMode;
  /** Load the page with ?theme= (theme preview before committing). */
  themeParam?: string;
  /** Changing it reloads the page (e.g. after a new cover photo was saved). */
  version?: number;
  /** Cap on the rendered phone height in px (the width follows). */
  maxHeight?: number;
  className?: string;
}) {
  const { dict } = useI18n();
  const t = dict.editor.preview;
  const src = `/preview/${encodeURIComponent(eventId)}${themeParam ? `?theme=${encodeURIComponent(themeParam)}` : ""}`;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const payloadRef = useRef({ themeKey, design, imageMode });
  const [scale, setScale] = useState(0.8);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);

  const post = useCallback(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    try {
      w.postMessage({ type: "invtra:preview", ...payloadRef.current }, window.location.origin);
    } catch {
      // The frame may be navigating; the next ready message will resync it.
    }
  }, []);

  // Keep the latest draft for the ready handshake, and push changes (debounced).
  useEffect(() => {
    payloadRef.current = { themeKey, design, imageMode };
    const timer = setTimeout(post, 150);
    return () => clearTimeout(timer);
  }, [themeKey, design, imageMode, post]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === "invtra:preview-ready") {
        setLoaded(true);
        post();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  // The page is built separately; check it exists so a missing page shows a calm placeholder.
  useEffect(() => {
    let cancelled = false;
    fetch(src, { credentials: "same-origin", cache: "no-store" })
      .then((r) => !cancelled && setAvailable(r.ok))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, [src, attempt, version]);

  // Scale the 390×844 viewport to the space we have.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // ResizeObserver reports the initial size too.
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / PHONE_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameW = maxHeight ? Math.min(PHONE_W, Math.floor((maxHeight * PHONE_W) / PHONE_H)) : PHONE_W;

  return (
    <div className={cn("mx-auto w-full", className)} style={{ maxWidth: frameW + 20 }}>
      <div className="rounded-[2.75rem] bg-ink p-2.5 shadow-lift ring-1 ring-black/5">
        <div
          ref={boxRef}
          role="region"
          aria-label={t.phoneLabel}
          className="relative overflow-hidden rounded-[2.2rem] bg-ivory"
          style={{ height: Math.round(PHONE_H * scale) }}
        >
          {available === false ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full border border-line bg-paper text-bronze-600">
                <Globe className="size-5" />
              </span>
              <p className="mt-5 font-display text-xl leading-snug text-ink">{t.siteUnavailableTitle}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">{t.siteUnavailableBody}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                icon={<RotateCcw className="size-3.5" />}
                onClick={() => {
                  setAvailable(null);
                  setLoaded(false);
                  setAttempt((a) => a + 1);
                }}
              >
                {t.tryAgain}
              </Button>
            </div>
          ) : (
            <>
              <iframe
                key={`${src}#${version}#${attempt}`}
                ref={iframeRef}
                src={src}
                title={t.phoneLabel}
                onLoad={() => {
                  setLoaded(true);
                  post();
                }}
                className="absolute top-0 border-0 bg-ivory"
                style={{ width: PHONE_W, height: PHONE_H, left: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}
              />
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ivory transition-opacity duration-500",
                  loaded ? "opacity-0" : "opacity-100",
                )}
              >
                <div className="skeleton h-40 w-3/4 rounded-2xl" />
                <div className="skeleton h-3 w-1/2 rounded-full" />
                <div className="skeleton h-3 w-1/3 rounded-full" />
                <p className="mt-3 text-[12px] text-ink-faint">{t.siteLoading}</p>
              </div>
            </>
          )}
          <span aria-hidden="true" className="pointer-events-none absolute start-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink rtl:translate-x-1/2" />
        </div>
      </div>
    </div>
  );
}
