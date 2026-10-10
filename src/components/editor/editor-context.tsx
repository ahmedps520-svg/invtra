"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { deepMerge, type DeepPartial, type InvitationDesign } from "@/lib/design/schema";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import type { CardContent } from "@/lib/card/build";
import { useI18n } from "@/components/i18n/provider";
import { useToast } from "@/components/ui/toast";
import type { DesignSaveResponse, Draft, EditorEvent, EditorGalleryImage, EditorProps, EditorThemeOption, EditorUpload, MediaKeyField } from "./types";

export type SaveStatus = "saved" | "pending" | "error";

const MEDIA_FIELDS: MediaKeyField[] = ["customImageKey", "coverImageKey", "logoKey", "musicKey"];
const AUTOSAVE_MS = 800;

interface EditorContextValue {
  event: EditorEvent;
  draft: Draft;
  content: CardContent;
  contentByDigits: EditorProps["contentByDigits"];
  themes: EditorThemeOption[];
  premiumIncluded: boolean;
  nav: EditorProps["nav"];
  detailsHref: string;
  /** Custom-event options (QR on/off and link, lines left off, extra lines). */
  advanced: boolean;
  /** Uploads by storage key (signed URL + dimensions). */
  uploads: Record<string, EditorUpload>;
  addUpload: (u: EditorUpload) => void;
  gallery: EditorGalleryImage[];
  setGallery: (fn: (g: EditorGalleryImage[]) => EditorGalleryImage[]) => void;
  /** Change the draft; it is autosaved after a short pause (or at once with `immediate`). */
  update: (recipe: (d: Draft) => Draft, opts?: { immediate?: boolean }) => void;
  setDesign: (patch: DeepPartial<InvitationDesign>) => void;
  /** Adopt a theme: palette, typefaces, motion and QR style reset to the theme's; everything else is kept. */
  applyTheme: (key: ThemeKey) => Promise<boolean>;
  /** Save now (waits for any save in flight). Resolves false if saving failed. */
  saveNow: () => Promise<boolean>;
  /** Point a media field at a new key (or null), save, then clean up the file it replaced. */
  setMedia: (field: MediaKeyField, key: string | null) => Promise<boolean>;
  /** Delete an upload that is no longer referenced (silently keeps files still in use). */
  discardUpload: (key: string | null | undefined) => Promise<void>;
  status: SaveStatus;
  saving: boolean;
  errorMessage: string | null;
  staleAccepted: number;
  setStaleAccepted: (n: number) => void;
  /** Bumped when server-side media changed, so the website preview reloads. */
  siteVersion: number;
  bumpSite: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside <EditorProvider>");
  return ctx;
}

export function withTheme(d: Draft, key: ThemeKey): Draft {
  const t = getTheme(key).defaults;
  return {
    ...d,
    themeKey: key,
    design: {
      ...d.design,
      palette: t.palette,
      fonts: t.fonts,
      animation: t.animation,
      card: { ...d.design.card, qr: { ...d.design.card.qr, style: t.card.qr.style } },
    },
  };
}

function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function saveBody(d: Draft, s: Draft): Record<string, unknown> | null {
  const body: Record<string, unknown> = {};
  if (d.themeKey !== s.themeKey) {
    body.themeKey = d.themeKey;
    body.resetStyle = true;
  }
  // Always send the full design with a theme change so the server ends up with exactly what we show.
  if (body.themeKey || !same(d.design, s.design)) body.design = d.design;
  if (d.imageMode !== s.imageMode) body.imageMode = d.imageMode;
  for (const f of MEDIA_FIELDS) if (d[f] !== s[f]) body[f] = d[f];
  return Object.keys(body).length ? body : null;
}

export function EditorProvider({ props, children }: { props: EditorProps; children: ReactNode }) {
  const { dict } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const eventId = props.event.id;

  const [draft, setDraft] = useState<Draft>(props.initial);
  const [saved, setSaved] = useState<Draft>(props.initial);
  const draftRef = useRef<Draft>(props.initial);
  const savedRef = useRef<Draft>(props.initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [staleAccepted, setStaleAccepted] = useState(props.staleAccepted);
  const [uploads, setUploads] = useState<Record<string, EditorUpload>>(() => Object.fromEntries(props.uploads.map((u) => [u.key, u])));
  const [gallery, setGalleryState] = useState<EditorGalleryImage[]>(props.gallery);
  const [siteVersion, setSiteVersion] = useState(0);
  const uploadsRef = useRef(uploads);
  const retryDelay = useRef(0);
  const failing = useRef(false);
  const saveNowRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  const errorText = dict.editor.save.error;
  const networkText = dict.common.errors.network;

  const doSave = useCallback(async (): Promise<boolean> => {
    const snapshot = draftRef.current;
    const before = savedRef.current;
    const body = saveBody(snapshot, before);
    if (!body) {
      setErrorMessage(null);
      return true;
    }
    setSaving(true);
    try {
      const res = await api<DesignSaveResponse>(`/api/events/${eventId}/design`, { method: "PATCH", body });
      savedRef.current = snapshot;
      setSaved(snapshot);
      setStaleAccepted(res.staleAccepted);
      setErrorMessage(null);
      retryDelay.current = 0;
      failing.current = false;
      // The guest page renders these on the server (media URLs, wording, numerals, QR art), so the
      // website preview reloads after they are saved; everything else updates live via postMessage.
      const a = snapshot.design;
      const b = before.design;
      const serverSide =
        MEDIA_FIELDS.some((f) => snapshot[f] !== before[f]) ||
        a.background.imageKey !== b.background.imageKey ||
        a.digits !== b.digits ||
        !same(a.texts, b.texts) ||
        a.card.qr.style !== b.card.qr.style ||
        a.card.qr.showLogo !== b.card.qr.showLogo;
      if (serverSide) setSiteVersion((v) => v + 1);
      return true;
    } catch (e) {
      const network = e instanceof ApiError && e.code === "network_error";
      const message = network ? networkText : errorText;
      // One toast per failure episode (the status pill keeps showing it until a save succeeds).
      if (!failing.current) toast(message, "error");
      failing.current = true;
      setErrorMessage(message);
      // Connection hiccups and server errors retry by themselves (4s, 8s … 60s); a rejected change waits for the next edit or Retry.
      const transient = !(e instanceof ApiError) || e.status === 0 || e.status === 429 || e.status >= 500;
      if (transient) {
        retryDelay.current = Math.min(60_000, retryDelay.current ? retryDelay.current * 2 : 4000);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void saveNowRef.current(), retryDelay.current);
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [eventId, errorText, networkText, toast]);

  const saveNow = useCallback((): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const run = queue.current.then(doSave);
    queue.current = run.catch(() => false);
    return run;
  }, [doSave]);
  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  const update = useCallback(
    (recipe: (d: Draft) => Draft, opts?: { immediate?: boolean }) => {
      const next = recipe(draftRef.current);
      if (next === draftRef.current) return;
      draftRef.current = next;
      setDraft(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (opts?.immediate) void saveNow();
      else timer.current = setTimeout(() => void saveNow(), AUTOSAVE_MS);
    },
    [saveNow],
  );

  const setDesign = useCallback(
    (patch: DeepPartial<InvitationDesign>) => update((d) => ({ ...d, design: deepMerge(d.design, patch) })),
    [update],
  );

  const applyTheme = useCallback(
    (key: ThemeKey) => {
      update((d) => withTheme(d, key));
      return saveNow();
    },
    [update, saveNow],
  );

  const addUpload = useCallback((u: EditorUpload) => {
    setUploads((m) => {
      const next = { ...m, [u.key]: u };
      uploadsRef.current = next;
      return next;
    });
  }, []);

  const discardUpload = useCallback(
    async (key: string | null | undefined) => {
      if (!key) return;
      const u = uploadsRef.current[key];
      if (!u) return;
      try {
        await api(`/api/events/${eventId}/uploads/${u.id}`, { method: "DELETE" });
        setUploads((m) => {
          const next = { ...m };
          delete next[key];
          uploadsRef.current = next;
          return next;
        });
      } catch {
        // 409 = still in use elsewhere (e.g. also the background) — keep it.
      }
    },
    [eventId],
  );

  const setMedia = useCallback(
    async (field: MediaKeyField, key: string | null) => {
      const previous = draftRef.current[field];
      if (previous === key) return true;
      update((d) => ({ ...d, [field]: key }));
      const ok = await saveNow();
      if (ok && previous) void discardUpload(previous);
      return ok;
    },
    [update, saveNow, discardUpload],
  );

  const setGallery = useCallback((fn: (g: EditorGalleryImage[]) => EditorGalleryImage[]) => setGalleryState(fn), []);
  const bumpSite = useCallback(() => setSiteVersion((v) => v + 1), []);

  // Leaving the page: warn while anything is unsaved; save-then-navigate for in-app links.
  useEffect(() => {
    const isDirty = () => Boolean(timer.current) || !same(draftRef.current, savedRef.current);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (!isDirty() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      e.preventDefault();
      e.stopPropagation();
      void saveNow().then((ok) => {
        if (ok || window.confirm(dict.editor.save.leaveConfirm)) router.push(url.pathname + url.search + url.hash);
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [saveNow, router, dict.editor.save.leaveConfirm]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const dirty = !same(draft, saved);
  const status: SaveStatus = errorMessage && !saving ? "error" : dirty || saving ? "pending" : "saved";

  const value = useMemo<EditorContextValue>(
    () => ({
      event: props.event,
      draft,
      content: props.contentByDigits[draft.design.digits],
      contentByDigits: props.contentByDigits,
      themes: props.themes,
      premiumIncluded: props.premiumIncluded,
      nav: props.nav,
      detailsHref: props.detailsHref ?? `/dashboard/events/${props.event.id}/details`,
      advanced: Boolean(props.advanced),
      uploads,
      addUpload,
      gallery,
      setGallery,
      update,
      setDesign,
      applyTheme,
      saveNow,
      setMedia,
      discardUpload,
      status,
      saving,
      errorMessage,
      staleAccepted,
      setStaleAccepted,
      siteVersion,
      bumpSite,
    }),
    [props, draft, uploads, addUpload, gallery, setGallery, update, setDesign, applyTheme, saveNow, setMedia, discardUpload, status, saving, errorMessage, staleAccepted, siteVersion, bumpSite],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
