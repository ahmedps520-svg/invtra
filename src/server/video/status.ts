import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Event } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { badRequest } from "@/server/http";
import { logError } from "@/server/log";
import { enqueue, PermanentJobError, PRIORITY } from "@/server/queue/queue";
import { sha256 } from "@/server/security/tokens";
import { mediaUrl, storage } from "@/server/storage";
import { eventDesign } from "@/server/events/design";
import { teaserImageVersion } from "@/server/invitations";
import { renderTeaser } from "@/server/invitations/render";
import { buildLayers, ffmpegArgs, posterArgs, runFfmpeg, type Music } from "./compose";

/**
 * The host's "video for your Status": rendered in the background on request, once per
 * design (a new design, or new music, makes a new video), and kept in storage. The event
 * remembers the latest one; a request for a design that's already rendering or rendered
 * does nothing.
 */

/** Bump when the video's look changes, so every event gets the new version on its next request. */
const STYLE = 1;

type VideoEvent = Pick<Event, "id" | "title" | "plan" | "musicKey" | "statusVideoKey" | "contentVersion" | "design" | "themeKey" | "imageMode" | "customImageKey" | "language">;

export type StatusVideo =
  | { state: "none" | "rendering" | "failed"; url: null; poster: null; outdated: boolean }
  | { state: "ready"; url: string; poster: string | null; outdated: false };

export function statusVideoVersion(event: VideoEvent): string {
  return sha256(JSON.stringify(["status-video", STYLE, teaserImageVersion(event), event.musicKey])).slice(0, 16);
}

export const statusVideoKey = (event: VideoEvent) => `renders/${event.id}/status-${statusVideoVersion(event)}.mp4`;
const posterKey = (videoKey: string) => videoKey.replace(/\.mp4$/, ".jpg");
const jobKey = (event: VideoEvent) => `video:${event.id}:${statusVideoVersion(event)}`;

/** Where the video for the event's current design stands. `outdated`: there's one, but for an older design. */
export async function statusVideo(event: VideoEvent): Promise<StatusVideo> {
  const key = statusVideoKey(event);
  if (event.statusVideoKey === key) {
    const [url, poster] = await Promise.all([mediaUrl(key, 2), mediaUrl(posterKey(key), 2)]);
    if (url) return { state: "ready", url, poster, outdated: false };
  }
  const outdated = Boolean(event.statusVideoKey);
  const job = await db.job.findUnique({ where: { dedupeKey: jobKey(event) }, select: { status: true } });
  if (job?.status === "PENDING" || job?.status === "RUNNING") return { state: "rendering", url: null, poster: null, outdated };
  if (job?.status === "FAILED") return { state: "failed", url: null, poster: null, outdated };
  return { state: "none", url: null, poster: null, outdated };
}

/** Starts rendering the video for the event's current design (needs a plan). */
export async function requestStatusVideo(event: VideoEvent): Promise<StatusVideo> {
  if (!event.plan) throw badRequest("no_plan", "Choose a plan to make your video.");
  const current = await statusVideo(event);
  if (current.state === "ready" || current.state === "rendering") return current;
  // A failed (or finished but lost) attempt for this design is cleared so it can run again.
  await db.job.deleteMany({ where: { dedupeKey: jobKey(event), status: { in: ["FAILED", "CANCELLED", "COMPLETED"] } } });
  await enqueue(
    "event.status_video",
    { eventId: event.id, version: statusVideoVersion(event) },
    { dedupeKey: jobKey(event), eventId: event.id, priority: PRIORITY.interactive, maxAttempts: 3 },
  );
  return { state: "rendering", url: null, poster: null, outdated: current.outdated };
}

/** A file name for downloads: "noura-faisal-invitation.mp4". */
export function statusVideoFilename(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${slug || "invitation"}-invitation.mp4`;
}

// One video at a time per process: each render uses a couple of hundred MB and most of a CPU.
let slot: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = slot.then(fn, fn);
  slot = run.catch(() => undefined);
  return run;
}

/** The job: renders the video for `version` of the event's design, unless the design has moved on. */
export async function renderStatusVideo(eventId: string, version: string): Promise<void> {
  return oneAtATime(async () => {
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt) return;
    // Edited since this was requested: the dashboard asks for the new design's video.
    if (statusVideoVersion(event) !== version) return;
    const key = statusVideoKey(event);
    if (event.statusVideoKey === key) return;

    const dir = await mkdtemp(path.join(tmpdir(), "invtra-video-"));
    try {
      const { png } = await renderTeaser(event);
      const design = eventDesign(event);
      const { layers, geometry } = await buildLayers({
        card: png,
        language: event.language,
        palette: design.palette,
        fonts: { display: design.fonts.display, arabicDisplay: design.fonts.arabicDisplay },
        seed: event.id,
      });
      await Promise.all(layers.map((l) => writeFile(path.join(dir, `${l.name}.png`), l.png)));
      const music = await musicFile(event.musicKey, dir);
      const out = path.join(dir, "video.mp4");
      const bin = env().FFMPEG_PATH;
      try {
        await runFfmpeg(bin, ffmpegArgs(dir, geometry, out, music));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new PermanentJobError(`ffmpeg isn't installed (${bin})`);
        if (!music) throw e;
        // A music file ffmpeg can't read shouldn't cost the host their video: make it without.
        await logError("video.music", e, { eventId: event.id, musicKey: event.musicKey }, "warn");
        await runFfmpeg(bin, ffmpegArgs(dir, geometry, out, null));
      }
      const poster = path.join(dir, "poster.jpg");
      await runFfmpeg(bin, posterArgs(out, poster));
      await storage().put(posterKey(key), await readFile(poster), "image/jpeg");
      await storage().put(key, await readFile(out), "video/mp4");
      const previous = event.statusVideoKey;
      await db.event.update({ where: { id: event.id }, data: { statusVideoKey: key } });
      if (previous && previous !== key) {
        await Promise.all([storage().delete(previous), storage().delete(posterKey(previous))]).catch(() => undefined);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

async function musicFile(key: string | null, dir: string): Promise<Music | null> {
  if (!key) return null;
  const format = key.split(".").pop();
  if (format !== "mp3" && format !== "m4a" && format !== "ogg") return null;
  const data = await storage().get(key);
  if (!data) return null;
  const file = path.join(dir, `music.${format}`);
  await writeFile(file, data);
  return { path: file, format };
}
