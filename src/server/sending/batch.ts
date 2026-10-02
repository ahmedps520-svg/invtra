import { db } from "@/server/db";
import { recordActivity } from "@/server/activity";
import { cancelPendingJobs } from "@/server/queue/queue";

/** Atomically count one processed message and complete the batch when all are done. */
export async function batchProgress(batchId: string, outcome: "sent" | "failed" | "skipped") {
  const rows = await db.$queryRawUnsafe<{ total: number; sent: number; failed: number; skipped: number; status: string; eventId: string }[]>(
    `UPDATE "SendBatch" SET "${outcome}" = "${outcome}" + 1,
       "status" = CASE WHEN "status" = 'QUEUED' THEN 'RUNNING'::"BatchStatus" ELSE "status" END,
       "startedAt" = COALESCE("startedAt", now())
     WHERE "id" = $1
     RETURNING "total", "sent", "failed", "skipped", "status"::text AS "status", "eventId"`,
    batchId,
  );
  const b = rows[0];
  if (!b) return;
  if (b.status !== "COMPLETED" && b.status !== "CANCELLED" && b.sent + b.failed + b.skipped >= b.total) {
    const done = await db.sendBatch.updateMany({
      where: { id: batchId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (done.count) {
      await recordActivity(db, b.eventId, "batch.completed", { batchId, sent: b.sent, failed: b.failed, skipped: b.skipped });
    }
  }
}

export async function cancelBatch(batchId: string, reason?: string) {
  const r = await cancelPendingJobs({ batchId });
  const batch = await db.sendBatch.update({
    where: { id: batchId },
    data: { status: "CANCELLED", completedAt: new Date(), skipped: { increment: r.count } },
  });
  // Guests whose message never left go back to "not sent".
  await db.guest.updateMany({ where: { eventId: batch.eventId, deliveryStatus: "QUEUED" }, data: { deliveryStatus: "NOT_SENT" } });
  if (reason) await recordActivity(db, batch.eventId, "batch.completed", { batchId, cancelled: true, reason });
}
