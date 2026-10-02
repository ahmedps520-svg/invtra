"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { CardImage } from "@/lib/card/build";
import type { InvitationDesign } from "@/lib/design/schema";
import { useEditor } from "./editor-context";
import type { Draft, EditorUpload } from "./types";

/** Same sample guest the server uses for "Download preview", so both match exactly. */
const SAMPLE_GUEST_EN = { name: "Sample Guest", allowedCount: 2 };
const SAMPLE_GUEST_AR = { name: "ضيف تجريبي", allowedCount: 2 };

export function cardImageOf(u: EditorUpload | undefined | null): CardImage | null {
  if (!u?.url) return null;
  return { href: u.url, width: u.width ?? 1080, height: u.height ?? 1350 };
}

/** Props for <CardPreview> drawn from a draft (defaults to the live draft). */
export function useCardProps(override?: { themeKey?: Draft["themeKey"]; design?: InvitationDesign; imageMode?: Draft["imageMode"] }) {
  const { draft, event, content, uploads } = useEditor();
  const themeKey = override?.themeKey ?? draft.themeKey;
  const design = override?.design ?? draft.design;
  const imageMode = override?.imageMode ?? draft.imageMode;

  const bgUpload = design.background.mode === "image" && design.background.imageKey ? uploads[design.background.imageKey] : null;
  const customUpload = imageMode === "CUSTOM" && draft.customImageKey ? uploads[draft.customImageKey] : null;
  const bgUrl = bgUpload?.url ?? null;
  const bgW = bgUpload?.width ?? 1080;
  const bgH = bgUpload?.height ?? 1350;
  const customUrl = customUpload?.url ?? null;
  const customW = customUpload?.width ?? 1080;
  const customH = customUpload?.height ?? 1350;

  const backgroundImage = useMemo<CardImage | null>(() => (bgUrl ? { href: bgUrl, width: bgW, height: bgH } : null), [bgUrl, bgW, bgH]);
  const customImage = useMemo<CardImage | null>(
    () => (customUrl ? { href: customUrl, width: customW, height: customH } : null),
    [customUrl, customW, customH],
  );

  return {
    themeKey,
    design,
    language: event.language,
    content,
    guest: event.language === "AR" ? SAMPLE_GUEST_AR : SAMPLE_GUEST_EN,
    qrPlaceholder: true,
    backgroundImage,
    customImage,
  };
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards — for client-only heavy rendering. */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Media query as state (server snapshot: `fallback`). */
export function useMediaQuery(query: string, fallback = true) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
