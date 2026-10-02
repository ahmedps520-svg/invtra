import { env } from "@/server/env";
import type { StorageDriver } from "./types";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";

export type { StorageDriver } from "./types";

let driver: StorageDriver | null = null;

/** The configured object store (local filesystem in development, S3/R2 in production). */
export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  driver =
    e.STORAGE_DRIVER === "s3"
      ? new S3StorageDriver({
          bucket: e.S3_BUCKET!,
          region: e.S3_REGION,
          endpoint: e.S3_ENDPOINT,
          accessKeyId: e.S3_ACCESS_KEY_ID!,
          secretAccessKey: e.S3_SECRET_ACCESS_KEY!,
          forcePathStyle: e.S3_FORCE_PATH_STYLE,
        })
      : new LocalStorageDriver(e.LOCAL_STORAGE_DIR);
  return driver;
}

/**
 * Signed, expiring URL for a stored object. Expiry is rounded to a day boundary so
 * the same object yields the same URL for a while (browser/CDN cache friendly).
 */
export async function mediaUrl(key: string | null | undefined, days = 7): Promise<string | null> {
  if (!key) return null;
  const dayMs = 86_400_000;
  const expiresAt = Math.ceil(Date.now() / dayMs) * dayMs + days * dayMs;
  return storage().signedUrl(key, expiresAt);
}

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}
