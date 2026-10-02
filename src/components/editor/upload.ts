"use client";

import { useCallback, useState } from "react";
import type { UploadKind } from "@prisma/client";
import { useI18n } from "@/components/i18n/provider";
import { fmt } from "@/lib/i18n/config";
import type { EditorUpload } from "./types";

const IMAGE_LIMIT = 15 * 1024 * 1024;
const AUDIO_LIMIT = 12 * 1024 * 1024;

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
export const AUDIO_ACCEPT = "audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,.mp3,.m4a,.ogg";

export class UploadError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

/**
 * POST a file to /api/events/[id]/uploads. Uses XMLHttpRequest (not fetch) so we can
 * report real upload progress for large photos and songs.
 */
export function uploadFile(eventId: string, file: File, kind: UploadKind, onProgress?: (fraction: number) => void): Promise<EditorUpload> {
  const limit = kind === "MUSIC" ? AUDIO_LIMIT : IMAGE_LIMIT;
  if (file.size > limit) return Promise.reject(new UploadError("file_too_large"));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/events/${encodeURIComponent(eventId)}/uploads`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const upload = (data as { upload?: EditorUpload } | null)?.upload;
        if (upload) return resolve(upload);
        return reject(new UploadError("generic"));
      }
      const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
      reject(new UploadError(err?.code ?? (xhr.status === 429 ? "rate_limited" : "generic"), err?.message));
    };
    xhr.onerror = () => reject(new UploadError("network_error"));
    xhr.onabort = () => reject(new UploadError("network_error"));
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    xhr.send(form);
  });
}

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "processing" }
  | { status: "error"; message: string };

/** Upload state machine for one control: progress while sending, then a friendly error or the result. */
export function useUploader(eventId: string, kind: UploadKind) {
  const { dict, locale } = useI18n();
  const t = dict.editor.upload;
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const messageFor = useCallback(
    (e: unknown) => {
      const code = e instanceof UploadError ? e.code : "generic";
      const known = t.errors[code as keyof typeof t.errors];
      if (known) return known;
      // Server messages are English; only fall back to them in English.
      if (e instanceof UploadError && e.message && e.message !== code && locale === "en") return e.message;
      return t.errors.generic;
    },
    [t, locale],
  );

  const start = useCallback(
    async (file: File): Promise<EditorUpload | null> => {
      setState({ status: "uploading", progress: 0 });
      try {
        const upload = await uploadFile(eventId, file, kind, (p) =>
          setState(p >= 0.999 ? { status: "processing" } : { status: "uploading", progress: p }),
        );
        setState({ status: "idle" });
        return upload;
      } catch (e) {
        setState({ status: "error", message: messageFor(e) });
        return null;
      }
    },
    [eventId, kind, messageFor],
  );

  const fail = useCallback((message: string) => setState({ status: "error", message }), []);
  const reset = useCallback(() => setState({ status: "idle" }), []);

  const label =
    state.status === "uploading"
      ? fmt(t.uploading, { n: Math.round(state.progress * 100) })
      : state.status === "processing"
        ? t.processing
        : null;

  return { state, start, fail, reset, label, busy: state.status === "uploading" || state.status === "processing" };
}
