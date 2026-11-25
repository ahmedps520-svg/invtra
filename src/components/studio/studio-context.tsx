"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { CardImage } from "@/lib/card/build";
import { SAMPLE_GUEST } from "@/lib/card/sample";
import { initialState, studioReducer, type StudioAction, type StudioState } from "@/lib/canvas/history";
import { addElements, fitElement, patchElements, removeElements, updateElements } from "@/lib/canvas/ops";
import type { CanvasRenderContext } from "@/lib/canvas/render";
import type { CanvasDoc, CanvasElement } from "@/lib/canvas/schema";
import type { Point } from "@/lib/canvas/geometry";
import { useToast } from "@/components/ui/toast";
import { useMediaQuery } from "@/components/editor/use-card-props";
import type { PanelKey, SaveStatus, StudioProps, StudioUpload, View, ViewMode } from "./types";

type Tone = "success" | "error" | "info";

interface StudioContextValue extends StudioProps {
  state: StudioState;
  doc: CanvasDoc;
  selection: string[];
  selected: CanvasElement[];
  dispatch: (a: StudioAction) => void;
  /** Rendering for the editor (sample guest, sample QR, guest-only text and empty photo frames shown). */
  ctx: CanvasRenderContext;
  /** Rendering for the previews: a guest's card, or the shared image. */
  previewCtx: (mode: ViewMode) => CanvasRenderContext;
  /** The latest state, view and rendering context, for event handlers. */
  latestRef: { readonly current: { state: StudioState; ctx: CanvasRenderContext; view: View } };
  /** A change from the current document; `key` merges quick repeats (typing, sliders) into one undo step. */
  apply: (fn: (doc: CanvasDoc, selection: string[]) => { doc: CanvasDoc; selection?: string[] } | CanvasDoc, key?: string) => void;
  update: (ids: readonly string[], fn: (el: CanvasElement) => CanvasElement, key?: string) => void;
  patch: (ids: readonly string[], patch: Record<string, unknown>, key?: string) => void;
  add: (els: CanvasElement[], opts?: { select?: boolean; index?: number }) => void;
  remove: (ids: readonly string[]) => void;
  select: (ids: string[]) => void;
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  /** Card coordinates of the middle of what's on screen (where new things are placed). */
  visibleCenter: () => Point;
  stageRef: { current: HTMLDivElement | null };
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  panel: PanelKey | null;
  setPanel: (p: PanelKey | null) => void;
  editingText: string | null;
  setEditingText: (id: string | null) => void;
  uploads: StudioUpload[];
  images: Record<string, CardImage>;
  upload: (file: File) => Promise<StudioUpload | null>;
  deleteUpload: (u: StudioUpload) => Promise<void>;
  saveStatus: SaveStatus;
  saveNow: () => Promise<boolean>;
  /** The properties sheet on small screens. */
  inspectorOpen: boolean;
  setInspectorOpen: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  toast: (message: string, tone?: Tone) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const v = useContext(StudioContext);
  if (!v) throw new Error("useStudio outside <StudioProvider>");
  return v;
}

const AUTOSAVE_MS = 900;

export function StudioProvider({ props, initialDoc, children }: { props: StudioProps; initialDoc: CanvasDoc; children: ReactNode }) {
  const toastFn = useToast();
  const toast = useCallback((message: string, tone: Tone = "info") => toastFn(message, tone), [toastFn]);
  const [state, dispatch] = useReducer(studioReducer, initialDoc, initialState);

  const [uploads, setUploads] = useState<StudioUpload[]>(props.uploads);
  const images = useMemo(() => {
    const out: Record<string, CardImage> = {};
    for (const u of uploads) if (u.url) out[u.key] = { href: u.url, width: u.width ?? 1080, height: u.height ?? 1350 };
    return out;
  }, [uploads]);

  const lang = props.event.language === "AR" ? "ar" : "en";
  const ctx = useMemo<CanvasRenderContext>(
    () => ({
      content: props.content,
      guest: lang === "ar" ? SAMPLE_GUEST.ar : SAMPLE_GUEST.en,
      qrText: null,
      qrPlaceholder: true,
      digits: props.design.digits,
      language: lang,
      images,
      editor: true,
    }),
    [props.content, props.design.digits, lang, images],
  );
  const qrOn = props.event.qrOn;
  const previewCtx = useCallback(
    (m: ViewMode): CanvasRenderContext => ({ ...ctx, editor: false, guest: m === "teaser" ? null : ctx.guest, qrPlaceholder: m !== "teaser" && qrOn }),
    [ctx, qrOn],
  );

  // ─────────────── view ───────────────
  const [view, setView] = useState<View>({ z: 0.45, tx: 40, ty: 40 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ViewMode>("edit");
  // Elements open at first on a computer; on a phone the card shows first.
  const [rawPanel, setPanel] = useState<PanelKey | null | "auto">("auto");
  const desktop = useMediaQuery("(min-width: 768px)", true);
  const panel = rawPanel === "auto" ? (desktop ? "elements" : null) : rawPanel;
  const [editingText, setEditingText] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const latest = useRef({ state, ctx, view });
  useLayoutEffect(() => {
    latest.current = { state, ctx, view };
  });

  const visibleCenter = useCallback((): Point => {
    const el = stageRef.current;
    const v = latest.current.view;
    if (!el) return { x: 540, y: 675 };
    const r = el.getBoundingClientRect();
    const x = (r.width / 2 - v.tx) / v.z;
    const y = (r.height / 2 - v.ty) / v.z;
    return { x: Math.min(1000, Math.max(80, x)), y: Math.min(1270, Math.max(80, y)) };
  }, []);

  // ─────────────── changes ───────────────
  const apply = useCallback((fn: (doc: CanvasDoc, selection: string[]) => { doc: CanvasDoc; selection?: string[] } | CanvasDoc, key?: string) => {
    dispatch({
      type: "apply",
      key,
      at: Date.now(),
      fn: (doc, sel) => {
        const r = fn(doc, sel);
        return "elements" in r ? { doc: r } : r;
      },
    });
  }, []);
  const update = useCallback(
    (ids: readonly string[], fn: (el: CanvasElement) => CanvasElement, key?: string) => {
      const c = latest.current.ctx;
      apply((doc) => updateElements(doc, ids, fn, c), key);
    },
    [apply],
  );
  const patch = useCallback(
    (ids: readonly string[], p: Record<string, unknown>, key?: string) => {
      const c = latest.current.ctx;
      apply((doc) => patchElements(doc, ids, p, c), key);
    },
    [apply],
  );
  const add = useCallback(
    (els: CanvasElement[], opts?: { select?: boolean; index?: number }) => {
      const c = latest.current.ctx;
      const fitted = els.map((e) => fitElement(e, c));
      apply((doc, sel) => {
        const next = addElements(doc, fitted, opts?.index);
        const before = new Set(doc.elements);
        const ids = next.elements.filter((e) => !before.has(e)).map((e) => e.id);
        return { doc: next, selection: opts?.select === false ? sel : ids };
      });
    },
    [apply],
  );
  const remove = useCallback(
    (ids: readonly string[]) => {
      if (ids.length) apply((doc) => ({ doc: removeElements(doc, ids), selection: [] }));
    },
    [apply],
  );
  const select = useCallback((ids: string[]) => dispatch({ type: "select", ids }), []);

  // ─────────────── autosave ───────────────
  const [savedVersion, setSavedVersion] = useState(state.version);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const savedRef = useRef(state.version);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(0);
  const eventId = props.event.id;
  const saveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  const doSave = useCallback(async (): Promise<boolean> => {
    const { version, doc } = latest.current.state;
    if (version === savedRef.current) return true;
    setSaving(true);
    try {
      await api(`/api/events/${eventId}/design`, {
        method: "PATCH",
        // From now on the card is drawn from the Studio design (also when it was the uploaded-artwork card).
        body: { imageMode: "GENERATED", design: { canvas: { ...doc, enabled: true } } },
      });
      savedRef.current = version;
      setSavedVersion(version);
      setFailed(false);
      retryDelay.current = 0;
      return true;
    } catch (e) {
      setFailed(true);
      const transient = !(e instanceof ApiError) || e.status === 0 || e.status === 429 || e.status >= 500;
      if (transient) {
        retryDelay.current = Math.min(60_000, retryDelay.current ? retryDelay.current * 2 : 3000);
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void saveRef.current(), retryDelay.current);
      } else {
        toast(e instanceof ApiError ? e.message : "Couldn't save the design.", "error");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [eventId, toast]);

  const saveNow = useCallback((): Promise<boolean> => {
    const run = queue.current.then(doSave);
    queue.current = run.catch(() => false);
    return run;
  }, [doSave]);
  useEffect(() => {
    saveRef.current = saveNow;
  }, [saveNow]);

  useEffect(() => {
    if (state.version === savedVersion) return;
    const t = setTimeout(() => void saveRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [state.version, savedVersion]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.state.version !== savedRef.current) {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const saveStatus: SaveStatus = saving ? "saving" : failed ? "error" : state.version !== savedVersion ? "pending" : "saved";

  // ─────────────── uploads ───────────────
  const upload = useCallback(
    async (file: File): Promise<StudioUpload | null> => {
      if (!file.type.startsWith("image/")) {
        toast("Choose a picture (JPEG, PNG or WebP).", "error");
        return null;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "STUDIO");
      try {
        const res = await api<{ upload: StudioUpload }>(`/api/events/${eventId}/uploads`, { method: "POST", body: form });
        setUploads((list) => [res.upload, ...list]);
        return res.upload;
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Couldn't upload that picture.", "error");
        return null;
      }
    },
    [eventId, toast],
  );

  const deleteUpload = useCallback(
    async (u: StudioUpload) => {
      // Take it out of the design first: the server keeps files a saved design still uses.
      const doc = latest.current.state.doc;
      const users = doc.elements.filter((e) => e.type === "image" && e.upload === u.key).map((e) => e.id);
      const inBg = doc.bg.image?.upload === u.key;
      if (users.length || inBg) {
        apply((d) => {
          let next = removeElements(d, users);
          if (inBg) next = { ...next, bg: { ...next.bg, image: null } };
          return { doc: next, selection: [] };
        });
        // Let the change land, then save it before deleting the file.
        await new Promise((r) => setTimeout(r, 30));
        if (!(await saveRef.current())) return;
      }
      try {
        await api(`/api/events/${eventId}/uploads/${u.id}`, { method: "DELETE" });
        setUploads((list) => list.filter((x) => x.id !== u.id));
      } catch (e) {
        toast(
          e instanceof ApiError && e.status === 409 ? "That picture is still used on this event (its cover, logo or website)." : "Couldn't delete it.",
          "error",
        );
      }
    },
    [apply, eventId, toast],
  );

  const selected = useMemo(() => {
    const set = new Set(state.selection);
    return state.doc.elements.filter((e) => set.has(e.id));
  }, [state.doc, state.selection]);

  const value: StudioContextValue = {
    ...props,
    state,
    doc: state.doc,
    selection: state.selection,
    selected,
    dispatch,
    ctx,
    previewCtx,
    latestRef: latest,
    apply,
    update,
    patch,
    add,
    remove,
    select,
    view,
    setView,
    visibleCenter,
    stageRef,
    mode,
    setMode,
    panel,
    setPanel,
    editingText,
    setEditingText,
    uploads,
    images,
    upload,
    deleteUpload,
    saveStatus,
    saveNow,
    inspectorOpen,
    setInspectorOpen,
    helpOpen,
    setHelpOpen,
    toast,
  };
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
