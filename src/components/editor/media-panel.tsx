"use client";

import { useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, Music2, Pause, Play, Plus, Trash2, Upload as UploadIcon, X } from "lucide-react";
import type { UploadKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n/provider";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";
import type { EditorGalleryImage } from "./types";
import { AUDIO_ACCEPT, IMAGE_ACCEPT, UploadError as UploadErr, uploadFile, useUploader } from "./upload";
import { Dropzone, FileButton, UploadError, UploadProgress } from "./upload-field";

function SlotHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">{hint}</p>
    </div>
  );
}

function ImageSlot({ field, kind, title, hint, variant }: { field: "coverImageKey" | "logoKey"; kind: UploadKind; title: string; hint: string; variant: "cover" | "logo" }) {
  const { dict } = useI18n();
  const t = dict.editor.media;
  const { event, draft, uploads, addUpload, setMedia } = useEditor();
  const uploader = useUploader(event.id, kind);
  const key = draft[field];
  const current = key ? uploads[key] : undefined;

  const onFile = async (file: File) => {
    const u = await uploader.start(file);
    if (!u) return;
    addUpload(u);
    await setMedia(field, u.key);
  };

  return (
    <div className="flex h-full flex-col">
      <SlotHeader title={title} hint={hint} />
      {current?.url ? (
        <div className="mt-auto flex flex-wrap items-center gap-4">
          <div
            className={cn(
              "relative shrink-0 overflow-hidden rounded-xl border border-line bg-sand",
              variant === "cover" ? "aspect-[16/10] w-48" : "size-24 bg-[conic-gradient(var(--color-sand)_25%,var(--color-paper)_0_50%,var(--color-sand)_0_75%,var(--color-paper)_0)] bg-[length:14px_14px]",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={current.url} alt={title} className={cn("absolute inset-0 size-full", variant === "cover" ? "object-cover" : "object-contain p-2")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FileButton accept={IMAGE_ACCEPT} onFile={onFile} disabled={uploader.busy} icon={<UploadIcon className="size-3.5" />}>
              {t.replace}
            </FileButton>
            <Button variant="ghost" size="sm" disabled={uploader.busy} icon={<Trash2 className="size-3.5" />} onClick={() => void setMedia(field, null)}>
              {t.remove}
            </Button>
            <UploadProgress state={uploader.state} label={uploader.label} />
          </div>
          <div className="basis-full">
            <UploadError message={uploader.state.status === "error" ? uploader.state.message : null} />
          </div>
        </div>
      ) : (
        <Dropzone
          accept={IMAGE_ACCEPT}
          onFiles={(files) => void onFile(files[0])}
          title={t.uploadImage}
          hint={t.imageTypes}
          state={uploader.state}
          progressLabel={uploader.label}
          className="mt-auto [&>label]:min-h-32"
        />
      )}
    </div>
  );
}

function formatDuration(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function MusicSlot() {
  const { dict } = useI18n();
  const t = dict.editor.media;
  const { event, draft, uploads, addUpload, setMedia } = useEditor();
  const uploader = useUploader(event.id, "MUSIC");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ at: 0, total: 0 });
  const current = draft.musicKey ? uploads[draft.musicKey] : undefined;

  const onFile = async (file: File) => {
    audioRef.current?.pause();
    const u = await uploader.start(file);
    if (!u) return;
    addUpload(u);
    await setMedia("musicKey", u.key);
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };

  const pct = time.total ? (time.at / time.total) * 100 : 0;

  return (
    <div>
      <SlotHeader title={t.music} hint={t.musicHint} />
      {current?.url ? (
        <div className="space-y-3">
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-ivory/70 p-3 pe-4">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? t.pause : t.play}
              aria-pressed={playing}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-ivory shadow-soft transition hover:bg-bronze-800"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Music2 className="size-3.5 text-bronze-600" />
                  {t.musicReady}
                </p>
                <span className="text-[12px] tabular-nums text-ink-faint" dir="ltr">
                  {time.total ? `${formatDuration(time.at) || "0:00"} / ${formatDuration(time.total)}` : ""}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-mist" dir="ltr">
                <div className="h-full rounded-full bg-bronze-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <audio
              ref={audioRef}
              src={current.url}
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onLoadedMetadata={(e) => setTime({ at: 0, total: e.currentTarget.duration })}
              onTimeUpdate={(e) => setTime({ at: e.currentTarget.currentTime, total: e.currentTarget.duration })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FileButton accept={AUDIO_ACCEPT} onFile={onFile} disabled={uploader.busy} icon={<UploadIcon className="size-3.5" />}>
              {t.replace}
            </FileButton>
            <Button
              variant="ghost"
              size="sm"
              disabled={uploader.busy}
              icon={<Trash2 className="size-3.5" />}
              onClick={() => {
                audioRef.current?.pause();
                void setMedia("musicKey", null);
              }}
            >
              {t.remove}
            </Button>
            <UploadProgress state={uploader.state} label={uploader.label} />
          </div>
          <UploadError message={uploader.state.status === "error" ? uploader.state.message : null} />
        </div>
      ) : (
        <Dropzone
          accept={AUDIO_ACCEPT}
          onFiles={(files) => void onFile(files[0])}
          title={t.uploadMusic}
          hint={t.audioTypes}
          state={uploader.state}
          progressLabel={uploader.label}
          icon={<Music2 />}
          className="[&>label]:min-h-32"
        />
      )}
    </div>
  );
}

type GalleryState = { status: "idle" } | { status: "uploading"; index: number; total: number; progress: number } | { status: "error"; message: string };

function GalleryManager() {
  const { dict, dir } = useI18n();
  const t = dict.editor.media;
  const te = dict.editor.upload;
  const toast = useToast();
  const { event, gallery, setGallery, addUpload, discardUpload, bumpSite } = useEditor();
  const [state, setState] = useState<GalleryState>({ status: "idle" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const errorText = (code: string) => te.errors[code as keyof typeof te.errors] ?? te.errors.generic;

  const addFiles = async (files: File[]) => {
    const room = Math.max(0, 40 - gallery.length);
    const list = files.slice(0, room);
    if (!list.length) {
      setState({ status: "error", message: te.errors.gallery_full });
      return;
    }
    let failed: string | null = files.length > room ? te.errors.gallery_full : null;
    for (let i = 0; i < list.length; i++) {
      setState({ status: "uploading", index: i, total: list.length, progress: 0 });
      try {
        const u = await uploadFile(event.id, list[i], "GALLERY", (p) => setState({ status: "uploading", index: i, total: list.length, progress: p }));
        addUpload(u);
        const res = await api<{ image: EditorGalleryImage }>(`/api/events/${event.id}/gallery`, { method: "POST", body: { key: u.key } });
        setGallery((g) => [...g, res.image]);
      } catch (e) {
        failed = errorText(e instanceof UploadErr ? e.code : ((e as { code?: string }).code ?? "generic"));
        if ((e as { code?: string }).code === "gallery_full") break;
      }
    }
    setState(failed ? { status: "error", message: failed } : { status: "idle" });
    bumpSite();
  };

  const persistOrder = async (ids: string[], previous: EditorGalleryImage[]) => {
    try {
      await api(`/api/events/${event.id}/gallery`, { method: "PATCH", body: { order: ids } });
      bumpSite();
    } catch {
      setGallery(() => previous);
      toast(dict.common.errors.generic, "error");
    }
  };

  const move = (id: string, delta: number) => {
    const previous = gallery;
    const i = gallery.findIndex((g) => g.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= gallery.length) return;
    const next = [...gallery];
    [next[i], next[j]] = [next[j], next[i]];
    setGallery(() => next);
    void persistOrder(
      next.map((g) => g.id),
      previous,
    );
  };

  const remove = async (img: EditorGalleryImage) => {
    const previous = gallery;
    setGallery((g) => g.filter((x) => x.id !== img.id));
    try {
      await api(`/api/events/${event.id}/gallery/${img.id}`, { method: "DELETE" });
      void discardUpload(img.storageKey);
      bumpSite();
    } catch {
      setGallery(() => previous);
      toast(dict.common.errors.generic, "error");
    }
  };

  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!from || from === targetId) return;
    const previous = gallery;
    const next = gallery.filter((g) => g.id !== from);
    const at = next.findIndex((g) => g.id === targetId);
    const moved = gallery.find((g) => g.id === from);
    if (!moved || at < 0) return;
    const fromIndex = gallery.findIndex((g) => g.id === from);
    const toIndex = gallery.findIndex((g) => g.id === targetId);
    next.splice(fromIndex < toIndex ? at + 1 : at, 0, moved);
    setGallery(() => next);
    void persistOrder(
      next.map((g) => g.id),
      previous,
    );
  };

  const busy = state.status === "uploading";
  const Earlier = dir === "rtl" ? ArrowRight : ArrowLeft;
  const Later = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div>
      <SlotHeader title={t.gallery} hint={t.galleryHint} />
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {gallery.map((img, i) => (
          <li
            key={img.id}
            draggable
            onDragStart={(e) => {
              setDragId(img.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(img.id);
            }}
            onDrop={(e) => onDrop(e, img.id)}
            className={cn(
              "group relative aspect-square cursor-grab overflow-hidden rounded-xl border border-line bg-sand transition-all duration-300 ease-luxe active:cursor-grabbing",
              dragId === img.id && "opacity-40",
              overId === img.id && dragId !== img.id && "ring-2 ring-bronze-500 ring-offset-2 ring-offset-paper",
            )}
          >
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img src={img.url} alt={fmt(t.photoAlt, { n: i + 1 })} className="size-full object-cover" draggable={false} />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink/60 to-transparent p-1.5 pt-6 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(img.id, -1)}
                  disabled={i === 0}
                  aria-label={t.moveEarlier}
                  className="flex size-7 items-center justify-center rounded-full bg-paper/90 text-ink transition hover:bg-paper disabled:opacity-30"
                >
                  <Earlier className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(img.id, 1)}
                  disabled={i === gallery.length - 1}
                  aria-label={t.moveLater}
                  className="flex size-7 items-center justify-center rounded-full bg-paper/90 text-ink transition hover:bg-paper disabled:opacity-30"
                >
                  <Later className="size-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => void remove(img)}
                aria-label={t.removePhoto}
                className="flex size-7 items-center justify-center rounded-full bg-paper/90 text-rosewood transition hover:bg-paper"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
        {gallery.length < 40 ? (
          <li>
            <label
              className={cn(
                "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-ivory/60 px-2 text-center text-ink-faint transition hover:border-bronze-400 hover:bg-bronze-50/50 hover:text-bronze-700",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze-400 has-[:focus-visible]:ring-offset-2",
                busy && "pointer-events-none",
              )}
              onDragOver={(e) => {
                if (dragId) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (dragId) return;
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
                if (files.length) void addFiles(files);
              }}
            >
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                disabled={busy}
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) void addFiles(files);
                }}
              />
              {busy && state.status === "uploading" ? (
                <>
                  <span className="text-[12px] font-medium tabular-nums text-ink-soft">
                    {state.index + 1} / {state.total}
                  </span>
                  <span className="h-1 w-3/4 overflow-hidden rounded-full bg-mist">
                    <span className="block h-full rounded-full bg-bronze-500 transition-[width]" style={{ width: `${Math.max(6, state.progress * 100)}%` }} />
                  </span>
                </>
              ) : (
                <>
                  <Plus className="size-5" />
                  <span className="text-[12px] font-medium">{t.addPhotos}</span>
                </>
              )}
            </label>
          </li>
        ) : null}
      </ul>
      {gallery.length === 0 && !busy ? <p className="mt-3 text-[12px] text-ink-faint">{t.galleryEmpty}</p> : null}
      <span className="sr-only" aria-live="polite">
        {busy && state.status === "uploading" ? fmt(te.uploading, { n: Math.round(state.progress * 100) }) : ""}
      </span>
      <UploadError message={state.status === "error" ? state.message : null} />
    </div>
  );
}

export function MediaPanel() {
  const { dict } = useI18n();
  const t = dict.editor.media;
  return (
    <div className="space-y-9">
      <div className="grid gap-9 md:grid-cols-2">
        <ImageSlot field="coverImageKey" kind="COVER" title={t.cover} hint={t.coverHint} variant="cover" />
        <ImageSlot field="logoKey" kind="LOGO" title={t.logo} hint={t.logoHint} variant="logo" />
      </div>
      <div className="border-t border-line pt-7">
        <MusicSlot />
      </div>
      <div className="border-t border-line pt-7">
        <GalleryManager />
      </div>
    </div>
  );
}
