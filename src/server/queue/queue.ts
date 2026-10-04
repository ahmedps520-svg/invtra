import { EventEmitter } from "node:events";
import { Prisma, type Job } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Durable job queue on Postgres. Workers claim jobs with
 * `FOR UPDATE SKIP LOCKED`, so any number of worker processes can run safely.
 */

export type JobType =
  | "invitation.request"
  | "invitation.deliver"
  | "invitation.decline_ack"
  | "invitation.notice"
  | "mock.webhook"
  | "payment.request"
  | "payment.receipt"
  | "reminder.send"
  | "nudge.send";

export const PRIORITY = { bulk: 0, normal: 5, interactive: 10 } as const;

/** Throw from a handler to fail a job without retrying. */
export class PermanentJobError extends Error {}

type Tx = Prisma.TransactionClient | typeof db;

const g = globalThis as unknown as { __invtraQueueBus?: EventEmitter };
export const queueBus = g.__invtraQueueBus ?? (g.__invtraQueueBus = new EventEmitter());

export interface EnqueueOptions {
  runAt?: Date;
  delayMs?: number;
  priority?: number;
  maxAttempts?: number;
  dedupeKey?: string;
  batchId?: string | null;
  eventId?: string | null;
  tx?: Tx;
}

export async function enqueue(type: JobType, payload: Record<string, unknown>, opts: EnqueueOptions = {}): Promise<Job | null> {
  const client = opts.tx ?? db;
  const runAt = opts.runAt ?? new Date(Date.now() + (opts.delayMs ?? 0));
  try {
    const job = await client.job.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        runAt,
        priority: opts.priority ?? PRIORITY.normal,
        maxAttempts: opts.maxAttempts ?? 6,
        dedupeKey: opts.dedupeKey,
        batchId: opts.batchId ?? null,
        eventId: opts.eventId ?? null,
      },
    });
    queueBus.emit("job");
    return job;
  } catch (e) {
    // A job with the same dedupe key already exists — that's the point of the key.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
}

export async function enqueueMany(
  jobs: { type: JobType; payload: Record<string, unknown>; priority?: number; batchId?: string; eventId?: string; delayMs?: number }[],
  tx?: Tx,
) {
  if (!jobs.length) return;
  const client = tx ?? db;
  const now = Date.now();
  for (let i = 0; i < jobs.length; i += 1000) {
    await client.job.createMany({
      data: jobs.slice(i, i + 1000).map((j) => ({
        type: j.type,
        payload: j.payload as Prisma.InputJsonValue,
        priority: j.priority ?? PRIORITY.bulk,
        batchId: j.batchId ?? null,
        eventId: j.eventId ?? null,
        runAt: new Date(now + (j.delayMs ?? 0)),
        maxAttempts: 6,
      })),
    });
  }
  queueBus.emit("job");
}

export async function claimJobs(workerId: string, limit: number): Promise<Job[]> {
  if (limit <= 0) return [];
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET "status" = 'RUNNING'::"JobStatus", "lockedAt" = now(), "lockedBy" = ${workerId},
           "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "Job"
      WHERE "status" = 'PENDING'::"JobStatus" AND "runAt" <= now()
      ORDER BY "priority" DESC, "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

export async function completeJob(id: string) {
  await db.job.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null, lockedBy: null } });
}

/** Exponential backoff with jitter: 15s, 30s, 1m, 2m, 4m … capped at 30m. */
export function backoffMs(attempts: number) {
  const base = Math.min(15_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
  return base + Math.floor(Math.random() * base * 0.2);
}

export async function retryJob(job: Job, error: string) {
  await db.job.update({
    where: { id: job.id },
    data: { status: "PENDING", runAt: new Date(Date.now() + backoffMs(job.attempts)), lastError: error.slice(0, 2000), lockedAt: null, lockedBy: null },
  });
}

export async function failJob(id: string, error: string) {
  await db.job.update({
    where: { id },
    data: { status: "FAILED", lastError: error.slice(0, 2000), lockedAt: null, lockedBy: null, completedAt: new Date() },
  });
}

/** Return jobs whose worker died mid-run to the queue. */
export async function reclaimStaleJobs(olderThanMs = 5 * 60_000) {
  return db.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: "PENDING", lockedAt: null, lockedBy: null },
  });
}

export async function cancelPendingJobs(where: { batchId?: string; eventId?: string }) {
  return db.job.updateMany({ where: { ...where, status: "PENDING" }, data: { status: "CANCELLED", completedAt: new Date() } });
}
