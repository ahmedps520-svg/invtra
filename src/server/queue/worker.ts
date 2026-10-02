import { hostname } from "node:os";
import type { Job } from "@prisma/client";
import { db } from "@/server/db";
import { logError } from "@/server/log";
import { purgeExpiredRateLimits } from "@/server/security/rate-limit";
import { claimJobs, completeJob, failJob, PermanentJobError, queueBus, reclaimStaleJobs, retryJob, type JobType } from "./queue";
import { handlers, onJobFailed } from "./handlers";
import { purgeDeletedEvents } from "@/server/maintenance";

/**
 * Queue worker. Run standalone with `npm run worker` (production), or inside the
 * Next.js server when INLINE_WORKER=true (development / single-instance hosting).
 */

const g = globalThis as unknown as { __invtraWorker?: { stop: () => Promise<void> } };

export function startWorker(opts: { concurrency: number; pollMs?: number; label?: string }) {
  if (g.__invtraWorker) return g.__invtraWorker;
  const id = `${opts.label ?? "worker"}@${hostname()}:${process.pid}`;
  const pollMs = opts.pollMs ?? 1000;
  let active = 0;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let ticking = false;
  let lastMaintenance = 0;
  let lastHourly = 0;

  const schedule = (ms: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, ms);
  };

  async function run(job: Job) {
    const handler = handlers[job.type as JobType];
    try {
      if (!handler) throw new PermanentJobError(`Unknown job type ${job.type}`);
      await handler(job, (job.payload ?? {}) as Record<string, unknown>);
      await completeJob(job.id);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (e instanceof PermanentJobError || job.attempts >= job.maxAttempts) {
        await failJob(job.id, err.message);
        await onJobFailed(job, err).catch(() => undefined);
      } else {
        await retryJob(job, err.message);
      }
    }
  }

  async function maintenance() {
    const now = Date.now();
    if (now - lastMaintenance > 60_000) {
      lastMaintenance = now;
      await reclaimStaleJobs();
      await purgeExpiredRateLimits();
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }
    if (now - lastHourly > 3_600_000) {
      lastHourly = now;
      await db.job.deleteMany({ where: { status: { in: ["COMPLETED", "CANCELLED"] }, completedAt: { lt: new Date(now - 14 * 86_400_000) } } });
      await db.webhookEvent.deleteMany({ where: { processedAt: { lt: new Date(now - 30 * 86_400_000) } } });
      await purgeDeletedEvents();
    }
  }

  async function tick() {
    if (stopped || ticking) return;
    ticking = true;
    let claimed = 0;
    try {
      await maintenance();
      const jobs = await claimJobs(id, opts.concurrency - active);
      claimed = jobs.length;
      for (const job of jobs) {
        active++;
        run(job).finally(() => {
          active--;
          schedule(0);
        });
      }
    } catch (e) {
      await logError("worker:loop", e);
    } finally {
      ticking = false;
      schedule(claimed ? 25 : pollMs);
    }
  }

  const wake = () => schedule(0);
  queueBus.on("job", wake);
  schedule(0);

  const handle = {
    async stop() {
      stopped = true;
      queueBus.off("job", wake);
      if (timer) clearTimeout(timer);
      const deadline = Date.now() + 15_000;
      while (active > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      g.__invtraWorker = undefined;
    },
  };
  g.__invtraWorker = handle;
  console.log(`[invtra] queue worker ${id} started (concurrency ${opts.concurrency})`);
  return handle;
}
