/**
 * Standalone queue worker: `npm run worker`.
 * Run one or more alongside the web app in production.
 */
import { env } from "@/server/env";
import { startWorker } from "@/server/queue/worker";
import { db } from "@/server/db";

const e = env();
const worker = startWorker({ concurrency: e.WORKER_CONCURRENCY, label: "worker" });

async function shutdown(signal: string) {
  console.log(`[invtra] ${signal} received, draining worker…`);
  await worker.stop();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
