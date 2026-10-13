/**
 * The "video for your Status": its look (backdrop colours, layout, layers), the ffmpeg recipe,
 * real renders with and without the host's music, when a video is made again, and who can
 * download it.
 */
import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { storage } from "@/server/storage";
import { THEMES } from "@/lib/themes/registry";

const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<object>()), getSessionUser: vi.fn(async () => session.user) }));

import { VIDEO_H, VIDEO_W, backdrop, buildLayers, ffmpegArgs, layout } from "@/server/video/compose";
import { renderStatusVideo, requestStatusVideo, statusVideo, statusVideoFilename, statusVideoKey, statusVideoVersion } from "@/server/video/status";
import { GET as fileRoute } from "@/app/api/events/[id]/video/file/route";
import { POST as createRoute } from "@/app/api/events/[id]/video/route";

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const run = randomBytes(4).toString("hex");
const userIds: string[] = [];
const eventIds: string[] = [];
const tmp = mkdtempSync(path.join(tmpdir(), "video-test-"));

async function makeUser() {
  const user = await db.user.create({ data: { email: `video-${run}-${userIds.length}@example.test`, name: "Video Host", passwordHash: "x", emailVerifiedAt: new Date() } });
  userIds.push(user.id);
  return user;
}
async function makeEvent(userId: string, extra: Record<string, unknown> = {}) {
  const event = await db.event.create({
    data: {
      userId,
      title: "Noura & Faisal",
      hostNames: "Noura & Faisal",
      startsAt: new Date(Date.now() + 30 * 86_400_000),
      venueName: "Ritz-Carlton",
      address: "Riyadh",
      themeKey: "royal",
      design: THEMES.royal.defaults as object,
      plan: "BASIC",
      ...extra,
    },
  });
  eventIds.push(event.id);
  return event;
}
const reload = (id: string) => db.event.findUniqueOrThrow({ where: { id } });

/** Streams, duration and size of an MP4, from ffprobe. */
function probe(buf: Buffer) {
  const file = path.join(tmp, `${randomBytes(4).toString("hex")}.mp4`);
  writeFileSync(file, buf);
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,nb_frames:format=duration", "-of", "json", file]);
  return JSON.parse(out.toString()) as { streams: { codec_type: string; codec_name: string; width?: number; height?: number; nb_frames?: string }[]; format: { duration: string } };
}

afterAll(async () => {
  for (const id of eventIds) await storage().deletePrefix(`renders/${id}/`).catch(() => undefined);
  for (const id of userIds) await storage().deletePrefix(`u/${id}/`).catch(() => undefined);
  await db.job.deleteMany({ where: { type: "event.status_video", eventId: { in: eventIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  rmSync(tmp, { recursive: true, force: true });
});

describe("the look", () => {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  it("sets the card on a deep shade of its own colour, or of its accent", () => {
    const [green, greenEdge] = backdrop(THEMES.royal.defaults.palette); // dark green card
    expect(rgb(green)[1]).toBeGreaterThan(rgb(green)[0]);
    expect(rgb(greenEdge).every((v, i) => v <= rgb(green)[i])).toBe(true); // darker at the edges
    const [gold] = backdrop(THEMES.luxury.defaults.palette); // black card, gold accent
    expect(rgb(gold)[0]).toBeGreaterThan(rgb(gold)[2]);
    const [grey] = backdrop({ background: "#ffffff", accent: "#888888" });
    const [r, , b] = rgb(grey);
    expect(Math.abs(r - b)).toBeLessThan(16); // a near-neutral charcoal
    for (const t of Object.values(THEMES)) {
      // Every design gets a deep stage that light text reads on.
      const [inner] = backdrop(t.defaults.palette);
      expect(Math.max(...rgb(inner))).toBeLessThan(140);
    }
  });

  it("fits any card between the title and the mark, clear of WhatsApp's own buttons", () => {
    const usual = layout(1080, 1350, "EN");
    expect(usual.card).toMatchObject({ w: 614, h: 768, x: 53 });
    expect(usual.title.y + usual.title.h).toBeLessThan(usual.card.y);
    expect(usual.brandY).toBeGreaterThan(usual.card.y + usual.card.h);
    const tall = layout(1080, 1920, "BILINGUAL");
    expect(tall.card.h).toBeLessThanOrEqual(800);
    for (const g of [usual, tall]) {
      expect(g.title.y).toBeGreaterThanOrEqual(150);
      expect(g.brandY + 40).toBeLessThanOrEqual(VIDEO_H - 128);
    }
  });

  it("draws every layer at its size, the same way each time for an event", async () => {
    const card = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#0f2e26" } }).png().toBuffer();
    const input = { card, language: "BILINGUAL" as const, palette: THEMES.royal.defaults.palette, fonts: { display: "cinzel" as const, arabicDisplay: "aref-ruqaa" as const }, seed: "event-a" };
    const { layers, geometry } = await buildLayers(input);
    const size = async (name: string) => {
      const m = await sharp(layers.find((l) => l.name === name)!.png).metadata();
      return [m.width, m.height];
    };
    expect(layers.map((l) => l.name)).toEqual(["stage", "fine", "bokeh", "shadow", "card", "sweep", "title", "brand"]);
    expect(await size("stage")).toEqual([VIDEO_W, VIDEO_H]);
    expect(await size("fine")).toEqual([VIDEO_W, VIDEO_H + 360]); // drifts 1px a frame for 12s
    expect(await size("bokeh")).toEqual([VIDEO_W, VIDEO_H + 720]); // and 2px a frame
    expect(await size("card")).toEqual([geometry.card.w, geometry.card.h]);
    const again = await buildLayers(input);
    expect(again.layers[1].png.equals(layers[1].png)).toBe(true);
    const other = await buildLayers({ ...input, seed: "event-b" });
    expect(other.layers[1].png.equals(layers[1].png)).toBe(false);
  });

  it("names the container of the host's music so ffmpeg never guesses", () => {
    const g = layout(1080, 1350, "EN");
    const silent = ffmpegArgs("/x", g, "/x/out.mp4");
    expect(silent).not.toContain("[a]");
    const withMusic = ffmpegArgs("/x", g, "/x/out.mp4", { path: "/x/music.m4a", format: "m4a" });
    expect(withMusic.join(" ")).toContain("-f mov -i /x/music.m4a");
    expect(withMusic).toContain("[a]");
    expect(silent.slice(-1)[0]).toBe("/x/out.mp4");
  });

  it("names the download after the event", () => {
    expect(statusVideoFilename("Noura & Faisal")).toBe("noura-faisal-invitation.mp4");
    expect(statusVideoFilename("خطوبة نورة")).toBe("خطوبة-نورة-invitation.mp4");
    expect(statusVideoFilename("!!!")).toBe("invitation-invitation.mp4");
  });
});

describe.skipIf(!ffmpeg)("making the video", () => {
  it("needs a plan", async () => {
    const event = await makeEvent((await makeUser()).id, { plan: null });
    await expect(requestStatusVideo(event)).rejects.toMatchObject({ code: "no_plan" });
  });

  it("renders a 12-second 720×1280 MP4 once per design, and again when the design changes", async () => {
    const event = await makeEvent((await makeUser()).id);
    expect(await statusVideo(event)).toEqual({ state: "none", url: null, poster: null, outdated: false });
    expect((await requestStatusVideo(event)).state).toBe("rendering");
    await requestStatusVideo(event); // asking twice doesn't queue it twice
    expect(await db.job.count({ where: { type: "event.status_video", eventId: event.id } })).toBe(1);

    await renderStatusVideo(event.id, statusVideoVersion(event));
    const done = await reload(event.id);
    expect(done.statusVideoKey).toBe(statusVideoKey(done));
    const ready = await statusVideo(done);
    expect(ready.state).toBe("ready");
    expect(ready.poster).toBeTruthy();
    const poster = await sharp((await storage().get(done.statusVideoKey!.replace(".mp4", ".jpg")))!).metadata();
    expect([poster.format, poster.width, poster.height]).toEqual(["jpeg", 720, 1280]);
    const info = probe((await storage().get(done.statusVideoKey!))!);
    expect(info.streams).toEqual([expect.objectContaining({ codec_type: "video", codec_name: "h264", width: 720, height: 1280, nb_frames: "360" })]);
    expect(Number(info.format.duration)).toBeCloseTo(12, 1);

    // The design changes: the old video is out of date, and a render for the old design does nothing.
    const edited = await db.event.update({ where: { id: event.id }, data: { contentVersion: { increment: 1 } } });
    expect(await statusVideo(edited)).toEqual({ state: "none", url: null, poster: null, outdated: true });
    await renderStatusVideo(event.id, statusVideoVersion(done));
    expect((await reload(event.id)).statusVideoKey).toBe(done.statusVideoKey);
  }, 90_000);

  it("plays the host's music, replaces the previous video, and still makes one if the music won't play", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    await renderStatusVideo(event.id, statusVideoVersion(event));
    const first = (await reload(event.id)).statusVideoKey!;

    const mp3 = path.join(tmp, "tone.mp3");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:a", "libmp3lame", "-b:a", "96k", mp3]);
    const musicKey = `u/${user.id}/${event.id}/music/tone.mp3`;
    await storage().put(musicKey, readFileSync(mp3), "audio/mpeg");
    const withMusic = await db.event.update({ where: { id: event.id }, data: { musicKey } });
    await renderStatusVideo(event.id, statusVideoVersion(withMusic));
    const second = (await reload(event.id)).statusVideoKey!;
    expect(second).not.toBe(first);
    expect(await storage().get(first)).toBeNull(); // the old files are removed
    expect(await storage().get(first.replace(".mp4", ".jpg"))).toBeNull();
    const info = probe((await storage().get(second))!);
    expect(info.streams.map((s) => s.codec_type).sort()).toEqual(["audio", "video"]);
    expect(Number(info.format.duration)).toBeCloseTo(12, 1); // the 4-second tune loops

    const brokenKey = `u/${user.id}/${event.id}/music/broken.mp3`;
    await storage().put(brokenKey, Buffer.concat([Buffer.from("ID3"), randomBytes(4000)]), "audio/mpeg");
    const broken = await db.event.update({ where: { id: event.id }, data: { musicKey: brokenKey } });
    await renderStatusVideo(event.id, statusVideoVersion(broken));
    const third = (await reload(event.id)).statusVideoKey!;
    expect(probe((await storage().get(third))!).streams.map((s) => s.codec_type)).toEqual(["video"]);
  }, 120_000);

  it("is downloadable by the host only", async () => {
    const host = await makeUser();
    const event = await makeEvent(host.id, { title: "Noura & Faisal" });
    await renderStatusVideo(event.id, statusVideoVersion(event));
    const ctx = { params: Promise.resolve({ id: event.id }) };
    const url = `https://invtra.store/api/events/${event.id}/video/file`;

    session.user = await makeUser();
    expect((await fileRoute(new NextRequest(url), ctx)).status).toBe(404);

    session.user = host;
    const res = await fileRoute(new NextRequest(url), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-disposition")).toContain("noura-faisal-invitation.mp4");
    expect(Buffer.from(await res.arrayBuffer()).subarray(4, 8).toString()).toBe("ftyp");

    // Asking for it again while it's ready returns it without queuing anything.
    const again = await createRoute(new NextRequest(url.replace("/file", ""), { method: "POST", body: "{}" }), ctx);
    expect(await again.json()).toMatchObject({ state: "ready" });
    session.user = null;
  }, 90_000);
});
