"use client";

import { useEffect, useMemo, useState } from "react";
import { CardPreview } from "@/components/invitation/card-preview";
import { cn } from "@/lib/utils";
import type { InvitationDesign } from "@/lib/design/schema";
import { useEditor } from "./editor-context";
import { useCardProps } from "./use-card-props";
import type { Draft } from "./types";

type Override = { themeKey?: Draft["themeKey"]; design?: InvitationDesign; imageMode?: Draft["imageMode"] };

/**
 * The card in the editor. Once the event is paid for it's drawn live in the browser; before that
 * the server renders each change as a low-resolution watermarked preview (the browser never gets
 * the full-quality card).
 */
export function EditorCard({ override, className, title, fit }: { override?: Override; className?: string; title: string; fit?: "cover" }) {
  const { event } = useEditor();
  const props = useCardProps(override);
  if (!event.protectedPreview) return <CardPreview {...props} className={className} title={title} />;
  return <ProtectedDraftCard override={override} className={className} title={title} fit={fit} />;
}

function ProtectedDraftCard({ override, className, title, fit }: { override?: Override; className?: string; title: string; fit?: "cover" }) {
  const { event, draft, uploads } = useEditor();
  const themeKey = override?.themeKey ?? draft.themeKey;
  const design = override?.design ?? draft.design;
  const imageMode = override?.imageMode ?? draft.imageMode;
  const customImageKey = imageMode === "CUSTOM" ? draft.customImageKey : null;
  const body = useMemo(() => JSON.stringify({ themeKey, design, imageMode, customImageKey }), [themeKey, design, imageMode, customImageKey]);
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/events/${event.id}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const url = URL.createObjectURL(await res.blob());
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        /* superseded by a newer change, or offline: keep the last preview */
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [body, event.id]);

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const custom = customImageKey ? uploads[customImageKey] : null;
  const ratio = custom?.width && custom.height ? `${custom.width} / ${custom.height}` : "1080 / 1350";
  return (
    <div
      role="img"
      aria-label={title}
      aria-busy={busy}
      className={cn("relative overflow-hidden bg-sand", className)}
      style={fit ? undefined : { aspectRatio: ratio }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private preview rendered for this draft
        <img
          src={src}
          alt=""
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className={cn("block h-full w-full select-none", fit ? "object-cover" : "object-contain", busy && "opacity-70 transition-opacity")}
        />
      ) : null}
      {busy ? <span className="absolute end-2 top-2 size-2 animate-pulse rounded-full bg-bronze-500" aria-hidden /> : null}
    </div>
  );
}
