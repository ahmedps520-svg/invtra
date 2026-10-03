/**
 * Copies every file from the local storage folder (Render disk) to S3 / Cloudflare R2,
 * so the disk can be removed and Render deploys become zero-downtime.
 *
 * Run on the server (Render → invtra → Shell) once S3_* variables are set:
 *   npx tsx scripts/migrate-storage-to-s3.ts          # copy (skips files already there)
 *   npx tsx scripts/migrate-storage-to-s3.ts --dry    # just count
 * Then set STORAGE_DRIVER=s3. Safe to run more than once.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { S3StorageDriver } from "../src/server/storage/s3";
import { contentTypeFor } from "../src/server/storage";

const dry = process.argv.includes("--dry");
const dir = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || "./storage");
const need = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((k) => !process.env[k]);
if (need.length) {
  console.error(`Set ${need.join(", ")} first (and S3_ENDPOINT for Cloudflare R2).`);
  process.exit(1);
}
const s3 = new S3StorageDriver({
  bucket: process.env.S3_BUCKET!,
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

async function* walk(folder: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function main() {
  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  for await (const file of walk(dir)) {
    const key = path.relative(dir, file).split(path.sep).join("/");
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,400}$/.test(key)) {
      console.warn(`skip (unexpected name): ${key}`);
      continue;
    }
    if (await s3.get(key).then((b) => b !== null).catch(() => false)) {
      skipped++;
      continue;
    }
    const data = await fs.readFile(file);
    if (!dry) await s3.put(key, data, contentTypeFor(key));
    copied++;
    bytes += data.length;
    if (copied % 50 === 0) console.log(`… ${copied} files`);
  }
  console.log(`${dry ? "Would copy" : "Copied"} ${copied} files (${(bytes / 1e6).toFixed(1)} MB); ${skipped} already in the bucket.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
