import sharp, { type Metadata, type Sharp } from "sharp";
import type { UploadKind } from "@prisma/client";
import { db } from "@/server/db";
import { storage, mediaUrl } from "@/server/storage";
import { badRequest } from "@/server/http";
import { generateSecretToken } from "@/server/security/tokens";

/**
 * Customer uploads. Images are decoded and re-encoded with sharp (strips EXIF/GPS
 * metadata, normalises orientation, caps dimensions) so only clean JPEG/PNG files are
 * stored. Audio is checked by magic bytes.
 */

const IMAGE_LIMIT = 15 * 1024 * 1024;
const AUDIO_LIMIT = 12 * 1024 * 1024;

const MAX_EDGE: Record<UploadKind, number> = {
  COVER: 2400,
  GALLERY: 2000,
  LOGO: 800,
  BACKGROUND: 2400,
  CUSTOM_INVITATION: 3000,
  MUSIC: 0,
};

function audioType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.subarray(0, 3).toString("latin1") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { mime: "audio/mpeg", ext: "mp3" };
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return { mime: "audio/mp4", ext: "m4a" };
  if (buf.subarray(0, 4).toString("latin1") === "OggS") return { mime: "audio/ogg", ext: "ogg" };
  return null;
}

export async function saveUpload(opts: { userId: string; eventId: string; kind: UploadKind; data: Buffer }) {
  const { userId, eventId, kind, data } = opts;
  const id = generateSecretToken(12);
  if (kind === "MUSIC") {
    if (data.length > AUDIO_LIMIT) throw badRequest("file_too_large", "Music files can be up to 12 MB.");
    const t = audioType(data);
    if (!t) throw badRequest("unsupported_file", "Upload an MP3, M4A or OGG audio file.");
    const key = `u/${userId}/${eventId}/music/${id}.${t.ext}`;
    await storage().put(key, data, t.mime);
    return db.upload.create({ data: { userId, eventId, kind, key, mimeType: t.mime, size: data.length } });
  }

  if (data.length > IMAGE_LIMIT) throw badRequest("file_too_large", "Images can be up to 15 MB.");
  let img: Sharp;
  let meta: Metadata;
  try {
    img = sharp(data, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
    meta = await img.metadata();
  } catch {
    throw badRequest("unsupported_file", "Upload a JPG, PNG, WEBP or HEIC image.");
  }
  if (!meta.width || !meta.height) throw badRequest("unsupported_file", "That image couldn't be read.");
  const keepAlpha = kind === "LOGO" && meta.hasAlpha;
  const edge = MAX_EDGE[kind];
  const pipeline = img.resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true });
  const out = keepAlpha
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: kind === "CUSTOM_INVITATION" ? 92 : 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const ext = keepAlpha ? "png" : "jpg";
  const mime = keepAlpha ? "image/png" : "image/jpeg";
  const key = `u/${userId}/${eventId}/${kind.toLowerCase()}/${id}.${ext}`;
  await storage().put(key, out.data, mime);
  return db.upload.create({
    data: { userId, eventId, kind, key, mimeType: mime, size: out.data.length, width: out.info.width, height: out.info.height },
  });
}

export async function uploadView(u: { id: string; key: string; kind: UploadKind; width: number | null; height: number | null; mimeType: string }) {
  return { id: u.id, key: u.key, kind: u.kind, width: u.width, height: u.height, mimeType: u.mimeType, url: await mediaUrl(u.key) };
}

/** Ensure a storage key referenced by the client belongs to this user's event. */
export async function assertEventUpload(eventId: string, key: string | null | undefined, kinds?: UploadKind[]) {
  if (!key) return null;
  const u = await db.upload.findUnique({ where: { key } });
  // Any file uploaded to this event — by the host or by INVTRA staff designing it for them.
  if (!u || u.eventId !== eventId || (kinds && !kinds.includes(u.kind))) {
    throw badRequest("invalid_upload", "That file isn't available.");
  }
  return u;
}
