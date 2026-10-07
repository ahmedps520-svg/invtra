import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";

/**
 * Integration settings edited in the admin (Apple certificates and keys…), stored in the
 * Setting table. Secret values are encrypted with AES-256-GCM under a key derived from
 * APP_SECRET, so a database dump alone doesn't reveal them. Reads are cached briefly.
 */

const SECRET_PREFIX = "enc:v1:";
const TTL_MS = 30_000;
// One cache per process (route handlers and pages may load separate copies of this module).
const g = globalThis as unknown as { __invtraSettings?: Map<string, { value: string | null; at: number }> };
const cache = (g.__invtraSettings ??= new Map());

function key() {
  return createHash("sha256").update(`invtra-settings:${env().APP_SECRET}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return SECRET_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(SECRET_PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(SECRET_PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export async function getSetting(name: string, opts: { fresh?: boolean } = {}): Promise<string | null> {
  const hit = cache.get(name);
  if (!opts.fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const row = await db.setting.findUnique({ where: { key: name } });
  const value = row ? decryptSecret(row.value) : null;
  cache.set(name, { value, at: Date.now() });
  return value;
}

export async function getSettings<K extends string>(names: readonly K[], opts: { fresh?: boolean } = {}): Promise<Record<K, string | null>> {
  const out = {} as Record<K, string | null>;
  for (const n of names) out[n] = await getSetting(n, opts);
  return out;
}

/** Save (or with null, remove) a setting. `secret` values are stored encrypted. */
export async function setSetting(name: string, value: string | null, opts: { secret?: boolean } = {}) {
  cache.delete(name);
  if (value === null) {
    await db.setting.deleteMany({ where: { key: name } });
    return;
  }
  const stored = opts.secret ? encryptSecret(value) : value;
  await db.setting.upsert({ where: { key: name }, create: { key: name, value: stored }, update: { value: stored } });
}

export function clearSettingsCache() {
  cache.clear();
}
