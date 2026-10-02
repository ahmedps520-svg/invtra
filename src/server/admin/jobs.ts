import { db } from "@/server/db";
import { conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { queueBus } from "@/server/queue/queue";
import { updateGuest } from "@/server/guests/status";

/** Put a FAILED job back in the queue to run now with a fresh retry budget. */
export async function retryFailedJob(actorId: string, jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw notFound("Job");
  if (job.status !== "FAILED") throw conflict("job_not_failed", "Only failed jobs can be retried.");
  const updated = await db.job.updateMany({
    where: { id: jobId, status: "FAILED" },
    data: { status: "PENDING", runAt: new Date(), attempts: 0, lockedAt: null, lockedBy: null, completedAt: null },
  });
  if (!updated.count) throw conflict("job_not_failed", "The job changed meanwhile — refresh and try again.");
  // A retried Accept/Decline request shows as queued again for the host.
  const guestId = (job.payload as Record<string, unknown> | null)?.guestId;
  if (job.type === "invitation.request" && typeof guestId === "string") {
    const guest = await db.guest.findUnique({ where: { id: guestId }, select: { id: true, deliveryStatus: true } });
    if (guest?.deliveryStatus === "FAILED") await updateGuest(db, guest.id, { deliveryStatus: "QUEUED", deliveryError: null, deliveryErrorCode: null });
  }
  queueBus.emit("job");
  await audit(actorId, "admin.job.retry", "job", jobId, { type: job.type, previousError: job.lastError?.slice(0, 500) ?? null });
}

/** Acknowledge a FAILED job without running it again. */
export async function dismissFailedJob(actorId: string, jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw notFound("Job");
  if (job.status !== "FAILED") throw conflict("job_not_failed", "Only failed jobs can be dismissed.");
  await db.job.update({ where: { id: jobId }, data: { status: "CANCELLED" } });
  await audit(actorId, "admin.job.dismiss", "job", jobId, { type: job.type });
}
