import { promises as fs } from "node:fs";
import path from "node:path";
import { hmac } from "@/server/security/tokens";
import { assertSafeKey, type StorageDriver } from "./types";

/**
 * Development/self-hosted driver: files on disk, served by /api/media with an
 * HMAC signature + expiry so URLs cannot be guessed or reused forever.
 */
export class LocalStorageDriver implements StorageDriver {
  private root: string;
  constructor(dir: string) {
    this.root = path.resolve(process.cwd(), dir);
  }

  private file(key: string) {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Storage key escapes root");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.file(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.file(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string) {
    await fs.rm(this.file(key), { force: true });
  }

  async deletePrefix(prefix: string) {
    const dir = this.file(prefix.replace(/\/$/, ""));
    await fs.rm(dir, { recursive: true, force: true });
  }

  async signedUrl(key: string, expiresAt: number) {
    assertSafeKey(key);
    const exp = Math.floor(expiresAt / 1000);
    const sig = signLocal(key, exp);
    return `/api/media/${key}?exp=${exp}&sig=${sig}`;
  }
}

export function signLocal(key: string, exp: number) {
  return hmac(`media:${key}:${exp}`);
}
